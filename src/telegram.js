// Отправка сообщений в Telegram
const fs = require("fs");
const config = require("./config");

async function sendTelegramMessage(config, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const bodyPayload = {
    chat_id: config.TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  };

  if (replyMarkup) {
    bodyPayload.reply_markup = replyMarkup;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
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

async function sendTelegramPhoto(config, imagePathOrBuffer, caption = "", replyMarkup = null) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendPhoto`;

  let buffer;
  if (Buffer.isBuffer(imagePathOrBuffer)) {
    buffer = imagePathOrBuffer;
  } else if (typeof imagePathOrBuffer === "string" && fs.existsSync(imagePathOrBuffer)) {
    buffer = fs.readFileSync(imagePathOrBuffer);
  } else {
    console.error("[Telegram] Фото не найдено по пути:", imagePathOrBuffer);
    return false;
  }

  const formData = new FormData();
  formData.append("chat_id", config.TELEGRAM_CHAT_ID);
  formData.append("photo", new Blob([buffer], { type: "image/png" }), "cover.png");
  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
  }
  if (replyMarkup) {
    formData.append("reply_markup", JSON.stringify(replyMarkup));
  }

  try {
    const resp = await fetch(url, { method: "POST", body: formData });
    if (resp.ok) return true;
    const errText = await resp.text();
    console.error("[Telegram] Ошибка при отправке фото:", errText);
    return false;
  } catch (err) {
    console.error("[Telegram] Сетевая ошибка при отправке фото:", err.message);
    return false;
  }
}

async function sendTelegramDocument(config, docPathOrBuffer, filename = "document.pdf", caption = "", replyMarkup = null) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendDocument`;

  let buffer;
  if (Buffer.isBuffer(docPathOrBuffer)) {
    buffer = docPathOrBuffer;
  } else if (typeof docPathOrBuffer === "string" && fs.existsSync(docPathOrBuffer)) {
    buffer = fs.readFileSync(docPathOrBuffer);
  } else {
    console.error("[Telegram] Документ не найден по пути:", docPathOrBuffer);
    return false;
  }

  const formData = new FormData();
  formData.append("chat_id", config.TELEGRAM_CHAT_ID);
  formData.append("document", new Blob([buffer], { type: "application/pdf" }), filename);
  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
  }
  if (replyMarkup) {
    formData.append("reply_markup", JSON.stringify(replyMarkup));
  }

  try {
    const resp = await fetch(url, { method: "POST", body: formData });
    if (resp.ok) return true;
    const errText = await resp.text();
    console.error("[Telegram] Ошибка при отправке документа:", errText);
    return false;
  } catch (err) {
    console.error("[Telegram] Сетевая ошибка при отправке документа:", err.message);
    return false;
  }
}

function buildDigestKeyboard(pdfWebUrl, miniAppUrl) {
  const buttons = [];
  if (pdfWebUrl) {
    buttons.push({ text: "📥 Скачать PDF (веб)", url: pdfWebUrl });
  }
  if (miniAppUrl) {
    buttons.push({ text: "📱 Открыть Mini App", url: miniAppUrl });
  }
  return { inline_keyboard: [buttons] };
}

function formatDigestPhotoCaption(stats, topScore = 0, proposalsCount = 0) {
  const dateStr = stats?.date || new Date().toISOString().slice(0, 10);
  const totalScanned = stats?.totalScanned || 0;
  const matched = stats?.matchedFilters || 0;

  return (
    `📊 <b>Итоги дня по поиску Upwork (${escapeHtml(dateStr)})</b>\n\n` +
    `🔍 Всего отсканировано: <b>${totalScanned}</b>\n` +
    `✅ Отобрано по фильтрам: <b>${matched}</b>\n` +
    `🤖 Подготовлено AI-откликов: <b>${proposalsCount}</b>\n` +
    `🏆 Максимальный скор: <b>${topScore > 0 ? topScore : "N/A"}</b>\n\n` +
    `📄 <i>Полный PDF-отчёт со ссылками на все вакансии прикреплён ниже 👇</i>`
  );
}

function buildJobKeyboard(jobUrl, jobLinkId = null) {
  const buttons = [
    { text: "🚀 Открыть вакансию", url: jobUrl },
  ];

  if (jobLinkId) {
    buttons.push({
      text: "✍️ Подать Proposal",
      url: `https://www.upwork.com/ab/proposals/job/${jobLinkId}/apply/`,
    });
  }

  return { inline_keyboard: [buttons] };
}

function formatDailyDigestMessage(stats) {
  const dateStr = stats.date || new Date().toISOString().slice(0, 10);
  const totalScanned = stats.totalScanned || 0;
  const matchedFilters = stats.matchedFilters || 0;
  const byKeyword = stats.byKeyword || {};
  const topJobs = stats.topJobs || [];

  let msg = `📊 <b>Итоги дня по поиску Upwork (${escapeHtml(dateStr)})</b>\n\n`;
  msg += `🔍 <b>Всего найдено вакансий:</b> ${totalScanned}\n`;
  msg += `✅ <b>Прошло фильтры и отправлено:</b> ${matchedFilters}\n\n`;

  const keywordEntries = Object.entries(byKeyword);
  if (keywordEntries.length > 0) {
    msg += `🏷️ <b>По ключевым словам:</b>\n`;
    for (const [kw, count] of keywordEntries) {
      msg += `  • <code>${escapeHtml(kw)}</code>: ${count}\n`;
    }
    msg += `\n`;
  }

  if (topJobs.length > 0) {
    msg += `🏆 <b>Топ вакансий дня:</b>\n`;
    topJobs.slice(0, 3).forEach((job, idx) => {
      const title = escapeHtml(job.title || "Untitled");
      const budget = escapeHtml(job.budget || "N/A");
      const score = job.score ? `[Score: ${job.score}] ` : "";
      const url = job.url ? escapeHtml(job.url) : "";
      if (url) {
        msg += `${idx + 1}. <a href="${url}">${score}${title}</a> (${budget})\n`;
      } else {
        msg += `${idx + 1}. ${score}${title} (${budget})\n`;
      }
    });
  }

  return msg;
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
    msg += `🤖 <b>AI Cover Letter Draft</b> <i>(нажмите на текст для копирования)</i>:\n<code>${escapeHtml(coverLetter.trim())}</code>\n\n`;
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
        `🤖 <b>AI Cover Letter Draft</b> <i>(нажмите на текст для копирования)</i>:\n<code>${escapeHtml(trimmedLetter.trim())}</code>\n\n` +
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

module.exports = {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  formatJobMessage,
  buildJobKeyboard,
  buildDigestKeyboard,
  formatDigestPhotoCaption,
  formatDailyDigestMessage,
};
