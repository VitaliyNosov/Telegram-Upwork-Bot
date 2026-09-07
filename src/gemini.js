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
async function callGeminiModel(model, apiKey, requestBody, timeoutMs = 12000) {
  const endpoint = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
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
 * Генерирует сопроводительное письмо (Cover Letter) через Gemini API.
 * Реализует мгновенную ротацию моделей (Cascade) при исчерпании квот (HTTP 429)
 * и каскадное переключение на резервный ключ (если задан).
 * 
 * @param {Object} job - объект вакансии Upwork
 * @returns {Promise<string|null>} - текст письма или null при ошибке/исчерпании всех квот
 */
async function generateCoverLetter(job) {
  const primaryKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!primaryKey) {
    console.warn("[Gemini] GEMINI_API_KEY не задан. Пропускаем генерацию Cover Letter.");
    return null;
  }

  const backupKey = config.GEMINI_API_KEY_BACKUP || process.env.GEMINI_API_KEY_BACKUP;
  const keySlots = [{ key: primaryKey, label: "основной ключ" }];
  if (backupKey && backupKey !== primaryKey) {
    keySlots.push({ key: backupKey, label: "резервный ключ" });
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

  const defaultModels = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];

  const candidateModels = Array.isArray(config.GEMINI_MODELS) && config.GEMINI_MODELS.length > 0
    ? config.GEMINI_MODELS
    : defaultModels;

  // Исключаем дубликаты, сохраняя строгий порядок приоритета
  const models = Array.from(new Set(candidateModels.filter(Boolean)));

  for (let k = 0; k < keySlots.length; k++) {
    const { key, label } = keySlots[k];

    for (let m = 0; m < models.length; m++) {
      const model = models[m];

      try {
        const { ok, status, data, rawText } = await callGeminiModel(model, key, requestBody, 12000);

        if (ok && data) {
          const letter = extractLetterText(data);
          if (letter) {
            console.log(`[Gemini] Cover Letter успешно сгенерирован через [${model}] (${label})`);
            return letter;
          }
          console.warn(
            `[Gemini] [${model}] (${label}) вернула пустой текст (finishReason: ${data.candidates?.[0]?.finishReason || "unknown"}). Переходим к следующей модели...`
          );
          continue;
        }

        // Обработка 429 Too Many Requests / Resource Exhausted (квота исчерпана)
        if (status === 429) {
          const errMsg = data?.error?.message || "";
          console.warn(
            `[Gemini] [${model}] (${label}) исчерпала лимит (HTTP 429: ${errMsg.slice(0, 120) || "Rate limit reached"}). Мгновенный переход к следующей модели...`
          );
          continue;
        }

        // Обработка 404 (модель недоступна) или 400
        if (status === 404 || status === 400) {
          console.warn(`[Gemini] [${model}] (${label}) недоступна (HTTP ${status}). Пропускаем модель...`);
          continue;
        }

        // Временные сбои серверов Google (500, 503)
        console.warn(
          `[Gemini] [${model}] (${label}) вернула ошибку сервера (${status}): ${(rawText || "").slice(0, 150)}. Пробуем следующую модель...`
        );
      } catch (err) {
        console.warn(`[Gemini] [${model}] (${label}) ошибка сети/таймаут: ${err.message}. Пробуем следующую модель...`);
      }
    }

    if (k < keySlots.length - 1) {
      console.warn(`[Gemini] Все модели на ${label} исчерпали квоты. Переключаемся на резервный ключ...`);
    }
  }

  console.error(`[Gemini] Не удалось сгенерировать Cover Letter для "${job.title}" ни через одну доступную модель.`);
  return null;
}

module.exports = { generateCoverLetter, callGeminiModel, extractLetterText };

