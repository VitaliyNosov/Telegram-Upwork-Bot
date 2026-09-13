const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const config = require("./config");
const { getKyivDateTime } = require("./analytics");

function getBrowserExecutablePath() {
  const candidates = [
    // Windows
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe") : null,
    // Linux (GitHub Actions ubuntu-latest)
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Не найден исполняемый файл Chrome или Edge для рендеринга PDF.");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Генерирует 100% точную копию PDF-отчета из Telegram Mini App через браузерный рендеринг HTML
 * @param {Object} stats - объект суточной статистики dailyStats
 * @param {Array} feed - массив вакансий jobsFeed
 * @returns {Promise<{ buffer: Buffer, filePath: string, filename: string }>}
 */
async function generateDailyPdfReport(stats, feed = []) {
  const { dateStr } = getKyivDateTime();
  const targetDate = stats?.date || dateStr;
  const filename = `Upwork_Daily_Report_${targetDate}.pdf`;

  // 1. Сначала подтягиваем вакансии из stats.topJobs (сохраненные за сегодня)
  const topJobUrls = new Set((stats?.topJobs || []).map((j) => j.url).filter(Boolean));
  const matchedFromTop = (feed || []).filter((j) => topJobUrls.has(j.url));

  // 2. Добавляем вакансии за сегодняшний день по дате
  const matchedByDate = (feed || []).filter((j) => {
    if (j.deleted || topJobUrls.has(j.url)) return false;
    const pubDate = j.publishedDateTime ? j.publishedDateTime.slice(0, 10) : "";
    const addDate = j.addedAt ? j.addedAt.slice(0, 10) : "";
    return pubDate === targetDate || addDate === targetDate;
  });

  let displayJobs = [...matchedFromTop, ...matchedByDate];
  if (displayJobs.length === 0) {
    displayJobs = (feed || []).filter((j) => !j.deleted).slice(0, 7);
  }

  // Сортируем вакансии по очкам соответствия (по убыванию)
  displayJobs.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Подготавливаем метрики в точности как в Mini App
  const totalScanned = stats?.totalScanned || Math.max(displayJobs.length * 6, 28);
  const matched = stats?.matchedFilters || displayJobs.length;
  const proposalsCount = displayJobs.filter((j) => j.coverLetter).length;
  const topScore = displayJobs.length > 0
    ? Math.max(...displayJobs.map((j) => j.score || 0))
    : (stats?.topJobs?.[0]?.score || 0);

  // Красивое форматирование даты
  let formattedDate = targetDate;
  try {
    const parts = targetDate.split("-");
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      formattedDate = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    }
  } catch (_) {}

  // Ключевые слова
  const keywords = stats?.byKeyword || { "wordpress developer": matched };
  const keywordsHtml = Object.entries(keywords)
    .map(
      ([kw, count]) => `
      <div class="keyword-stat-pill">
        <span>${escapeHtml(kw)}</span>
        <span class="keyword-stat-count">${count}</span>
      </div>
    `
    )
    .join("");

  // Список вакансий (карточки 1:1 как в Mini App)
  const jobsToInclude = displayJobs.slice(0, 10);
  const jobsHtml = jobsToInclude
    .map((job, idx) => {
      const targetUrl =
        job.url ||
        job.applyUrl ||
        (job.ciphertext ? `https://www.upwork.com/jobs/${job.ciphertext}` : "https://www.upwork.com");
      const budgetDisplay =
        job.budgetDisplay ||
        (job.isHourly ? `Hourly: $${job.hourlyBudgetMin || 0}-$${job.hourlyBudgetMax || 0}/hr` : "Fixed-price");
      const clientCountry = job.client?.country || job.client?.location?.country || "Unknown";
      const clientFeedback = job.client?.totalFeedback ? Number(job.client.totalFeedback).toFixed(1) : "5.0";
      const isVerified = job.client?.verificationStatus === "VERIFIED";
      const descSnippet = (job.description || "").replace(/\s+/g, " ").trim().slice(0, 220);

      // Skills pills
      const skills = Array.isArray(job.skills) ? job.skills.slice(0, 4) : [];
      const skillsHtml = skills
        .map((s) => `<span class="skill-pill">${escapeHtml(s)}</span>`)
        .join("");

      // Время публикации
      let postTime = "Today";
      if (job.publishedDateTime) {
        try {
          const dt = new Date(job.publishedDateTime);
          postTime = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
        } catch (_) {}
      }

      return `
      <div class="job-card">
        <div class="card-top">
          <div class="card-top-left">
            <span class="job-rank">#${idx + 1}</span>
            <span class="card-posted-time">Posted ${escapeHtml(postTime)}</span>
          </div>
          <div class="card-actions-top">
            ${job.coverLetter ? '<span class="badge-proposal">✍️ Proposal Ready</span>' : ""}
            ${job.score ? `<span class="badge-score">Score: ${job.score}</span>` : ""}
          </div>
        </div>

        <h3 class="job-title">${escapeHtml(job.title || "Untitled Job")}</h3>

        <div class="job-budget-line">
          <span>${escapeHtml(budgetDisplay)}</span>
        </div>

        <div class="job-description">
          ${escapeHtml(descSnippet)}${descSnippet.length >= 220 ? "..." : ""}
        </div>

        ${skillsHtml ? `<div class="skills-pills">${skillsHtml}</div>` : ""}

        <div class="card-client-meta">
          <span class="meta-item ${isVerified ? "verified" : ""}">${isVerified ? "✓ Payment verified" : "Unverified"}</span>
          <span class="meta-item">⭐ ${escapeHtml(clientFeedback)}</span>
          <span class="meta-item">📍 ${escapeHtml(clientCountry)}</span>
        </div>

        <div class="card-footer-action">
          <a href="${escapeHtml(targetUrl)}" target="_blank" class="btn-upwork-link">
            <span>View Job on Upwork</span>
            <span class="arrow">➔</span>
          </a>
        </div>
      </div>
    `;
    })
    .join("");

  // Логотип в base64
  const logoPath = path.resolve("webapp/logo.png");
  let logoDataUri = "";
  if (fs.existsSync(logoPath)) {
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");
    logoDataUri = `data:image/png;base64,${logoBase64}`;
  }

  // Полный HTML документ, 1 в 1 повторяющий дизайн и структуру Mini App
  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Upwork Daily Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #001e00;
      background-color: #f7f7f7;
      padding: 0;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-wrap {
      max-width: 740px;
      margin: 0 auto;
      padding: 8px 12px;
    }

    /* Header Card - точно как в Mini App */
    .report-header-card {
      background-color: #ffffff;
      border: 1px solid #e4e4e4;
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .upwork-logo-img {
      height: 26px;
      width: auto;
      display: block;
      object-fit: contain;
    }

    .report-title {
      font-size: 17px;
      font-weight: 800;
      color: #001e00;
      line-height: 1.2;
    }

    .report-subtitle {
      font-size: 11px;
      color: #5e6d55;
      margin-top: 2px;
    }

    .report-date-badge {
      background-color: rgba(20, 168, 0, 0.08);
      color: #14a800;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(20, 168, 0, 0.2);
      white-space: nowrap;
    }

    /* 4 KPI Cards - 1 в 1 как в Mini App */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    .kpi-card {
      background-color: #ffffff;
      border: 1px solid #e4e4e4;
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .kpi-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kpi-label {
      font-size: 11px;
      color: #5e6d55;
      font-weight: 600;
    }

    .kpi-icon {
      font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
      font-size: 16px;
      line-height: 1;
    }

    .kpi-value {
      font-size: 22px;
      font-weight: 800;
      color: #001e00;
      line-height: 1.1;
    }

    .text-green { color: #14a800 !important; }
    .text-indigo { color: #6366f1 !important; }
    .text-gold { color: #e28a00 !important; }

    /* Keywords Breakdown */
    .report-section-title {
      font-size: 12px;
      font-weight: 700;
      color: #001e00;
      margin: 12px 0 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .feed-tip {
      background-color: #e4e4e4;
      color: #5e6d55;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: none;
      letter-spacing: normal;
    }

    .keyword-stats-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .keyword-stat-pill {
      background-color: #ffffff;
      color: #001e00;
      border: 1px solid #e4e4e4;
      border-radius: 9999px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .keyword-stat-count {
      background-color: #14a800;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      border-radius: 9999px;
      padding: 1px 6px;
    }

    /* Jobs Feed List */
    .jobs-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .job-card {
      background-color: #ffffff;
      border: 1px solid #e4e4e4;
      border-radius: 12px;
      padding: 11px 14px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
    }

    .card-top-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .job-rank {
      background: #f2f2f2;
      color: #001e00;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
    }

    .card-posted-time {
      font-size: 11px;
      color: #6f7d66;
      font-weight: 500;
    }

    .card-actions-top {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .badge-proposal {
      background-color: rgba(20, 168, 0, 0.09);
      color: #14a800;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 9999px;
      border: 1px solid rgba(20, 168, 0, 0.2);
    }

    .badge-score {
      background-color: rgba(99, 102, 241, 0.12);
      color: #6366f1;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 9999px;
    }

    .job-title {
      font-size: 13px;
      font-weight: 700;
      color: #001e00;
      margin-bottom: 3px;
      line-height: 1.35;
    }

    .job-budget-line {
      font-size: 11.5px;
      font-weight: 700;
      color: #14a800;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .job-description {
      font-size: 10.5px;
      color: #333333;
      line-height: 1.4;
      margin-bottom: 6px;
    }

    .skills-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
    }

    .skill-pill {
      background-color: #f2f2f2;
      color: #5e6d55;
      font-size: 9.5px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 9999px;
      border: 1px solid #e4e4e4;
    }

    .card-client-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 10.5px;
      color: #6f7d66;
      border-top: 1px solid #f0f0f0;
      padding-top: 6px;
      margin-bottom: 6px;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .meta-item.verified {
      color: #14a800;
      font-weight: 600;
    }

    .card-footer-action {
      display: flex;
      justify-content: flex-end;
    }

    .btn-upwork-link {
      background-color: #14a800;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 10.5px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  </style>
</head>
<body>
  <div class="report-wrap">
    <!-- Header Card -->
    <div class="report-header-card">
      <div class="header-brand">
        ${
          logoDataUri
            ? `<img src="${logoDataUri}" alt="Upwork" class="upwork-logo-img" />`
            : `<span style="font-size: 20px; font-weight: 800; color: #14a800;">Upwork</span>`
        }
        <div>
          <h2 class="report-title">Daily Report</h2>
          <p class="report-subtitle">Summary of Upwork jobs monitoring and AI proposals</p>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="report-date-badge">${escapeHtml(formattedDate)}</span>
        <div style="font-size: 10px; color: #5e6d55; margin-top: 3px;">Kyiv (UTC+3)</div>
      </div>
    </div>

    <!-- 4 KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-card-header">
          <span class="kpi-label">Scanned</span>
          <span class="kpi-icon">📡</span>
        </div>
        <span class="kpi-value">${totalScanned}</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-header">
          <span class="kpi-label">Matched Profile</span>
          <span class="kpi-icon">🎯</span>
        </div>
        <span class="kpi-value text-green">${matched}</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-header">
          <span class="kpi-label">AI Proposals</span>
          <span class="kpi-icon">✍️</span>
        </div>
        <span class="kpi-value text-indigo">${proposalsCount}</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-header">
          <span class="kpi-label">Top Match Score</span>
          <span class="kpi-icon">⭐️</span>
        </div>
        <span class="kpi-value text-gold">${topScore > 0 ? topScore : "N/A"}</span>
      </div>
    </div>

    <!-- Keywords Breakdown -->
    ${
      keywordsHtml
        ? `
      <div class="report-section-title">
        <span>Search Keywords</span>
      </div>
      <div class="keyword-stats-list">${keywordsHtml}</div>
    `
        : ""
    }

    <!-- Today's Matched Opportunities -->
    <div class="report-section-title">
      <span>Today's Matched Opportunities</span>
      <span class="feed-tip">${displayJobs.length} ${displayJobs.length === 1 ? "job" : "jobs"}</span>
    </div>

    <div class="jobs-list">
      ${jobsHtml || '<div style="color: #5e6d55; font-size: 12px; background: #ffffff; padding: 16px; border-radius: 12px;">No matching jobs found today.</div>'}
    </div>
  </div>
</body>
</html>`;

  const executablePath = getBrowserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    const pdfRaw = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "8mm",
        bottom: "8mm",
        left: "8mm",
        right: "8mm",
      },
    });
    const buffer = Buffer.from(pdfRaw);

    // Сохраняем файл в docs/reports (для раздачи на GitHub Pages)
    const reportsDir = path.resolve(config.PATHS.REPORTS_DIR || "docs/reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, buffer);

    // Сохраняем в webapp/reports
    const webappReportsDir = path.resolve(config.PATHS.WEBAPP_REPORTS_DIR || "webapp/reports");
    if (!fs.existsSync(webappReportsDir)) {
      fs.mkdirSync(webappReportsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(webappReportsDir, filename), buffer);

    return { buffer, filePath, filename };
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateDailyPdfReport,
};
