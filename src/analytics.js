const fs = require("fs");
const path = require("path");

/**
 * Возвращает текущую дату (YYYY-MM-DD) и час (0-23) в таймзоне Europe/Kyiv (UTC+2/UTC+3)
 */
function getKyivDateTime() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = parseInt(map.hour, 10);
  return { dateStr, hour };
}

/**
 * Загружает статистику за текущий день из файла.
 * Если наступил новый день, сбрасывает суточные счетчики, сохраняя дату последней отправки дайджеста.
 */
function loadDailyStats(filePath) {
  const { dateStr } = getKyivDateTime();
  const defaultStats = {
    date: dateStr,
    lastDigestSentDate: null,
    totalScanned: 0,
    matchedFilters: 0,
    byKeyword: {},
    topJobs: [],
  };

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return defaultStats;
  }

  try {
    const content = fs.readFileSync(resolved, "utf-8");
    const parsed = JSON.parse(content);

    // Если файл остался с предыдущего дня — начинаем новый суточный отсчет
    if (parsed.date !== dateStr) {
      return {
        date: dateStr,
        lastDigestSentDate: parsed.lastDigestSentDate || null,
        totalScanned: 0,
        matchedFilters: 0,
        byKeyword: {},
        topJobs: [],
      };
    }

    return {
      ...defaultStats,
      ...parsed,
      byKeyword: parsed.byKeyword || {},
      topJobs: parsed.topJobs || [],
    };
  } catch (err) {
    console.error(`[Analytics] Ошибка чтения файла статистики (${resolved}):`, err.message);
    return defaultStats;
  }
}

/**
 * Фиксирует вакансию в суточной статистике
 */
function recordJobScanned(stats, job, passed, keyword, score = 0) {
  stats.totalScanned++;

  if (passed) {
    stats.matchedFilters++;

    if (keyword) {
      stats.byKeyword[keyword] = (stats.byKeyword[keyword] || 0) + 1;
    }

    const isHourly = job.hourlyBudgetMin > 0 || job.hourlyBudgetMax > 0;
    const budget = isHourly
      ? `$${job.hourlyBudgetMin}-$${job.hourlyBudgetMax}/hr`
      : "Fixed-price";

    const jobLinkId = job.ciphertext || (String(job.id).startsWith("~") ? job.id : `~02${job.id}`);
    const jobUrl = `https://www.upwork.com/jobs/${jobLinkId}`;

    // Добавляем вакансию в список лучших за день
    stats.topJobs.push({
      title: job.title || "Untitled",
      budget,
      score,
      url: jobUrl,
      addedAt: new Date().toISOString(),
    });

    // Сортируем по убыванию score и оставляем до 10 лучших
    stats.topJobs.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (stats.topJobs.length > 10) {
      stats.topJobs = stats.topJobs.slice(0, 10);
    }
  }
}

/**
 * Сохраняет статистику в JSON-файл
 */
function saveDailyStats(filePath, stats) {
  const resolved = path.resolve(filePath);
  try {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, JSON.stringify(stats, null, 2), "utf-8");
  } catch (err) {
    console.error(`[Analytics] Ошибка сохранения статистики (${resolved}):`, err.message);
  }
}

/**
 * Проверяет, пора ли отправлять вечерний дайджест
 * @param {Object} stats - объект статистики
 * @param {number} targetHour - час отправки (по умолчанию 21)
 */
function shouldSendDigest(stats, targetHour = 21) {
  const { dateStr, hour } = getKyivDateTime();

  // Если за сегодня дайджест уже отправлялся — не дублируем
  if (stats.lastDigestSentDate === dateStr) {
    return false;
  }

  // Отправляем, если наступило заданное время (например >= 21:00)
  return hour >= targetHour;
}

/**
 * Отмечает, что сегодняшний дайджест отправлен
 */
function markDigestSent(stats) {
  const { dateStr } = getKyivDateTime();
  stats.lastDigestSentDate = dateStr;
}

module.exports = {
  getKyivDateTime,
  loadDailyStats,
  recordJobScanned,
  saveDailyStats,
  shouldSendDigest,
  markDigestSent,
};
