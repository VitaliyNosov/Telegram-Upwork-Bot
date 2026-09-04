const fs = require("fs");
const path = require("path");
const config = require("./config");

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Извлекает текст письма из ответа Gemini API,
 * корректно обрабатывая multi-part и блоки рассуждений (thinking tokens).
 */
function extractLetterText(data) {
  if (!data) return null;

  if (data.promptFeedback?.blockReason) {
    console.warn(`[Gemini] Запрос заблокирован фильтром: ${data.promptFeedback.blockReason}`);
    return null;
  }

  const candidate = data.candidates?.[0];
  if (!candidate) return null;

  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    console.warn(`[Gemini] Завершение генерации с причиной (finishReason): ${candidate.finishReason}`);
  }

  const parts = candidate.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;

  // Игнорируем блоки мыслей (thought: true), собираем только реальный текст ответа
  const textParts = parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text);

  const letter = textParts.join("").trim();
  if (letter) return letter;

  // Резервный сбор: если структура нестандартная, собираем любые доступные текстовые фрагменты
  const fallbackText = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("")
    .trim();

  return fallbackText || null;
}

/**
 * Выполняет один HTTP-запрос к указанной модели Gemini API
 */
async function callGeminiModel(model, apiKey, requestBody) {
  const endpoint = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15000), // таймаут 15 сек на случай зависания сети
  });

  // Вычитываем тело ответа один раз, чтобы исключить ошибку "body used already"
  const rawText = await response.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    // ответ не в формате JSON
  }

  return { ok: response.ok, status: response.status, data, rawText };
}

/**
 * Генерирует сопроводительное письмо (Cover Letter) через Gemini API
 * @param {Object} job - объект вакансии Upwork
 * @returns {Promise<string|null>} - текст письма или null при ошибке/отсутствии ключа
 */
async function generateCoverLetter(job) {
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Gemini] GEMINI_API_KEY не задан. Пропускаем генерацию Cover Letter.");
    return null;
  }

  const profilePath = path.resolve(config.PATHS.PROFILE_FILE || "data/resume_profile.txt");
  let profileContent = "";
  if (fs.existsSync(profilePath)) {
    profileContent = fs.readFileSync(profilePath, "utf-8");
  } else {
    console.warn(`[Gemini] Файл профиля не найден по пути: ${profilePath}`);
  }

  const jobTitle = job.title || "WordPress / CMS Development";
  const jobDescription = job.description || "";
  const jobSkills = Array.isArray(job.skills) ? job.skills.map((s) => s.name || s).join(", ") : "";

  const prompt = `
You are an expert freelancer writing a concise, tailored Upwork proposal/cover letter.
Analyze the job details and match them with the freelancer's actual background and skills from the profile.

--- FREELANCER PROFILE ---
${profileContent}

--- JOB DETAILS ---
Title: ${jobTitle}
Skills: ${jobSkills}
Description:
${jobDescription}

--- INSTRUCTIONS ---
1. Language: English only.
2. Tone: Professional, confident, conversational, and direct.
3. STRICTLY AVOID robotic clichés like "Dear Hiring Manager", "I hope this finds you well", "I am writing to express my interest", "I am the ideal candidate". Start directly with "Hi!" or by directly addressing their problem.
4. CRITICAL: If the client included any specific instructions, test questions, or secret keywords (e.g. "start your proposal with word XYZ"), address or answer them IMMEDIATELY in the very first sentence.
5. Highlight 1-2 specific, highly relevant skills or accomplishments from the freelancer's profile that solve the client's exact problem. Mention 1 relevant portfolio link from the profile if appropriate.
6. Length: Keep it concise and focused — roughly 90 to 140 words (2-3 short paragraphs). Do NOT use lengthy multi-phase headings or long lists.
7. End with a short question or call-to-action to start a conversation in chat.
8. Output ONLY the plain text of the cover letter without markdown code fences or headers.
`.trim();

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2500,
    },
    // Отключаем ложные срабатывания фильтров цензуры на текстах вакансий
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ],
  };

  const primaryModel = config.GEMINI_MODEL || "gemini-3.5-flash";
  const models = [primaryModel];
  if (!models.includes("gemini-1.5-flash")) {
    models.push("gemini-1.5-flash"); // Надежная резервная модель при перегрузке основной
  }

  for (const model of models) {
    const MAX_ATTEMPTS = 2; // 2 попытки на модель
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { ok, status, data, rawText } = await callGeminiModel(model, apiKey, requestBody);

        if (ok && data) {
          const letter = extractLetterText(data);
          if (letter) {
            if (model !== primaryModel) {
              console.log(`[Gemini] Успешно сгенерировано через резервную модель: ${model}`);
            }
            return letter;
          }
          console.warn(
            `[Gemini] [${model}] Модель вернула пустой текст (finishReason: ${data.candidates?.[0]?.finishReason || "unknown"})`
          );
        } else {
          console.warn(
            `[Gemini] [${model}] Попытка ${attempt}/${MAX_ATTEMPTS} вернула статус ${status}: ${(rawText || "").slice(0, 250)}`
          );
        }

        // Если ошибка 429 (rate limit) или 5xx (сервер перегружен) — пауза перед повтором
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = attempt * 3000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (err) {
        console.warn(`[Gemini] [${model}] Попытка ${attempt}/${MAX_ATTEMPTS} сетевая ошибка: ${err.message}`);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        }
      }
    }
  }

  console.error(`[Gemini] Не удалось сгенерировать Cover Letter для "${job.title}" после всех попыток.`);
  return null;
}

module.exports = { generateCoverLetter };
