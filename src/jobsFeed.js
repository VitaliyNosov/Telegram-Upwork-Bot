const fs = require("fs");
const path = require("path");

const MAX_FEED_ITEMS = 150; // Храним последние 150 вакансий

/**
 * Загружает существующую ленту вакансий из JSON-файла
 */
function loadJobsFeed(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return [];
  }

  try {
    const content = fs.readFileSync(resolved, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`[JobsFeed] Ошибка чтения ленты (${resolved}):`, err.message);
    return [];
  }
}

/**
 * Форматирует и добавляет вакансию в ленту с сохранением полной структуры Upwork
 */
function addJobToFeed(feed, job, score = 0, coverLetter = null) {
  const jobLinkId = job.ciphertext || (String(job.id).startsWith("~") ? job.id : `~02${job.id}`);
  const jobUrl = `https://www.upwork.com/jobs/${jobLinkId}`;
  const applyUrl = `https://www.upwork.com/ab/proposals/job/${jobLinkId}/apply/`;

  const isHourly = (job.hourlyBudgetMin > 0 || job.hourlyBudgetMax > 0);
  const budgetDisplay = isHourly
    ? `$${job.hourlyBudgetMin || 0} - $${job.hourlyBudgetMax || 0}/hr`
    : "Fixed-price";

  // Извлекаем имена навыков в виде простого массива строк
  const skills = Array.isArray(job.skills)
    ? job.skills.map((s) => s.name || String(s)).filter(Boolean)
    : [];

  const feedItem = {
    id: String(job.id),
    ciphertext: jobLinkId,
    title: job.title || "Untitled Job",
    description: (job.description || "").trim(),
    isHourly,
    hourlyBudgetMin: job.hourlyBudgetMin || 0,
    hourlyBudgetMax: job.hourlyBudgetMax || 0,
    budgetDisplay,
    client: {
      country: job.client?.location?.country || "Unknown",
      totalFeedback: job.client?.totalFeedback || 0,
      verificationStatus: job.client?.verificationStatus || "UNVERIFIED",
      totalPostedJobs: job.client?.totalPostedJobs || 0,
      avgHourlyRatePaid: job.client?.avgHourlyRatePaid || 0,
    },
    skills,
    score: score || 0,
    coverLetter: coverLetter ? coverLetter.trim() : null,
    publishedDateTime: job.publishedDateTime || new Date().toISOString(),
    addedAt: new Date().toISOString(),
    url: jobUrl,
    applyUrl,
  };

  // Проверяем, нет ли уже этой вакансии в ленте
  const existingIdx = feed.findIndex((item) => item.id === feedItem.id);
  if (existingIdx !== -1) {
    feed[existingIdx] = feedItem; // Обновляем данные
  } else {
    feed.unshift(feedItem); // Новые вакансии добавляем в начало ленты
  }

  // Ограничиваем размер ленты последними 150 вакансиями
  if (feed.length > MAX_FEED_ITEMS) {
    feed.length = MAX_FEED_ITEMS;
  }

  return feed;
}

/**
 * Сохраняет ленту вакансий в JSON-файл
 */
function saveJobsFeed(filePath, feed) {
  const resolved = path.resolve(filePath);
  try {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, JSON.stringify(feed, null, 2), "utf-8");
  } catch (err) {
    console.error(`[JobsFeed] Ошибка сохранения ленты (${resolved}):`, err.message);
  }
}

module.exports = {
  loadJobsFeed,
  addJobToFeed,
  saveJobsFeed,
};
