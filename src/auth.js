// OAuth 2.0 для Upwork API.
// Использует Client Credentials-подобный подход, но т.к. Upwork требует Authorization Code flow
// для персональных данных, токен сначала получается один раз вручную (см. README),
// а затем скрипт только ОБНОВЛЯЕТ его через refresh_token при каждом запуске.

const fs = require("fs");
const path = require("path");

const TOKEN_FILE = path.join(__dirname, "..", "data", "token.json");
const TOKEN_URL = "https://www.upwork.com/api/v3/oauth2/token";

async function getAccessToken(config) {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error(
      "Файл data/token.json не найден. Сначала выполни одноразовый вход: node src/login.js"
    );
  }

  const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));

  // Обновляем токен через refresh_token при каждом запуске —
  // так надёжнее, чем полагаться на access_token, у которого короткий срок жизни.
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenData.refresh_token,
      client_id: config.UPWORK_CLIENT_ID,
      client_secret: config.UPWORK_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Не удалось обновить токен Upwork: ${resp.status} ${errText}`);
  }

  const newTokenData = await resp.json();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokenData, null, 2));

  return newTokenData.access_token;
}

module.exports = { getAccessToken, TOKEN_FILE };
