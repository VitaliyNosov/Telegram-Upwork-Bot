# Telegram Upwork Bot with AI Cover Letter Generator & Mini App

![Telegram Upwork Bot Banner](img-git/github-baner-telegram-upwork-bot.png)

A lightweight, serverless Node.js bot and **Telegram Mini App** that monitors Upwork in real-time for high-quality job postings, generates personalized, ready-to-send proposal drafts (Cover Letters) via **Google Gemini AI**, delivers rich alerts with interactive action buttons to your Telegram chat, and provides a full-featured **Upwork-styled Telegram Web App** for browsing, searching, and managing saved jobs.

---

## ⚡ Architecture & Workflow

The bot operates in a semi-automated workflow: it handles 24/7 monitoring, filtering, scoring, proposal drafting, and feed aggregation, while giving you full control via Telegram alerts and the interactive Mini App.

```text
┌─────────────────────────┐
│ ⏰ Cloudflare Worker    │  Runs on cron (every 2–5 min)
└───────────┬─────────────┘
            │  1. Dispatches GitHub Actions workflow
            ▼
┌─────────────────────────┐      2. Queries Search API        ┌────────────────────────┐
│ ⚙️ GitHub Actions Runner│ ────────────────────────────────► │ 🌐 Upwork API          │
│    (src/index.js)       │ ◄──────────────────────────────── │    (GraphQL Search)    │
└───────────┬─────────────┘      3. Returns new job listings  └────────────────────────┘
            │
            ├─► 4. Evaluates filters & calculates score
            │
            ├─► 5. Google Gemini AI drafts custom Cover Letters (src/gemini.js)
            │
            ├─► 6. Updates 150-job rolling feed & Mini App data (docs/data/jobs_feed.json)
            │
            ├─► 7. Tracks daily stats & mirrors to Mini App (docs/data/daily_stats.json)
            │
            ├─► 8. Sends Telegram alerts with 1-tap copy & inline action buttons
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 📱 Telegram Ecosystem                                                  │
│                                                                        │
│  💬 Bot Alerts:                                                        │
│     • Formatted job info + score badge                                 │
│     • <code>One-tap copyable AI proposal</code>                        │
│     • [ 🚀 Открыть вакансию ] & [ ✍️ Подать Proposal ] buttons         │
│     • 📊 Daily 21:00 digest with stats                                 │
│                                                                        │
│  🌐 Telegram Mini App ("Jobs" Menu Button):                            │
│     • Hosted on GitHub Pages (/docs)                                   │
│     • Dual Theme: Authentic Upwork Daylight (default) & Telegram Dark  │
│     • 📊 Daily Report tab: live KPI stats & search query breakdown     │
│     • 📥 1-Click styled PDF Report export with official Upwork logo    │
│     • Keyword search, filter chips, rating & budget sliders            │
│     • Job details bottom sheet modal + 1-tap proposal clipboard copy   │
│     • Local favorites / saved jobs bookmarking                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. 🤖 AI-Powered Cover Letters (Google Gemini Flash)
* **Tailored Proposals:** Analyzes job requirements and aligns them with your actual developer experience from [`data/resume_profile.txt`](data/resume_profile.txt).
* **Client Trap/Verification Detection:** Detects client verification keywords (e.g. *"start your proposal with BLUEBERRY"*) and integrates them immediately.
* **Resilient Engine:** Handles thinking tokens, includes stream parsing safety, automatic retry timeout, and fallback model switching (`gemini-2.5-flash` / `gemini-1.5-flash`).
* **High-Converting Format:** Concise (90–140 words), conversational structure with portfolio links and clear calls-to-action.

### 2. 📱 Telegram Alerts with Interactive Action Buttons
* **One-Tap Mobile Copying:** Cover letters are formatted in Telegram `<code>` blocks for instant tap-to-copy.
* **Direct Action Buttons:**
  * `[ 🚀 Открыть вакансию ]` — Direct link to the Upwork job posting.
  * `[ ✍️ Подать Proposal ]` — Direct link straight to the `/apply` proposal submission form on Upwork.

### 3. 🌐 Upwork-Styled Telegram Mini App (Web App)
* **Dual Theme Support (Light by default / Telegram Dark):**
  * **Daylight Upwork (Default):** Crisp white cards (`#FFFFFF`), light gray backdrop (`#F7F7F7`), dark green-black typography (`#001E00`), and signature Upwork green accents (`#14A800`).
  * **Telegram Dark Mode:** Beautiful dark theme styled after Telegram Desktop (`#17212B` backdrop, `#242F3D` card surface, pure white typography, dual-mode Upwork logo).
  * Fast header toggle button (☀️ / 🌙) with persistent `localStorage` memory and Telegram window header/background synchronization.
