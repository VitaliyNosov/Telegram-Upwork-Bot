/**
 * Скрипт для тестирования генерации вечернего PDF-отчета и отправки в Telegram
 * 
 * Запуск:
 *   node scripts/test-pdf-digest.js
 */

const fs = require("fs");
const path = require("path");
const config = require("../src/config");
const { generateDailyPdfReport } = require("../src/pdfReport");
const {
  sendTelegramPhoto,
  sendTelegramDocument,
  buildDigestKeyboard,
  formatDigestPhotoCaption,
} = require("../src/telegram");

async function run() {
  console.log("=== ТЕСТИРОВАНИЕ ВЕЧЕРНЕГО PDF-ОТЧЕТА ===");

  const statsPath = path.resolve(config.PATHS.DAILY_STATS_FILE || "data/daily_stats.json");
  const feedPath = path.resolve(config.PATHS.JOBS_FEED_FILE || "data/jobs_feed.json");

  const dailyStats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, "utf-8")) : { totalScanned: 25, matchedFilters: 5, date: "2026-09-13" };
  const jobsFeed = fs.existsSync(feedPath) ? JSON.parse(fs.readFileSync(feedPath, "utf-8")) : [];

  console.log(`Дата отчета: ${dailyStats.date}`);
  console.log(`Вакансий в ленте: ${jobsFeed.length}`);
  console.log("Генерация PDF-отчета...");

  const startTime = Date.now();
  const { buffer, filePath, filename } = await generateDailyPdfReport(dailyStats, jobsFeed);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ PDF успешно сгенерирован за ${duration} сек!`);
  console.log(`Файл: ${filePath}`);
  console.log(`Размер файла: ${buffer.length} байт`);

  const activeJobs = jobsFeed.filter(
    (j) => !dailyStats?.date || !j.publishedDateTime || j.publishedDateTime.slice(0, 10) === dailyStats.date
  );
  const displayJobs = activeJobs.length > 0 ? activeJobs : jobsFeed;
  const proposalsCount = displayJobs.filter((j) => j.coverLetter).length;
  const topScore = Math.max(0, ...displayJobs.map((j) => j.score || 0));

  const caption = formatDigestPhotoCaption(dailyStats, topScore, proposalsCount);
  const pdfWebUrl = `${config.PAGES_BASE_URL}/reports/${filename}`;
  const miniAppUrl = `${config.PAGES_BASE_URL}/`;
  const keyboard = buildDigestKeyboard(pdfWebUrl, miniAppUrl);

  console.log("\n=== ТЕКСТ ПОДПИСИ К ОБЛОЖКЕ ===");
  console.log(caption);
  console.log("===============================");
  console.log("Инлайн-кнопки:", JSON.stringify(keyboard.inline_keyboard));

  const hasTelegramAuth = Boolean(config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID);
  if (!hasTelegramAuth) {
    console.log("\n⚠️ TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы локально.");
    console.log("Локальный тест генерации PDF прошел успешно! Для отправки в чат требуются переменные окружения.");
    return;
  }

  console.log("\nОтправка тестового отчета в Telegram...");
  const coverPath = path.resolve(config.PATHS.COVER_IMAGE_FILE || "img-git/digest-cover.png");
  if (fs.existsSync(coverPath)) {
    console.log("Отправка обложки...");
    await sendTelegramPhoto(config, coverPath, caption, keyboard);
  }

  console.log("Отправка PDF-документа в чат...");
  const docSent = await sendTelegramDocument(config, buffer, filename, `📄 ${filename}`, keyboard);
  if (docSent) {
    console.log("🎉 PDF-отчет успешно доставлен в Telegram!");
  } else {
    console.error("❌ Не удалось доставить PDF-отчет в Telegram.");
  }
}

run().catch((err) => {
  console.error("Ошибка теста:", err);
  process.exit(1);
});
