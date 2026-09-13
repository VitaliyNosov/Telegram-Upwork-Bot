const fs = require("fs");
const path = require("path");
const config = require("./config");
const { getAccessToken } = require("./auth");
const { fetchJobsForKeyword } = require("./upwork");
const { passesFilters } = require("./filters");
const { calculateScore } = require("./scoring");
const { generateCoverLetter } = require("./gemini");
const {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  formatJobMessage,
  buildJobKeyboard,
  buildDigestKeyboard,
  formatDigestPhotoCaption,
} = require("./telegram");
const { generateDailyPdfReport } = require("./pdfReport");
const { loadSeenJobs, saveSeenJobs } = require("./seenJobs");
const {
  loadDailyStats,
  recordJobScanned,
  saveDailyStats,
  shouldSendDigest,
  markDigestSent,
} = require("./analytics");
const { loadJobsFeed, addJobToFeed, saveJobsFeed } = require("./jobsFeed");

async function main() {
  console.log(`[${new Date().toISOString()}] Запуск опроса Upwork...`);

  const accessToken = await getAccessToken(config);
  const seenJobs = loadSeenJobs(config.PATHS.SEEN_JOBS_FILE);
  const dailyStats = loadDailyStats(config.PATHS.DAILY_STATS_FILE);
  const jobsFeed = loadJobsFeed(config.PATHS.JOBS_FEED_FILE);

  let totalFound = 0;
  let totalNew = 0;
  let totalSent = 0;

  for (const keyword of config.KEYWORDS) {
    console.log(`Ищу по ключевому слову: "${keyword}"`);

    let jobs;
    try {
      jobs = await fetchJobsForKeyword(accessToken, keyword, config.FILTERS);
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

      let score = 0;
      if (pass) {
        score = calculateScore(job, config.KEYWORDS, config.SCORING_WEIGHTS);
      }

      // Фиксируем вакансию в статистике дня
      recordJobScanned(dailyStats, job, pass, keyword, score);

      if (!pass) {
        console.log(`  Пропущена (${reason}): ${job.title}`);
        continue;
      }

      let coverLetter = null;
      try {
        coverLetter = await generateCoverLetter(job);
      } catch (err) {
        console.error(`  [Gemini] Ошибка генерации Cover Letter для "${job.title}":`, err.message);
      }

      // Добавляем вакансию в ленту Mini App
      addJobToFeed(jobsFeed, job, score, coverLetter);

      const message = formatJobMessage(job, score, coverLetter);

      const jobLinkId = job.ciphertext || (String(job.id).startsWith("~") ? job.id : `~02${job.id}`);
      const jobUrl = `https://www.upwork.com/jobs/${jobLinkId}`;
      const keyboard = buildJobKeyboard(jobUrl, jobLinkId);

      const sent = await sendTelegramMessage(config, message, keyboard);
      if (sent) {
        totalSent++;
        console.log(`  Отправлена: ${job.title}`);
      }
    }
  }

  // Проверяем, наступило ли время вечернего PDF-отчета (по умолчанию 22:00)
  if (shouldSendDigest(dailyStats, config.DIGEST_HOUR || 22)) {
    console.log(`[Analytics] Формирование вечернего PDF-отчета за день (${dailyStats.date})...`);
    try {
      const { buffer, filename } = await generateDailyPdfReport(dailyStats, jobsFeed);

      // Выбираем вакансии за сегодняшний день (из stats.topJobs и по дате)
      const topJobUrls = new Set((dailyStats?.topJobs || []).map((j) => j.url).filter(Boolean));
      const matchedFromTop = jobsFeed.filter((j) => topJobUrls.has(j.url));
      const matchedByDate = jobsFeed.filter((j) => {
        if (j.deleted || topJobUrls.has(j.url)) return false;
        const pubDate = j.publishedDateTime ? j.publishedDateTime.slice(0, 10) : "";
        const addDate = j.addedAt ? j.addedAt.slice(0, 10) : "";
        return pubDate === dailyStats?.date || addDate === dailyStats?.date;
      });
      const displayJobs = [...matchedFromTop, ...matchedByDate];
      const proposalsCount = displayJobs.filter((j) => j.coverLetter).length;
      const topScore = displayJobs.length > 0
        ? Math.max(...displayJobs.map((j) => j.score || 0))
        : (dailyStats?.topJobs?.[0]?.score || 0);

      const caption = formatDigestPhotoCaption(dailyStats, topScore, proposalsCount);
      const pdfWebUrl = `${config.PAGES_BASE_URL}/reports/${filename}`;
      const miniAppUrl = `${config.PAGES_BASE_URL}/`;
      const keyboard = buildDigestKeyboard(pdfWebUrl, miniAppUrl);

      // 1. Отправляем обложку с кратким итогом дня
      const coverPath = path.resolve(config.PATHS.COVER_IMAGE_FILE || "img-git/digest-cover.png");
      if (fs.existsSync(coverPath)) {
        await sendTelegramPhoto(config, coverPath, caption, keyboard);
      }

      // 2. Отправляем сам сгенерированный PDF-документ прямо в чат
      const docSent = await sendTelegramDocument(config, buffer, filename, `📄 ${filename}`, keyboard);
      if (docSent) {
        markDigestSent(dailyStats);
        console.log(`[Analytics] Вечерний PDF-отчет (${filename}) успешно отправлен в Telegram.`);
      }
    } catch (err) {
      console.error("[Analytics] Ошибка формирования или отправки PDF-отчета:", err.message);
    }
  }

  saveSeenJobs(config.PATHS.SEEN_JOBS_FILE, seenJobs);
  saveDailyStats(config.PATHS.DAILY_STATS_FILE, dailyStats);
  saveDailyStats(config.PATHS.WEBAPP_STATS_FILE, dailyStats);
  saveDailyStats(config.PATHS.DOCS_STATS_FILE, dailyStats);
  saveJobsFeed(config.PATHS.JOBS_FEED_FILE, jobsFeed);
  saveJobsFeed(config.PATHS.WEBAPP_FEED_FILE, jobsFeed);
  saveJobsFeed(config.PATHS.DOCS_FEED_FILE, jobsFeed);

  console.log(
    `Готово. Найдено: ${totalFound}, новых: ${totalNew}, отправлено в Telegram: ${totalSent}, вакансий в ленте Mini App: ${jobsFeed.length}`
  );
}

main().catch((err) => {
  console.error("Критическая ошибка:", err);
  process.exit(1);
});