* **Official Upwork Brand Assets:** Features the official dual-mode Upwork logo.
* **Real-Time Rolling Feed:** Displays the latest 150 filtered Upwork opportunities with automatic synchronization.
* **Search & Filter Suite:**
  * Real-time search across job titles, descriptions, and client countries.
  * Quick filter chips: `All Jobs`, `Hourly Only`, `Fixed-Price`, `$35+/hr`, `Unread`.
  * Advanced filter modal: minimum hourly rate slider, skill tag selector, and unviewed-only toggle.
  * Sorting options: `Newest First`, `Highest Score`, `Highest Budget`.
* **📊 Daily Report & Analytics Tab:**
  * Interactive **Report** tab in bottom navigation.
  * **4 Live KPI Cards:** Total jobs scanned, filtered matches, AI cover letters drafted, and top relevance score.
  * Search queries breakdown with match counts.
  * Full list of today's matched opportunities with direct Upwork link and Proposal buttons.
* **📥 1-Click Styled PDF Export:**
  * Instant generation and download of a branded, print-ready A4 PDF report (`Upwork_Daily_Report_YYYY-MM-DD.pdf`).
  * Complete with Upwork header logo, date badge, executive KPI grid, keyword tags, and clickable job links.
* **Interactive Bottom Sheet:** Full job details view with budget breakdown, client reputation metrics, and a dedicated **"📋 Скопировать AI Proposal"** button with toast confirmation.
* **Saved Jobs (Favorites):** Bookmarks saved locally on device via `localStorage`.

### 4. 📊 Daily Analytics Digest (21:00 Kyiv)
* Automatically monitors daily execution metrics:
  * Total polling workflow runs
  * Total jobs scanned and evaluated
  * High-relevance jobs matching your criteria
  * AI cover letters generated
  * Error tracking
* Dispatches a formatted summary report to Telegram every evening at 21:00 Kyiv time.

### 5. 🎯 Strict Quality Filters
* **Tier-1 Countries Only:** United States, United Kingdom, Canada, Australia, Germany, Netherlands, Switzerland, etc.
* **Verified Clients:** Payment method verified, minimum 4.5+ star rating, and proven hire history.
* **Budget Thresholds:** Configurable minimums (e.g., $25+/hr hourly, $200+ fixed-price).
* **Smart Exclusions:** Automatically skips design-only or low-relevance jobs.

### 6. ⚡ 100% Serverless & Zero Maintenance Costs
* Powered by **Cloudflare Workers** (cron trigger) and **GitHub Actions** (runner) — no paid VPS required.
* **GitHub Pages** hosts the Mini App frontend directly from the repository's `/docs` folder for free.
* **Zero npm Dependencies:** Core bot built entirely with native Node.js 20+ APIs (`fetch`, `crypto`, `fs`).

---

## 📋 Условия и спецификация доработок (Changelog & Technical Specs)

Недавний пакет масштабных доработок расширил возможности Telegram Mini App и фонового мониторинга:

