// OAuth 2.0 для Upwork API.
// Использует Client Credentials-подобный подход, но т.к. Upwork требует Authorization Code flow
// для персональных данных, токен сначала получается один раз вручную (см. README),
// а затем скрипт только ОБНОВЛЯЕТ его через refresh_token при каждом запуске.

const fs = require("fs");
const path = require("path");

const TOKEN_FILE = path.join(__dirname, "..", "data", "token.json");
const TOKEN_URL = "https://www.upwork.com/api/v3/oauth2/token";

async function getAccessToken(config) {
  let refreshToken = process.env.UPWORK_REFRESH_TOKEN;

  // Резервный вариант: чтение из локального token.json для удобства тестирования локально
  let usingLocalFile = false;
  if (!refreshToken) {
    if (fs.existsSync(TOKEN_FILE)) {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
      refreshToken = tokenData.refresh_token;
      usingLocalFile = true;
    } else {
      throw new Error(
        "Не задана переменная окружения UPWORK_REFRESH_TOKEN и не найден файл data/token.json. Сначала выполни одноразовый вход: node src/login.js"
      );
    }
  }

  // Обновляем токен через refresh_token при каждом запуске —
  // так надёжнее, чем полагаться на access_token, у которого короткий срок жизни.
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.UPWORK_CLIENT_ID,
      client_secret: config.UPWORK_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Не удалось обновить токен Upwork: ${resp.status} ${errText}`);
  }

  const newTokenData = await resp.json();

  if (usingLocalFile) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokenData, null, 2));
  } else {
    // В CI/CD: если Upwork прислал новый refresh_token, сохраняем его во временный файл,
    // чтобы экшен на GitHub Actions мог обновить секреты в репозитории.
    if (newTokenData.refresh_token && newTokenData.refresh_token !== refreshToken) {
      const newRefreshTokenFile = path.join(__dirname, "..", "data", "new_refresh_token.txt");
      fs.mkdirSync(path.dirname(newRefreshTokenFile), { recursive: true });
      fs.writeFileSync(newRefreshTokenFile, newTokenData.refresh_token, "utf-8");
      console.log("[Auth] Обнаружен новый refresh_token. Сохранен во временный файл для автоматического обновления GitHub Secret.");
    }
  }

  return newTokenData.access_token;
}

module.exports = { getAccessToken, TOKEN_FILE };
