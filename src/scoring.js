// Подсчёт score для вакансии — просто добавляется в текст сообщения,
// чтобы визуально сразу было видно приоритет (см. ТЗ, п.2.5)

function calculateScore(job, keywords, weights) {
  const hourlyRate = job.hourlyBudgetMax || job.hourlyBudgetMin || 0;
  const rating = job.client?.totalFeedback || 0;

  const titleLower = (job.title || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();
  const keywordMatchCount = keywords.reduce((count, kw) => {
    const kwLower = kw.toLowerCase();
    return count + (titleLower.includes(kwLower) || descLower.includes(kwLower) ? 1 : 0);
  }, 0);

  const score =
    hourlyRate * weights.hourlyRateWeight * 0.01 * 100 +
    keywordMatchCount * weights.keywordMatchWeight +
    rating * weights.clientRatingWeight;

  return Math.round(score);
}

module.exports = { calculateScore };
