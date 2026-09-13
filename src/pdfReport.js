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

  // Подготавливаем метрики в точности как в webapp/app.js downloadReportPDF()
  const totalScanned = stats?.totalScanned || Math.max(feed.length * 6, 28);
  const matched = stats?.matchedFilters || feed.length;
  const activeJobs = feed && feed.length > 0 ? feed.filter((j) => !j.deleted) : [];
  const proposalsCount = activeJobs.filter((j) => j.coverLetter).length;
  const topScore = Math.max(0, ...activeJobs.map((j) => j.score || 0));

  // Подготавливаем ключевые слова
  const keywords = stats?.byKeyword || { "wordpress developer": 2, "woocommerce": 1 };
  const keywordsHtml = Object.entries(keywords)
    .map(
      ([kw, count]) => `
      <span style="border: 1px solid #e4e4e4; background: #f7f7f7; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 500; color: #001e00;">
        ${escapeHtml(kw)} <strong style="color: #14a800;">(${count})</strong>
      </span>
    `
    )
    .join("");

  // Подготавливаем список топ-10 вакансий
  const jobsToInclude = activeJobs.slice(0, 10);
  const jobsHtml = jobsToInclude
    .map((job, idx) => {
      const targetUrl =
        job.url ||
        job.applyUrl ||
        (job.ciphertext ? `https://www.upwork.com/jobs/${job.ciphertext}` : "https://www.upwork.com");
      const budgetDisplay =
        job.budgetDisplay ||
        (job.isHourly ? `$${job.hourlyBudgetMin || 0}-$${job.hourlyBudgetMax || 0}/hr` : "Fixed");
      const clientCountry = job.client?.country || job.client?.location?.country || "Unknown";
      const clientFeedback = job.client?.totalFeedback ? Number(job.client.totalFeedback).toFixed(1) : "5.0";
      const descSnippet = (job.description || "").slice(0, 240);

      return `
      <div style="border: 1px solid #e4e4e4; border-radius: 8px; padding: 12px; background: #ffffff; page-break-inside: avoid; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div style="font-weight: 700; font-size: 13px; color: #001e00; line-height: 1.3;">
            ${idx + 1}. ${escapeHtml(job.title || "Untitled Job")}
          </div>
          <span style="background: #e4f7e2; color: #14a800; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px; white-space: nowrap; margin-left: 8px;">
            Score: ${job.score || "N/A"}
          </span>
        </div>
        <div style="font-size: 11px; color: #5e6d55; margin-bottom: 6px;">
          <strong>Budget:</strong> ${escapeHtml(budgetDisplay)} •
          <strong>Client:</strong> ${escapeHtml(clientCountry)} (★ ${escapeHtml(clientFeedback)})
        </div>
        <div style="font-size: 11px; color: #333333; line-height: 1.4; margin-bottom: 8px;">
          ${escapeHtml(descSnippet)}${descSnippet.length >= 240 ? "..." : ""}
        </div>
        <div style="font-size: 11px;">
          <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" style="color: #14a800; text-decoration: underline; font-weight: 700; display: inline-block;">
            View Job on Upwork ➔
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

  // Полный HTML документ, 1 в 1 повторяющий шаблон Mini App
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Upwork Daily Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      color: #001e00;
      background: #ffffff;
      padding: 0;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-wrap {
      max-width: 800px;
      margin: 0 auto;
      padding: 12px 20px;
    }
  </style>
</head>
<body>
  <div class="report-wrap">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #14a800; padding-bottom: 14px; margin-bottom: 18px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="Upwork" style="height: 26px; width: auto; display: block; object-fit: contain;" />` : `<span style="font-size: 20px; font-weight: 800; color: #14a800;">Upwork</span>`}
          <span style="font-size: 15px; color: #001e00; font-weight: 700; border-left: 2px solid #14a800; padding-left: 10px; line-height: 1;">Daily Intelligence Report</span>
        </div>
        <p style="font-size: 11px; color: #5e6d55; margin: 2px 0 0;">Automatic Upwork Bot Monitoring & AI Proposal Analytics</p>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13px; font-weight: 700; color: #001e00;">Date: ${escapeHtml(targetDate)}</div>
        <div style="font-size: 10px; color: #5e6d55; margin-top: 2px;">Timezone: Europe/Kyiv</div>
      </div>
    </div>

    <!-- 4 Stats Cards -->
    <div style="display: flex; gap: 12px; margin-bottom: 18px;">
      <div style="flex: 1; border: 1px solid #e4e4e4; border-radius: 8px; padding: 10px 12px; background: #f7f7f7;">
        <div style="font-size: 10px; color: #5e6d55; font-weight: 600; text-transform: uppercase;">TOTAL SCANNED</div>
        <div style="font-size: 20px; font-weight: 800; color: #001e00; margin-top: 4px;">${totalScanned}</div>
      </div>
      <div style="flex: 1; border: 1px solid #e4e4e4; border-radius: 8px; padding: 10px 12px; background: #f7f7f7;">
        <div style="font-size: 10px; color: #5e6d55; font-weight: 600; text-transform: uppercase;">MATCHED PROFILE</div>
        <div style="font-size: 20px; font-weight: 800; color: #14a800; margin-top: 4px;">${matched}</div>
      </div>
      <div style="flex: 1; border: 1px solid #e4e4e4; border-radius: 8px; padding: 10px 12px; background: #f7f7f7;">
        <div style="font-size: 10px; color: #5e6d55; font-weight: 600; text-transform: uppercase;">AI PROPOSALS</div>
        <div style="font-size: 20px; font-weight: 800; color: #6366f1; margin-top: 4px;">${proposalsCount}</div>
      </div>
      <div style="flex: 1; border: 1px solid #e4e4e4; border-radius: 8px; padding: 10px 12px; background: #f7f7f7;">
        <div style="font-size: 10px; color: #5e6d55; font-weight: 600; text-transform: uppercase;">TOP MATCH SCORE</div>
        <div style="font-size: 20px; font-weight: 800; color: #e28a00; margin-top: 4px;">${topScore > 0 ? topScore : "N/A"}</div>
      </div>
    </div>

    <!-- Search Keywords -->
    ${
      keywordsHtml
        ? `<div style="margin-bottom: 18px;">
        <h3 style="font-size: 12px; font-weight: 700; color: #001e00; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">SEARCH KEYWORDS:</h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${keywordsHtml}</div>
      </div>`
        : ""
    }

    <!-- Selected Jobs -->
    <div>
      <h3 style="font-size: 12px; font-weight: 700; color: #001e00; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">SELECTED JOBS FOR THE DAY:</h3>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${jobsHtml || '<div style="color: #5e6d55; font-size: 12px;">No matching jobs found today.</div>'}
      </div>
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
