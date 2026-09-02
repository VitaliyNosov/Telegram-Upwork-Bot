const fs = require("fs");
const path = require("path");
const config = require("./config");

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

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

  const model = config.GEMINI_MODEL || "gemini-3.5-flash";
  const endpoint = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

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
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const letter = candidate?.content?.parts?.[0]?.text?.trim();
        if (letter) {
          return letter;
        }
      }

      const errBody = await response.text();
      console.warn(`[Gemini] Попытка ${attempt}/${MAX_ATTEMPTS} не удалась (${response.status}): ${errBody.slice(0, 300)}`);

      // Если ошибка 429 (rate limit) или 5xx (сервер перегружен) — делаем паузу и пробуем снова
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = attempt * 2500; // 2.5 сек, затем 5 сек
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      console.warn(`[Gemini] Попытка ${attempt}/${MAX_ATTEMPTS} сетевая ошибка: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
      }
    }
  }

  console.error(`[Gemini] Не удалось сгенерировать Cover Letter для "${job.title}" после ${MAX_ATTEMPTS} попыток.`);
  return null;
}

module.exports = { generateCoverLetter };
