// Одноразовый скрипт: запускаешь ОДИН РАЗ локально на своём компьютере,
// проходишь авторизацию через браузер, получаешь refresh_token,
// который сохраняется в data/token.json и коммитится в приватный репозиторий.
// GitHub Actions потом сам обновляет access_token через этот refresh_token при каждом запуске.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const config = require("./config");

const AUTH_URL = "https://www.upwork.com/ab/account-security/oauth2/authorize";
const TOKEN_URL = "https://www.upwork.com/api/v3/oauth2/token";

// ВАЖНО: должен совпадать с Callback URL, указанным в настройках твоего API-ключа
const REDIRECT_URI = "https://example.com/oauth-callback";

const TOKEN_FILE = path.join(__dirname, "..", "data", "token.json");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function main() {
  const authUrl =
    `${AUTH_URL}?response_type=code&client_id=${config.UPWORK_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  console.log("Открой эту ссылку в браузере, подтверди доступ, затем вставь сюда ПОЛНЫЙ URL редиректа:\n");
  console.log(authUrl, "\n");

  const redirectedUrl = await ask("Вставь URL редиректа сюда: ");
  const code = new URL(redirectedUrl).searchParams.get("code");

  if (!code) {
    console.error("Не удалось найти 'code' в переданном URL. Проверь, что скопировал ссылку целиком.");
    process.exit(1);
  }

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.UPWORK_CLIENT_ID,
      client_secret: config.UPWORK_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!resp.ok) {
    console.error("Ошибка при обмене кода на токен:", await resp.text());
    process.exit(1);
  }

  const token = await resp.json();
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));

  console.log("\nГотово! Токен сохранён в", TOKEN_FILE);
  console.log("Не забудь закоммитить и запушить этот файл в репозиторий:");
  console.log("  git add data/token.json");
  console.log("  git commit -m \"add initial token\"");
  console.log("  git push");
}

main();
