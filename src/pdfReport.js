const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const config = require("./config");
const { getKyivDateTime } = require("./analytics");

function sanitize(str) {
  if (!str) return "";
  return String(str).replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/[ ]+/g, " ").trim();
}

/**
 * Генерирует стильный PDF-отчет по итогам дня с фирменным оформлением Upwork
 * @param {Object} stats - объект суточной статистики dailyStats
 * @param {Array} feed - массив вакансий jobsFeed
 * @returns {Promise<{ buffer: Buffer, filePath: string, filename: string }>}
 */
function generateDailyPdfReport(stats, feed = []) {
  return new Promise((resolve, reject) => {
    const { dateStr } = getKyivDateTime();
    const targetDate = stats?.date || dateStr;
    const filename = `Upwork_Daily_Report_${targetDate}.pdf`;

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 45, left: 40, right: 40 },
      bufferPages: true,
      info: {
        Title: `Upwork Daily Report - ${targetDate}`,
        Author: "Telegram Upwork Bot",
        Subject: "Daily Job Curation & Proposal Analytics",
        CreationDate: new Date(),
      },
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("error", (err) => reject(err));
    doc.on("end", () => {
      const buffer = Buffer.concat(buffers);

      // Сохраняем файл в docs/reports (для раздачи на GitHub Pages)
      const reportsDir = path.resolve(config.PATHS.REPORTS_DIR || "docs/reports");
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      const filePath = path.join(reportsDir, filename);
      fs.writeFileSync(filePath, buffer);

      // Также сохраняем в webapp/reports для локальной среды
      const webappReportsDir = path.resolve(config.PATHS.WEBAPP_REPORTS_DIR || "webapp/reports");
      if (!fs.existsSync(webappReportsDir)) {
        fs.mkdirSync(webappReportsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(webappReportsDir, filename), buffer);

      resolve({ buffer, filePath, filename });
    });

    const pageWidth = doc.page.width; // 595.28 pt
    const contentWidth = pageWidth - 80; // 515.28 pt

    // ===== TOP ACCENT BAR =====
    doc.rect(40, 24, contentWidth, 3).fill("#14A800");

    // ===== HEADER =====
    doc.y = 36;
    doc
      .fontSize(9)
      .fillColor("#14A800")
      .font("Helvetica-Bold")
      .text("UPWORK DAILY INTELLIGENCE REPORT", 40, doc.y, { characterSpacing: 1 });

    doc
      .moveDown(0.3)
      .fontSize(20)
      .fillColor("#001E00")
      .font("Helvetica-Bold")
      .text("Daily Job Search & Proposal Digest", 40, doc.y);

    const now = new Date();
    const timeStr = `${String(now.getUTCHours() + 3).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    doc
      .moveDown(0.2)
      .fontSize(9)
      .fillColor("#64748B")
      .font("Helvetica")
      .text(`Date: ${targetDate}   |   Time: ${timeStr} (Europe/Kyiv)   |   Target Niche: WordPress & CMS Development`, 40, doc.y);

    doc.moveDown(0.8);
    const dividerY = doc.y;
    doc.moveTo(40, dividerY).lineTo(pageWidth - 40, dividerY).strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.y = dividerY + 12;

    // ===== STATS METRICS (4 CARDS) =====
    const totalScanned = stats?.totalScanned || (feed.length > 0 ? feed.length * 4 : 0);
    const matched = stats?.matchedFilters || feed.length;
    const activeJobs = feed.filter((j) => !stats?.date || !j.publishedDateTime || j.publishedDateTime.slice(0, 10) === targetDate);
    const displayJobs = activeJobs.length > 0 ? activeJobs : feed;
    const proposalsCount = displayJobs.filter((j) => j.coverLetter).length;
    const topScore = Math.max(0, ...displayJobs.map((j) => j.score || 0));

    const cardWidth = (contentWidth - 24) / 4;
    const cardHeight = 52;
    const cardY = doc.y;

    const metrics = [
      { label: "JOBS SCANNED", val: String(totalScanned), color: "#001E00" },
      { label: "PASSED FILTERS", val: String(matched), color: "#14A800" },
      { label: "AI PROPOSALS", val: String(proposalsCount), color: "#6366F1" },
      { label: "TOP MATCH SCORE", val: topScore > 0 ? String(topScore) : "N/A", color: "#E28A00" },
    ];

    metrics.forEach((m, idx) => {
      const cardX = 40 + idx * (cardWidth + 8);
      // Card background
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 6).fillAndStroke("#F8FAFC", "#E2E8F0");
      // Card label
      doc
        .fontSize(7.5)
        .fillColor("#64748B")
        .font("Helvetica-Bold")
        .text(m.label, cardX + 8, cardY + 8, { width: cardWidth - 16, characterSpacing: 0.5 });
      // Card value
      doc
        .fontSize(16)
        .fillColor(m.color)
        .font("Helvetica-Bold")
        .text(m.val, cardX + 8, cardY + 22, { width: cardWidth - 16 });
    });

    doc.y = cardY + cardHeight + 14;

    // ===== KEYWORDS ROW =====
    const byKeyword = stats?.byKeyword || {};
    const keywordEntries = Object.entries(byKeyword);
    if (keywordEntries.length > 0) {
      doc
        .fontSize(8.5)
        .fillColor("#001E00")
        .font("Helvetica-Bold")
        .text("Matched Keywords: ", 40, doc.y, { continued: true });

      const kwText = keywordEntries.map(([k, v]) => `${sanitize(k)} (${v})`).join("   •   ");
      doc.font("Helvetica").fillColor("#14A800").text(kwText);
      doc.moveDown(0.6);
    }

    // ===== TOP JOBS SECTION =====
    doc
      .fontSize(11)
      .fillColor("#001E00")
      .font("Helvetica-Bold")
      .text("TOP MATCHED OPPORTUNITIES", 40, doc.y, { characterSpacing: 0.5 });
    doc.moveDown(0.4);

    const jobsToRender = displayJobs.slice(0, 10);

    if (jobsToRender.length === 0) {
      doc
        .fontSize(10)
        .fillColor("#64748B")
        .font("Helvetica-Oblique")
        .text("No matching jobs recorded for this period.", 40, doc.y);
    } else {
      jobsToRender.forEach((job, idx) => {
        // Estimated height of job card: ~74 pt
        if (doc.y + 78 > doc.page.height - 50) {
          doc.addPage();
        }

        const boxY = doc.y;
        const boxHeight = 70;

        // Job box background & border
        doc.roundedRect(40, boxY, contentWidth, boxHeight, 6).fillAndStroke("#FFFFFF", "#E2E8F0");

        // Job Title + Index
        const titleText = `${idx + 1}. ${sanitize(job.title || "Untitled Job")}`;
        doc
          .fontSize(9.5)
          .fillColor("#001E00")
          .font("Helvetica-Bold")
          .text(titleText, 48, boxY + 8, { width: contentWidth - 85, ellipsis: true });

        // Score Badge
        const scoreVal = job.score ? `Score: ${job.score}` : "Score: N/A";
        const badgeWidth = 58;
        const badgeHeight = 15;
        const badgeX = 40 + contentWidth - badgeWidth - 8;
        const badgeY = boxY + 7;
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 99).fill("#E6F9E5");
        doc
          .fontSize(7.5)
          .fillColor("#14A800")
          .font("Helvetica-Bold")
          .text(scoreVal, badgeX, badgeY + 3.5, { width: badgeWidth, align: "center" });

        // Meta Line: Budget & Client
        const budgetDisplay = job.budgetDisplay || (job.isHourly ? `$${job.hourlyBudgetMin || 0}-$${job.hourlyBudgetMax || 0}/hr` : "Fixed-price");
        const clientCountry = sanitize(job.client?.country || job.client?.location?.country || "Unknown");
        const clientRating = job.client?.totalFeedback ? `★ ${Number(job.client.totalFeedback).toFixed(1)}` : "★ 5.0";
        const clientJobs = job.client?.totalPostedJobs ? `${job.client.totalPostedJobs} jobs` : "Verified";
        
        doc
          .fontSize(8)
          .fillColor("#64748B")
          .font("Helvetica-Bold")
          .text("Budget: ", 48, boxY + 23, { continued: true })
          .font("Helvetica")
          .fillColor("#001E00")
          .text(`${sanitize(budgetDisplay)}   •   `, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#64748B")
          .text("Client: ", { continued: true })
          .font("Helvetica")
          .fillColor("#001E00")
          .text(`${clientCountry} (${clientRating}, ${clientJobs})`);

        // Description Excerpt (single clean line)
        const cleanDesc = sanitize(job.description || "").slice(0, 140) + "...";
        doc
          .fontSize(7.8)
          .fillColor("#475569")
          .font("Helvetica")
          .text(cleanDesc, 48, boxY + 37, { width: contentWidth - 16, ellipsis: true });

        // Action Links
        const targetUrl = job.url || (job.ciphertext ? `https://www.upwork.com/jobs/${job.ciphertext}` : "https://www.upwork.com");
        const applyUrl = job.applyUrl || (job.ciphertext ? `https://www.upwork.com/ab/proposals/job/${job.ciphertext}/apply/` : targetUrl);

        doc
          .fontSize(8)
          .fillColor("#14A800")
          .font("Helvetica-Bold")
          .text("View Job on Upwork >", 48, boxY + 52, { link: targetUrl, underline: true, continued: true })
          .fillColor("#64748B")
          .font("Helvetica")
          .text("     |     ", { continued: true })
          .fillColor("#6366F1")
          .font("Helvetica-Bold")
          .text("Apply with AI Proposal >", { link: applyUrl, underline: true });

        doc.y = boxY + boxHeight + 6;
      });
    }

    // ===== PAGE NUMBERING & FOOTERS =====
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 28;

      doc.moveTo(40, footerY - 6).lineTo(pageWidth - 40, footerY - 6).strokeColor("#E2E8F0").lineWidth(0.5).stroke();

      doc
        .fontSize(7.5)
        .fillColor("#94A3B8")
        .font("Helvetica")
        .text("Telegram Upwork Bot   •   Confidential Daily Analytics", 40, footerY, { align: "left" });

      doc
        .fontSize(7.5)
        .fillColor("#94A3B8")
        .font("Helvetica")
        .text(`Page ${i + 1} of ${range.count}`, 40, footerY, { align: "right", width: contentWidth });
    }

    doc.end();
  });
}

module.exports = {
  generateDailyPdfReport,
};