### 1. 📊 Вкладка ежедневного отчета (Daily Report Tab в Mini App)
* **Цель и условия:** Перенос суточного отчета по подходящим вакансиям и аналитическим метрикам непосредственно в интерфейс Telegram Mini App для мгновенного доступа без необходимости скроллить историю сообщений в чате.
* **Источник данных:** `data/daily_stats.json`, зеркалируемый в `docs/data/daily_stats.json` и `webapp/data/daily_stats.json`.
* **4 ключевые KPI-карточки за день:**
  * **Просканировано (Scanned):** Общее количество вакансий, обработанных поисковым движком за текущие сутки.
  * **Подходящие (Matched):** Число вакансий, полностью прошедших строгие фильтры качества (Tier-1 страны, рейтинг клиента ≥ 4.5, верификация оплаты, бюджетные пороги).
  * **AI Proposals:** Количество готовых персонализированных сопроводительных писем, сгенерированных Google Gemini Flash.
  * **Топ скор (Top Score):** Наивысший балл релевантности среди всех найденных вакансий за день.
* **Детализация по поисковым запросам:** Динамические бейджи с точным количеством найденных вакансий по каждому запросу (например, `WordPress: 6`, `WooCommerce: 4`).
* **Список вакансий за день:** Карточки отобранных за сегодня возможностей с указанием бюджета, страны, оценки релевантности и прямыми кнопками:
  * `[ Открыть ]` — быстрый переход к оригинальной публикации на Upwork.
  * `[ Proposal ]` — прямой переход на форму подачи отклика (`/apply`).

### 2. 📥 Стилизованный экспорт отчета в PDF (1-Click PDF Export)
* **Цель и условия:** Возможность скачать красиво оформленный сводный отчет за текущий день в виде PDF-документа, полностью стилизованного под фирменный стиль приложения.
* **Официальный брендинг Upwork:** В шапку PDF-файла интегрирован официальный графический логотип Upwork (`logo.png`) с указанием даты формирования отчета (`Upwork_Daily_Report_YYYY-MM-DD.pdf`).
* **Клиентский рендеринг без серверов:** Генерация выполняется на стороне клиента через библиотеку `html2pdf.js` (Canvas + jsPDF) — быстро, безопасно и без задержек.
* **Структура документа (A4 Portrait):**
  * Фирменный хедер с официальным логотипом Upwork и датой генерации.
  * Сводная сетка метрик (4 KPI-карточки с аккуратной версткой).
  * Теги поисковых запросов с количеством совпадений.
  * Полный структурированный список вакансий со скорингом, бюджетом, страной и кликабельными ссылками на Upwork.

### 3. 🌓 Смена темы: Светлая по умолчанию + Темная в стиле Telegram
* **Условия оформления:**
  * **Светлая тема (Classic Upwork Daylight) — по умолчанию:** Фирменная светлая палитра Upwork (чисто-белые карточки `#FFFFFF`, нейтральный фон `#F7F7F7`, темная контрастная типографика `#001E00` и фирменный зеленый акцент `#14A800`).
  * **Темная тема (Telegram Desktop Dark Mode):** Премиальная темная палитра в нативном стиле Telegram Desktop (`#17212B` фон окна, `#242F3D` фон карточек и панелей, чистый белый текст и акценты `#14A800` / `#5288C1`).
* **Управление и сохранение:**
  * Кнопка быстрого переключения тем (☀️ / 🌙) в шапке приложения.
  * Сохранение выбранного режима в `localStorage` (выбранная тема сохраняется при повторных открытиях приложения).
  * Полноценная интеграция с Telegram WebApp API: динамическое обновление `Telegram.WebApp.setHeaderColor()` и `Telegram.WebApp.setBackgroundColor()` для синхронизации рамки окна Telegram.
  * Адаптивный логотип Upwork: автоматическое переключение между `logo.png` (для светлой темы) и `logo-dark.png` (для темной темы).

### 4. 🔄 Пайплайн автосинхронизации (GitHub Actions & GitHub Pages)
* **Условия непрерывной работы:**
  * При каждом цикле поллинга модуль `src/analytics.js` накапливает суточную статистику и синхронизирует ее между корневой директорией `data/` и клиентскими директориями `webapp/data/` и `docs/data/`.
  * GitHub Actions воркфлоу (`.github/workflows/poll.yml`) автоматически индексирует и пушит актуальные `jobs_feed.json` и `daily_stats.json`.
  * GitHub Pages мгновенно раздает свежие данные пользователям Mini App без необходимости перезапуска бота.

---

## 🛠️ Tech Stack

