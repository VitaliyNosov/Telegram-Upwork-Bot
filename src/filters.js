// Фильтрация вакансий по критериям из ТЗ (Часть 2, п.2.4)

function countryAllowed(country, allowedList) {
  if (!country) return false;
  return allowedList.some(
    (allowed) => allowed.toLowerCase() === country.toLowerCase()
  );
}

function isFresh(publishedDateTime, maxAgeMinutes) {
  if (!publishedDateTime) return true; // если поле пустое — не отбрасываем из-за этого
  let dateStr = String(publishedDateTime);
  // Если API вернул дату без указания таймзоны, принудительно парсим её как UTC (Z)
  if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !/-\d{2}:\d{2}$/.test(dateStr)) {
    dateStr += "Z";
  }
  const publishedAt = new Date(dateStr).getTime();
  const ageMinutes = (Date.now() - publishedAt) / 1000 / 60;
  return ageMinutes <= maxAgeMinutes;
}

function isTitleExcluded(title, excludeWords, strongDevWords) {
  if (!title) return false;
  const titleLower = title.toLowerCase();
  const hasExclude = excludeWords.some((w) => titleLower.includes(w.toLowerCase()));
  if (!hasExclude) return false;
  
  // Если есть исключаемое слово (например, design), проверяем, нет ли сильного разработческого слова (например, developer)
  const hasStrongDev = strongDevWords.some((w) => titleLower.includes(w.toLowerCase()));
  return !hasStrongDev;
}

function hasMatchingDevTags(skills, allowedTags) {
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return true; // Если тегов нет — пропускаем, полагаясь на другие фильтры
  }
  const allowedSet = new Set(allowedTags.map(t => t.toLowerCase()));
  return skills.some(skill => skill.name && allowedSet.has(skill.name.toLowerCase()));
}

function passesFilters(job, filters) {
  // Свежесть — защита от дублей/старых вакансий
  if (!isFresh(job.publishedDateTime, filters.MAX_AGE_MINUTES)) {
    return { pass: false, reason: "too_old" };
  }

  // Фильтр по нежелательным словам в заголовке (чистый дизайн без разработки)
  if (isTitleExcluded(job.title, filters.EXCLUDE_TITLE_KEYWORDS, filters.STRONG_DEVELOPER_KEYWORDS)) {
    return { pass: false, reason: "design_only_title" };
  }

  // Фильтр по тегам вакансии (Skills and Expertise)
  if (!hasMatchingDevTags(job.skills, filters.ALLOWED_DEVELOPER_TAGS)) {
    return { pass: false, reason: "no_matching_developer_tags" };
  }

  // Почасовая ставка — применяется только если вакансия hourly (min/max > 0)
  // Исправление бага: ориентируемся на максимальную ставку, если минимальная не указана или низкая
  const isHourly = job.hourlyBudgetMin > 0 || job.hourlyBudgetMax > 0;
  if (isHourly) {
    const maxRate = job.hourlyBudgetMax || 0;
    const minRate = job.hourlyBudgetMin || 0;
    const effectiveRate = maxRate || minRate;
    if (effectiveRate && effectiveRate < filters.MIN_HOURLY_RATE) {
      return { pass: false, reason: "hourly_rate_too_low" };
    }
  }

  // Дальше — фильтры по клиенту. Если данных о клиенте нет вообще — отклоняем вакансию,
  // чтобы гарантировать соответствие фильтрам по стране, рейтингу и верификации.
  if (!job.client) {
    return { pass: false, reason: "no_client_data" };
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

  // Фильтр по средней ставке выплат клиента (Avg Hourly Rate Paid)
  const avgHourlyRate = job.client.avgHourlyRatePaid;
  if (avgHourlyRate && avgHourlyRate > 0 && avgHourlyRate < filters.MIN_CLIENT_AVG_HOURLY_RATE) {
    return { pass: false, reason: "client_avg_hourly_rate_too_low" };
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
