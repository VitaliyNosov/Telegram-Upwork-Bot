// Отправка сообщений в Telegram
const config = require("./config");

async function sendTelegramMessage(config, text) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });

      if (resp.ok) return true;

      const errText = await resp.text();
      console.error(`Попытка ${attempt}: Telegram API вернул ошибку:`, errText);
    } catch (err) {
      console.error(`Попытка ${attempt}: сетевая ошибка при отправке в Telegram:`, err.message);
    }

    if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
  }

  console.error("Не удалось отправить сообщение в Telegram после 2 попыток.");
  return false;
}

function formatJobMessage(job, score, coverLetter = null) {
  const isHourly = job.hourlyBudgetMin > 0 || job.hourlyBudgetMax > 0;
  const budgetLine = isHourly
    ? `💰 Hourly: $${job.hourlyBudgetMin}-$${job.hourlyBudgetMax}/hr`
    : `💰 Budget: >= $${config.FILTERS.MIN_FIXED_BUDGET} (fixed-price)`;

  const country = job.client?.location?.country || "Unknown";
  const rating = job.client?.totalFeedback ? job.client.totalFeedback.toFixed(2) : "N/A";
  const verified = job.client?.verificationStatus === "VERIFIED" ? "✅ Verified" : "⚠️ Unverified";
  const postedJobs = job.client?.totalPostedJobs ?? "N/A";
  
  const avgHourlyRate = job.client?.avgHourlyRatePaid
    ? `$${job.client.avgHourlyRatePaid.toFixed(2)}/hr`
    : "N/A";

  const tagsLine = job.skills && job.skills.length > 0
    ? `🏷️ <b>Tags:</b> ${escapeHtml(job.skills.map(s => s.name || s).slice(0, 8).join(", "))}\n`
    : "";

  const jobLinkId = job.ciphertext || (String(job.id).startsWith("~") ? job.id : `~02${job.id}`);
  const jobUrl = `https://www.upwork.com/jobs/${jobLinkId}`;

  let description = (job.description || "").trim();
  if (description.length > 300) {
    description = description.slice(0, 300) + "...";
  }

  let msg =
    `🔔 <b>[Score: ${score}]</b> ${escapeHtml(job.title)}\n` +
    `${budgetLine}\n` +
    `💵 Client Avg Paid: <b>${avgHourlyRate}</b>\n` +
    `🌍 ${escapeHtml(country)} | ⭐ ${rating} | ${verified} | 📋 ${postedJobs} jobs\n` +
    `${tagsLine}\n` +
    `${escapeHtml(description)}\n\n`;

  if (coverLetter) {
    msg += `🤖 <b>AI Cover Letter Draft:</b>\n<code>${escapeHtml(coverLetter.trim())}</code>\n\n`;
  }

  msg += `🔗 ${jobUrl}`;

  // Защита от превышения лимита Telegram (4096 символов)
  if (msg.length > 4000) {
    const excess = msg.length - 3950;
    if (coverLetter && coverLetter.length > excess + 50) {
      const trimmedLetter = coverLetter.slice(0, coverLetter.length - excess - 20) + "...";
      msg =
        `🔔 <b>[Score: ${score}]</b> ${escapeHtml(job.title)}\n` +
        `${budgetLine}\n` +
        `💵 Client Avg Paid: <b>${avgHourlyRate}</b>\n` +
        `🌍 ${escapeHtml(country)} | ⭐ ${rating} | ${verified} | 📋 ${postedJobs} jobs\n` +
        `${tagsLine}\n\n` +
        `🤖 <b>AI Cover Letter Draft:</b>\n<code>${escapeHtml(trimmedLetter.trim())}</code>\n\n` +
        `🔗 ${jobUrl}`;
    }
  }

  return msg;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { sendTelegramMessage, formatJobMessage };
