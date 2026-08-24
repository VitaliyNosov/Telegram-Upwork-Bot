const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "config.js");
const TOKEN_PATH = path.join(__dirname, "..", "data", "token.json");

if (!fs.existsSync(TOKEN_PATH)) {
  console.error("Пожалуйста, сначала выполните авторизацию (npm run login)");
  process.exit(1);
}

const config = require(CONFIG_PATH);
const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));

const GRAPHQL_URL = "https://api.upwork.com/graphql";

async function fetchTypeFields(accessToken, typeName) {
  const query = `
    query Introspect($name: String!) {
      __type(name: $name) {
        inputFields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables: { name: typeName } }),
  });

  if (!resp.ok) {
    console.error(`Ошибка при запросе для ${typeName}:`, resp.status, await resp.text());
    return [];
  }

  const json = await resp.json();
  if (json.errors) {
    console.error(`Ошибка GraphQL для ${typeName}:`, JSON.stringify(json.errors, null, 2));
    return [];
  }

  return json.data.__type?.inputFields || [];
}

async function main() {
  const publicFields = await fetchTypeFields(tokenData.access_token, "PublicMarketplaceJobPostingsSearchFilter");
  // Небольшая задержка перед вторым запросом
  await new Promise(r => setTimeout(r, 1000));
  const privateFields = await fetchTypeFields(tokenData.access_token, "MarketplaceJobPostingsSearchFilter");

  console.log("\n--- Доступные поля для PublicMarketplaceJobPostingsSearchFilter ---");
  publicFields.forEach(f => {
    const typeName = f.type.name || (f.type.ofType ? f.type.ofType.name : "unknown");
    console.log(`- ${f.name} (${typeName})`);
  });

  console.log("\n--- Доступные поля для MarketplaceJobPostingsSearchFilter ---");
  privateFields.forEach(f => {
    const typeName = f.type.name || (f.type.ofType ? f.type.ofType.name : "unknown");
    console.log(`- ${f.name} (${typeName})`);
  });
}

main().catch(console.error);
