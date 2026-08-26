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

function formatJobMessage(job, score) {
  const isHourly = job.hourlyBudgetMin > 0 || job.hourlyBudgetMax > 0;
  const budgetLine = isHourly
    ? `💰 Hourly: $${job.hourlyBudgetMin}-$${job.hourlyBudgetMax}/hr`
    : `💰 Budget: >= $${config.FILTERS.MIN_FIXED_BUDGET} (fixed-price)`;

  const country = job.client?.location?.country || "Unknown";
  const rating = job.client?.totalFeedback ? job.client.totalFeedback.toFixed(2) : "N/A";
  const verified = job.client?.verificationStatus === "VERIFIED" ? "✅ Verified" : "⚠️ Unverified";
  const postedJobs = job.client?.totalPostedJobs ?? "N/A";

  const description = (job.description || "").slice(0, 250).trim();
  const jobLinkId = job.ciphertext || (String(job.id).startsWith("~") ? job.id : `~02${job.id}`);
  const jobUrl = `https://www.upwork.com/jobs/${jobLinkId}`;

  return (
    `🔔 <b>[Score: ${score}]</b> ${escapeHtml(job.title)}\n` +
    `${budgetLine}\n` +
    `🌍 ${escapeHtml(country)} | ⭐ ${rating} | ${verified} | 📋 ${postedJobs} posted jobs\n\n` +
    `${escapeHtml(description)}${description.length >= 250 ? "..." : ""}\n\n` +
    `🔗 ${jobUrl}`
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { sendTelegramMessage, formatJobMessage };
