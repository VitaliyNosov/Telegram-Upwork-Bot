const config = require("./config");
const { getAccessToken } = require("./auth");
const { fetchJobsForKeyword } = require("./upwork");
const { passesFilters } = require("./filters");
const { calculateScore } = require("./scoring");
const { sendTelegramMessage, formatJobMessage } = require("./telegram");
const { loadSeenJobs, saveSeenJobs } = require("./seenJobs");

async function main() {
  console.log(`[${new Date().toISOString()}] Запуск опроса Upwork...`);

  const accessToken = await getAccessToken(config);
  const seenJobs = loadSeenJobs(config.PATHS.SEEN_JOBS_FILE);

  let totalFound = 0;
  let totalNew = 0;
  let totalSent = 0;

  for (const keyword of config.KEYWORDS) {
    console.log(`Ищу по ключевому слову: "${keyword}"`);

    let jobs;
    try {
      jobs = await fetchJobsForKeyword(accessToken, keyword);
    } catch (err) {
      console.error(`Ошибка при запросе по ключевому слову "${keyword}":`, err.message);
      continue; // не роняем весь скрипт из-за одного ключевого слова
    }

    totalFound += jobs.length;

    for (const job of jobs) {
      if (seenJobs.has(job.id)) continue;
      totalNew++;

      const { pass, reason } = passesFilters(job, config.FILTERS);
      seenJobs.add(job.id); // помечаем как виденную независимо от результата фильтра

      if (!pass) {
        console.log(`  Пропущена (${reason}): ${job.title}`);
        continue;
      }

      const score = calculateScore(job, config.KEYWORDS, config.SCORING_WEIGHTS);
      const message = formatJobMessage(job, score);

      const sent = await sendTelegramMessage(config, message);
      if (sent) {
        totalSent++;
        console.log(`  Отправлена: ${job.title}`);
      }
    }
  }

  saveSeenJobs(config.PATHS.SEEN_JOBS_FILE, seenJobs);

  console.log(
    `Готово. Найдено: ${totalFound}, новых: ${totalNew}, отправлено в Telegram: ${totalSent}`
  );
}

main().catch((err) => {
  console.error("Критическая ошибка:", err);
  process.exit(1);
});
