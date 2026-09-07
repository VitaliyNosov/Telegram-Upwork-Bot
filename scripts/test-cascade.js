/**
 * Тестовый скрипт для валидации механизма ротации моделей Gemini (Cascade)
 * Запуск: node scripts/test-cascade.js
 */

const assert = require("assert");

async function runTests() {
  console.log("=== ТЕСТИРОВАНИЕ КАСКАДА РОТАЦИИ МОДЕЛЕЙ GEMINI ===\n");

  const originalFetch = global.fetch;

  try {
    // -------------------------------------------------------------
    // Тест 1: Эмуляция исчерпания лимитов (429) на 3.5 и 3.6,
    // успешный перехват на gemini-2.0-flash
    // -------------------------------------------------------------
    console.log("Тест 1: Эмуляция 429 на первых двух моделях и успешный ответ на gemini-2.0-flash...");

    const attemptedModels = [];

    global.fetch = async (url, options) => {
      const match = url.match(/\/models\/([^:]+):generateContent/);
      const model = match ? match[1] : "unknown";
      attemptedModels.push(model);

      if (model === "gemini-3.5-flash" || model === "gemini-3.6-flash") {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({
            error: {
              code: 429,
              message: "Quota exceeded for quota metric 'Queries' and limit 'QUOTA_EXCEEDED'",
              status: "RESOURCE_EXHAUSTED"
            }
          })
        };
      }

      if (model === "gemini-2.0-flash") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { text: "Hi! I can solve your WooCommerce checkout issues immediately and boost PageSpeed." }
                  ]
                },
                finishReason: "STOP"
              }
            ]
          })
        };
      }

      throw new Error(`Неожиданный вызов модели: ${model}`);
    };

    // Устанавливаем фиктивный ключ для теста
    process.env.GEMINI_API_KEY = "test_primary_key";
    delete process.env.GEMINI_API_KEY_BACKUP;

    // Очищаем кэш require, чтобы подхватить конфиг
    delete require.cache[require.resolve("../src/config")];
    delete require.cache[require.resolve("../src/gemini")];
    const { generateCoverLetter } = require("../src/gemini");

    const sampleJob = {
      title: "Fix WooCommerce Bug",
      description: "Checkout is failing",
      skills: [{ name: "WordPress" }]
    };

    const result = await generateCoverLetter(sampleJob);

    assert(result && result.includes("Hi! I can solve your WooCommerce"), "Письмо должно быть успешно получено");
    assert.deepStrictEqual(
      attemptedModels,
      ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.0-flash"],
      "Цепочка вызовов должна строго соблюдать приоритет моделей"
    );

    console.log("✅ Тест 1 пройден: Модели 3.5 и 3.6 с 429 пропущены, 2.0-flash успешно вернула результат!\n");

    // -------------------------------------------------------------
    // Тест 2: Эмуляция исчерпания всех моделей на основном ключе,
    // переключение на резервный ключ (GEMINI_API_KEY_BACKUP)
    // -------------------------------------------------------------
    console.log("Тест 2: Эмуляция перехода на GEMINI_API_KEY_BACKUP при отказе всех моделей основного ключа...");

    process.env.GEMINI_API_KEY = "key_account_1";
    process.env.GEMINI_API_KEY_BACKUP = "key_account_2";

    const attemptedCalls = [];

    global.fetch = async (url) => {
      const modelMatch = url.match(/\/models\/([^:]+):generateContent/);
      const keyMatch = url.match(/key=([^&]+)/);
      const model = modelMatch ? modelMatch[1] : "unknown";
      const key = keyMatch ? keyMatch[1] : "unknown";

      attemptedCalls.push({ model, key });

      if (key === "key_account_1") {
        // Все модели на первом ключе возвращают 429
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ error: { code: 429, message: "Limit reached" } })
        };
      }

      if (key === "key_account_2" && model === "gemini-3.5-flash") {
        // На втором ключе модель 3.5 отвечает успешно
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Proposal generated from backup account key." }]
                }
              }
            ]
          })
        };
      }

      return { ok: false, status: 500, text: async () => "" };
    };

    delete require.cache[require.resolve("../src/config")];
    delete require.cache[require.resolve("../src/gemini")];
    const geminiBackupModule = require("../src/gemini");

    const result2 = await geminiBackupModule.generateCoverLetter(sampleJob);

    assert(result2 && result2.includes("backup account key"), "Должен быть получен ответ со второго ключа");
    assert(
      attemptedCalls.some(c => c.key === "key_account_2" && c.model === "gemini-3.5-flash"),
      "Должен произойти вызов со вторым ключом"
    );

    console.log("✅ Тест 2 пройден: Резервный ключ успешно подхвачен после исчерпания первого!\n");

    console.log("🎉 ВСЕ ТЕСТЫ КАСКАДА РОТАЦИИ УСПЕШНО ПРОЙДЕНЫ!");
  } finally {
    global.fetch = originalFetch;
  }
}

runTests().catch(err => {
  console.error("❌ Ошибка в тестах:", err);
  process.exit(1);
});
