// Фильтрация вакансий по критериям из ТЗ (Часть 2, п.2.4)

function countryAllowed(country, allowedList) {
  if (!country) return false;
  return allowedList.some(
    (allowed) => allowed.toLowerCase() === country.toLowerCase()
  );
}

function isFresh(publishedDateTime, maxAgeMinutes) {
  if (!publishedDateTime) return true; // если поле пустое — не отбрасываем из-за этого
  const publishedAt = new Date(publishedDateTime).getTime();
  const ageMinutes = (Date.now() - publishedAt) / 1000 / 60;
  return ageMinutes <= maxAgeMinutes;
}

function passesFilters(job, filters) {
  // Свежесть — защита от дублей/старых вакансий
  if (!isFresh(job.publishedDateTime, filters.MAX_AGE_MINUTES)) {
    return { pass: false, reason: "too_old" };
  }

  // Почасовая ставка — применяется только если вакансия hourly (min/max > 0)
  const isHourly = job.hourlyBudgetMin > 0 || job.hourlyBudgetMax > 0;
  if (isHourly && job.hourlyBudgetMin < filters.MIN_HOURLY_RATE) {
    return { pass: false, reason: "hourly_rate_too_low" };
  }

  // Дальше — фильтры по клиенту. Если данных о клиенте нет вообще — пропускаем вакансию
  // (лучше показать без уверенности в клиенте, чем потерять её молча — можно поменять на false).
  if (!job.client) {
    return { pass: true, reason: "no_client_data" };
  }

  const country = job.client.location?.country;
  if (!countryAllowed(country, filters.ALLOWED_COUNTRIES)) {
    return { pass: false, reason: "country_not_allowed" };
  }

  const rating = job.client.totalFeedback;
  // Если у клиента ещё нет отзывов (totalFeedback == 0/null) — не отбрасываем из-за рейтинга,
  // иначе будем терять всех новых клиентов. Фильтруем только тех, у кого рейтинг РЕАЛЬНО низкий.
  if (rating && rating > 0 && rating < filters.MIN_CLIENT_RATING) {
    return { pass: false, reason: "rating_too_low" };
  }

  if (filters.REQUIRE_PAYMENT_VERIFIED && job.client.verificationStatus !== "VERIFIED") {
    return { pass: false, reason: "payment_not_verified" };
  }

  const postedJobs = job.client.totalPostedJobs || 0;
  if (postedJobs < filters.MIN_CLIENT_POSTED_JOBS) {
    return { pass: false, reason: "not_enough_posted_jobs" };
  }

  return { pass: true, reason: null };
}

module.exports = { passesFilters };
