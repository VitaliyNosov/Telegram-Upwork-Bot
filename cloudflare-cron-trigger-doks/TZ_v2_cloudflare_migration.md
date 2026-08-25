# ТЗ v2: Миграция Upwork Bot на Cloudflare Workers (Cron Trigger)

## Цель
Заменить GitHub Actions (интервал 5-15 минут, нестабильные задержки) на Cloudflare Workers с Cron Trigger — интервал 1-3 минуты, стабильнее по времени, полностью бесплатно.

**Текущая рабочая версия (GitHub Actions) не трогается и не удаляется** — разработка идёт в отдельной ветке, чтобы в любой момент можно было безопасно откатиться.

---

## Часть 1. Что нужно настроить руками

### 1.1 Git — ветка для разработки
- [ ] Создать ветку `cloudflare-cron-trigger-version` от текущего `main` (или как называется твоя основная ветка).
- [ ] Вся разработка v2 — только в этой ветке. `main` не трогаем до полного успешного теста новой версии.
- [ ] Команда для создания:
  ```
  git checkout -b cloudflare-cron-trigger-version
  git push -u origin cloudflare-cron-trigger-version
  ```

### 1.2 Регистрация в Cloudflare
- [ ] Зайти на **https://dash.cloudflare.com/sign-up** — создать бесплатный аккаунт (email + пароль, кредитка не обязательна для Workers free tier).
- [ ] После регистрации попадёшь в Cloudflare Dashboard.
- [ ] В левом меню найти раздел **Workers & Pages**.

### 1.3 Установка инструмента для деплоя (Wrangler CLI)
Это командная утилита, через которую пишется и деплоится код Worker'а.
- [ ] Установить глобально (нужен Node.js, который у тебя уже есть):
  ```
  npm install -g wrangler
  ```
- [ ] Авторизоваться (откроет браузер для подтверждения):
  ```
  wrangler login
  ```

### 1.4 Создание Worker-проекта
- [ ] В папке с кодом (внутри ветки `cloudflare-cron-trigger-version`) создать конфигурационный файл `wrangler.toml` (структуру дадим в Части 2).
- [ ] Создать **KV Namespace** — это замена файлу `seen_jobs.json`, т.к. у Workers нет доступа к файловой системе между запусками:
  ```
  wrangler kv namespace create "SEEN_JOBS"
  ```
  Команда выведет ID namespace — его нужно будет вписать в `wrangler.toml`.

### 1.5 Секреты (переменные окружения)
В отличие от `config.js` в текущей версии, здесь секреты хранятся через встроенный защищённый механизм Cloudflare — они не попадают в код, даже если репозиторий станет публичным:
- [ ] Задать каждый секрет отдельной командой (введёшь значение в интерактивном режиме):
  ```
  wrangler secret put UPWORK_CLIENT_ID
  wrangler secret put UPWORK_CLIENT_SECRET
  wrangler secret put UPWORK_REFRESH_TOKEN
  wrangler secret put TELEGRAM_BOT_TOKEN
  wrangler secret put TELEGRAM_CHAT_ID
  ```
  (Про `UPWORK_REFRESH_TOKEN` — см. Часть 2, п.2.2, важное отличие от текущей версии.)

### 1.6 CI/CD — деплой прямо из GitHub
Да, это возможно и рекомендуется, чтобы не гонять `wrangler deploy` руками каждый раз.
- [ ] В Cloudflare Dashboard: **Workers & Pages** → **Create** → **Workers** → **Connect to Git** (или похожий пункт — интерфейс Cloudflare периодически обновляется, ищи опцию привязки к GitHub-репозиторию).
- [ ] Авторизовать доступ Cloudflare к твоему GitHub-аккаунту, выбрать репозиторий.
- [ ] **Указать ветку деплоя — именно `cloudflare-cron-trigger-version`**, не `main`! Это критично: иначе Cloudflare будет пытаться деплоить не ту версию кода.
- [ ] После этого каждый пуш в указанную ветку будет автоматически деплоить новую версию Worker'а.

---