* **Core Engine:** [Node.js (v20+)](https://nodejs.org/) (Native ES / CommonJS without external dependencies)
* **AI Engine:** [Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`)](https://aistudio.google.com/)
* **APIs:** [Upwork GraphQL API v3](https://developers.upwork.com/) & [Telegram Bot API](https://core.telegram.org/bots/api)
* **Frontend (Mini App):** Vanilla HTML5, CSS3 (Upwork Design System & Telegram Dark Mode), Vanilla ES6 JavaScript, [Telegram WebApp SDK](https://telegram.org/js/telegram-web-app.js), [html2pdf.js](https://raw.githack.com/eKoopmans/html2pdf.js/master/dist/html2pdf.bundle.min.js) (Client-side PDF Generation)
* **Hosting & CI/CD:** [GitHub Actions](https://github.com/features/actions), [GitHub Pages](https://pages.github.com/), [Cloudflare Workers](https://workers.cloudflare.com/)

---

## 📂 Project Structure

```text
├── .github/workflows/
│   └── poll.yml               # GitHub Actions workflow for polling & feed updating
├── cloudflare-worker/
│   └── index.js               # Cloudflare Worker for cron dispatch
├── data/
│   ├── daily_stats.json       # Daily analytics tracking state
│   ├── jobs_feed.json         # Rolling feed of latest 150 processed jobs
│   ├── resume_profile.txt     # Your developer bio, skills, cases, and portfolio
│   └── seen_jobs.json         # Deduplication persistence (processed job IDs)
├── docs/                      # GitHub Pages deployment bundle (Mini App)
│   ├── data/
│   │   ├── daily_stats.json   # Live daily metrics for the Report tab
│   │   └── jobs_feed.json     # Live feed consumed by the Mini App
│   ├── app.js                 # Mini App client logic & Telegram SDK integration
│   ├── index.html             # Mini App HTML structure (Upwork design + Report tab)
│   ├── logo.png               # Official Upwork logo (Light theme & PDF export)
│   ├── logo-dark.png          # Official Upwork logo (Telegram Dark theme)
│   └── styles.css             # Dual-theme stylesheet (Daylight & Telegram Dark)
├── webapp/                    # Mini App source directory (mirrored to docs/)
│   ├── data/
│   │   ├── daily_stats.json
│   │   └── jobs_feed.json
│   ├── app.js
│   ├── index.html
│   ├── logo.png
│   ├── logo-dark.png
│   └── styles.css
├── scripts/
│   ├── seed-feed.js           # Feed generator & verification script
│   └── test-gemini.js         # Isolated test script for AI cover letter generation
├── src/
│   ├── analytics.js           # Polling stats tracker & 21:00 Kyiv digest sender
│   ├── auth.js                # Upwork OAuth2 authentication & token refresh
│   ├── config.js              # Bot configuration, filters, and weights
│   ├── filters.js             # Multi-factor job filtering logic
│   ├── gemini.js              # Google Gemini API integration module
│   ├── index.js               # Main polling engine
│   ├── jobsFeed.js            # 150-job rolling feed manager
│   ├── login.js               # One-time OAuth login script
│   ├── scoring.js             # Relevance scoring algorithm
│   ├── seenJobs.js            # Deduplication persistence
│   ├── telegram.js            # Telegram message builder & inline button sender
│   └── upwork.js              # Upwork GraphQL API queries
├── package.json
└── wrangler.toml              # Cloudflare Worker configuration
```

---

## 🏁 Getting Started

### 1. Prerequisites

* **Node.js 20+** installed locally.
* **Upwork API Keys:** `Client ID` & `Client Secret` from the [Upwork Developer Center](https://www.upwork.com/developer/).
* **Telegram Bot:** Create a bot via [@BotFather](https://t.me/BotFather) and obtain your Bot Token & Chat ID (via [@userinfobot](https://t.me/userinfobot)).
* **Google Gemini API Key:** Free key from [Google AI Studio](https://aistudio.google.com/).
* **GitHub Personal Access Token (PAT):** Token with `repo` scope to allow updating secrets in Actions.

---

### 2. Developer Profile Setup

Edit [`data/resume_profile.txt`](data/resume_profile.txt) with your actual skills, specialties, and portfolio links. Gemini AI reads this file to tailor proposals specifically to your background:

```text
WORDPRESS & WOOCOMMERCE DEVELOPER
==================================
ABOUT: Professional WordPress engineer specializing in custom plugins, checkout fixes, and speed optimization.
CORE SKILLS: PHP, WooCommerce, Custom Plugins, Gutenberg, Core Web Vitals, Stripe API.
PORTFOLIO:
- https://example1.com (Speed optimization from 30 to 85)
- https://example2.com (Custom booking & payment integration)
```

---

### 3. One-Time Upwork OAuth Login

Run the interactive login script locally to authenticate with Upwork:

```bash
$env:UPWORK_CLIENT_ID="your_client_id"
$env:UPWORK_CLIENT_SECRET="your_client_secret"

npm run login
```

1. Open the generated authorization URL in your browser.
2. Log in and authorize access on Upwork.
3. Paste the redirect callback URL back into your terminal prompt to save the initial token.

---

### 4. Testing AI Cover Letter Generation Locally

To test the Gemini AI integration on a sample job without polling Upwork:

```bash
$env:GEMINI_API_KEY="AIzaSyYourGeminiApiKey"
npm run test:gemini
```

---

### 5. Running the Poller Locally

To perform a single manual poll of Upwork:

```bash
npm run poll
```

---

## 📱 Telegram Mini App Setup

### Step 1: Enable GitHub Pages

1. Open your repository on GitHub.
2. Navigate to **Settings -> Pages**.
3. Under **Build and deployment -> Source**, select **Deploy from a branch**.
4. Choose Branch: `main` and Folder: `/docs`. Click **Save**.
5. Your Mini App will be live at: `https://<your-username>.github.io/<repo-name>/`.

### Step 2: Configure the Bot Menu Button in @BotFather

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/setmenubutton` and choose your bot.
3. Send the menu button title: `Jobs`
4. Send your GitHub Pages URL: `https://<your-username>.github.io/<repo-name>/`
5. Done! The `Jobs` button will now appear directly inside your bot's chat interface.

---

## ☁️ Deployment (GitHub Actions + Cloudflare Workers)

### Step 1: Configure GitHub Repository Secrets

Go to **Settings -> Secrets and variables -> Actions** in your GitHub repository and add:

| Secret Name | Description |
| :--- | :--- |
| `UPWORK_CLIENT_ID` | Your Upwork API Client ID |
| `UPWORK_CLIENT_SECRET` | Your Upwork API Client Secret |
| `UPWORK_REFRESH_TOKEN` | Initial refresh token from `data/token.json` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target Telegram Chat / Channel ID |
| `GEMINI_API_KEY` | Google Gemini API key from Google AI Studio |
| `GH_PAT` | GitHub Personal Access Token (for secret updating) |

### Step 2: Set up Cloudflare Worker Scheduler

1. Deploy the worker in `cloudflare-worker/`:
   ```bash
   npx wrangler deploy
   ```
2. In the Cloudflare Dashboard, set the `GITHUB_PAT` secret variable for the worker.
3. The worker will trigger the GitHub Actions workflow according to the cron schedule in `wrangler.toml` (e.g. every 2 minutes).

---

## ⚙️ Filter Customization

You can fine-tune search criteria, rating thresholds, and keywords directly in [`src/config.js`](src/config.js):

* `KEYWORDS`: List of search queries (e.g., `"wordpress developer"`, `"woocommerce"`).
* `FILTERS.MIN_HOURLY_RATE`: Minimum hourly rate (default: `$25`).
* `FILTERS.MIN_FIXED_BUDGET`: Minimum fixed-price budget (default: `$200`).
* `FILTERS.MIN_CLIENT_RATING`: Minimum client rating (default: `4.5`).
* `FILTERS.MIN_CLIENT_POSTED_JOBS`: Minimum number of jobs posted by the client (default: `2`).
* `FILTERS.ALLOWED_COUNTRIES`: Whitelisted Tier-1 countries.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