## Часть 2. Как переделать код

### 2.1 Что остаётся без изменений
- `src/upwork.js` — GraphQL-запросы к Upwork API (используют стандартный `fetch`, который есть и в Workers).
- `src/filters.js` — логика фильтрации, чистые функции, без обращения к файлам.
- `src/scoring.js` — то же самое, чистая функция.
- Форматирование сообщений в `telegram.js` — логика формирования текста остаётся.

### 2.2 Что меняется принципиально

**a) Хранилище состояния: файлы → Cloudflare KV**

Сейчас (`seenJobs.js`) читает/пишет `data/seen_jobs.json` через `fs`. В Workers файловой системы нет — нужно использовать KV:

```js
// Было (Node.js, файл):
const fs = require("fs");
fs.readFileSync(path);

// Станет (Workers, KV — доступ через env, который передаётся в обработчик):
const seenJobsRaw = await env.SEEN_JOBS.get("seen_jobs_list");
const seenJobs = new Set(JSON.parse(seenJobsRaw || "[]"));
// ...
await env.SEEN_JOBS.put("seen_jobs_list", JSON.stringify([...seenJobs]));
```

**b) OAuth-логин: меняется схема хранения токена**

Сейчас `auth.js` читает `data/token.json` (с `refresh_token` внутри) и обновляет его при каждом запуске, перезаписывая файл.

В Workers это делается иначе — `refresh_token` **не меняется от запуска к запуску** (Upwork обычно выдаёт долгоживущий refresh_token), поэтому:
- Одноразовый логин (`login.js`) выполняется **всё так же локально на твоём компьютере**, как раньше — Cloudflare Workers не подходит для интерактивного браузерного OAuth-флоу.
- Полученный `refresh_token` (не весь `token.json`, а именно поле `refresh_token` из него) сохраняется как секрет через `wrangler secret put UPWORK_REFRESH_TOKEN` (см. Часть 1, п.1.5) — то есть он "вшивается" один раз в Worker, а не хранится в файле, который постоянно перезаписывается.
- При каждом запуске Worker обменивает этот `refresh_token` на свежий `access_token` (это не требует браузера, просто HTTP-запрос) — `access_token` живёт только в памяти во время одного запуска, никуда не сохраняется.

**c) Точка входа: `index.js` → `export default { scheduled }`**

Workers используют другой формат точки входа — не `main()`, которая просто выполняется, а экспортируемый объект с обработчиком события `scheduled` (специально для Cron Triggers):

```js
export default {
  async scheduled(event, env, ctx) {
    // сюда переносится вся логика из текущего index.js,
    // но env.UPWORK_CLIENT_ID вместо config.UPWORK_CLIENT_ID,
    // и await env.SEEN_JOBS.get(...) вместо fs.readFileSync(...)
  }
};
```

**d) Модульная система: CommonJS → ES Modules**

Текущий код использует `require`/`module.exports` (CommonJS). Workers по умолчанию используют ES Modules:
```js
// Было:
const config = require("./config");
module.exports = { ... };

// Станет:
import { someFunction } from "./someModule.js";
export { someFunction };
```
Нужно пройтись по всем файлам (`filters.js`, `scoring.js`, `telegram.js`, `upwork.js`) и поменять синтаксис импорта/экспорта — сама логика внутри функций не меняется.

**e) Конфиг фильтров (`config.js`)**

Секреты убираются из файла (переезжают в Cloudflare secrets, см. 1.5), но настройки фильтров (ключевые слова, страны, пороги) остаются в коде как есть — их не нужно прятать, они не секретные.

### 2.3 Новый файл: `wrangler.toml`

```toml
name = "upwork-telegram-bot"
main = "src/index.js"
compatibility_date = "2026-08-24"

[triggers]
crons = ["*/2 * * * *"]  # каждые 2 минуты — минимум у Cloudflare 1 минута, ставим с запасом

[[kv_namespaces]]
binding = "SEEN_JOBS"
id = "сюда_вписать_id_из_wrangler_kv_namespace_create"
```

### 2.4 Итоговая структура файлов v2

```
/ (ветка cloudflare-cron-trigger-version)
├── wrangler.toml
├── src/
│   ├── index.js          # export default { scheduled }
│   ├── config.js         # только настройки фильтров, без секретов
│   ├── auth.js            # обмен refresh_token → access_token, без файлов
│   ├── upwork.js          # без изменений в логике, только import/export
│   ├── filters.js         # без изменений в логике, только import/export
│   ├── scoring.js         # без изменений в логике, только import/export
│   └── telegram.js        # без изменений в логике, только import/export
├── package.json
└── README.md
```

**Файлы, которых в v2 больше нет:**
- `login.js` как отдельный скрипт для GitHub-версии — логика логина остаётся нужна, но выполняется одноразово локально, результат (refresh_token) вручную вносится в Cloudflare secrets, а не коммитится в репозиторий.
- `seenJobs.js` (файловая версия) — заменяется на прямые вызовы `env.SEEN_JOBS.get/put` внутри `index.js`.
- `data/seen_jobs.json`, `data/token.json` — не нужны, состояние живёт в KV и в Cloudflare secrets.
- Workflow-файл `.github/workflows/poll.yml` — не нужен в этой ветке (или можно оставить, но он не будет использоваться, раз задача теперь у Cloudflare CI/CD).

---

## Часть 3. Как безопасно остановить текущего бота с возможностью быстрого отката

### 3.1 Не удаляй ничего в `main`
Вся текущая рабочая версия (GitHub Actions) остаётся как есть в ветке `main` — просто её нужно **приостановить**, а не удалить.

### 3.2 Как приостановить GitHub Actions

**Вариант А — отключить workflow одной кнопкой (самый быстрый откат):**
1. Репозиторий → вкладка **Actions**.
2. Слева выбери **Poll Upwork Jobs**.
3. Справа сверху — кнопка с тремя точками **"..."** → **Disable workflow**.
4. Готово — cron перестаёт запускаться, но сам файл `.github/workflows/poll.yml` остаётся в `main` нетронутым.

**Чтобы вернуться назад** — тот же путь, кнопка станет **"Enable workflow"**, один клик.

**Вариант Б — закомментировать cron в самом файле** (если хочешь, чтобы это было видно в истории коммитов):
```yaml
on:
  # schedule:
  #   - cron: "*/5 * * * *"
  workflow_dispatch: {} # оставляем только ручной запуск для теста
```
Это тоже легко отменить одним ревертом коммита.

**Рекомендация:** используй **Вариант А** — это чисто UI-переключатель, не требует коммитов, не может случайно "потеряться" при мерже веток, откатывается за 2 клика.

### 3.3 Проверка перед полной остановкой
Прежде чем отключать GitHub Actions версию — убедись, что Cloudflare-версия реально прислала хотя бы одно тестовое сообщение в Telegram (то есть вся цепочка Upwork API → фильтры → Telegram работает). Только после этого отключай текущую версию — чтобы не остаться без уведомлений вообще, пока новая не проверена.

---

## Часть 4. Чек-лист порядка действий (когда будешь готов начать)

1. Создать ветку `cloudflare-cron-trigger-version`
2. Зарегистрироваться в Cloudflare, установить Wrangler, авторизоваться
3. Создать KV Namespace
4. Переписать код по Части 2 (модульная система, KV вместо файлов, точка входа `scheduled`)
5. Задать секреты через `wrangler secret put` (включая `UPWORK_REFRESH_TOKEN`, полученный через локальный одноразовый логин)
6. Задеплоить вручную первый раз через `wrangler deploy` — проверить, что нет ошибок
7. Подключить автодеплой из GitHub (Часть 1, п.1.6) — с указанием правильной ветки
8. Дождаться первого срабатывания по расписанию (или вызвать вручную через Cloudflare Dashboard — там обычно есть кнопка "Trigger" для теста)
9. Убедиться, что сообщение пришло в Telegram
10. Только после успешного теста — отключить GitHub Actions версию (Часть 3.2, Вариант А)
