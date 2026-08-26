// Конфиг бота. Секреты хранятся здесь же (осознанное решение — репозиторий приватный).

module.exports = {
  // ===== СЕКРЕТЫ — впиши свои значения =====
  UPWORK_CLIENT_ID: "073cbb48b89e50b291c2670438d2e9bf",
  UPWORK_CLIENT_SECRET: "f9c71e7cac15c1f2",

  TELEGRAM_BOT_TOKEN: "8669311927:AAGS-iQcw6FMtNHVwM5-OT1euPL60Bj9oN4",
  TELEGRAM_CHAT_ID: "422713968",

  // ===== КЛЮЧЕВЫЕ СЛОВА ПОИСКА =====
  KEYWORDS: [
    "wordpress developer",
    "wordpress plugin",
    "woocommerce",
  ],

  // ===== ФИЛЬТРЫ =====
  FILTERS: {
    // Почасовая ставка — фильтр применяется только к hourly-вакансиям.
    MIN_HOURLY_RATE: 25,

    // Минимальная средняя ставка, выплаченная клиентом за всё время
    MIN_CLIENT_AVG_HOURLY_RATE: 15,

    // Минимальный бюджет для fixed-price проектов
    MIN_FIXED_BUDGET: 500,

    // Разрешенные теги разработчика (хотя бы один тег вакансии должен совпадать)
    ALLOWED_DEVELOPER_TAGS: [
      "WordPress", "PHP", "WooCommerce", "JavaScript",
      "WordPress Development", "WordPress Theme", "WordPress Plugin",
      "jQuery", "React", "Next.js", "CMS Development",
      "Gutenberg Editor", "Page Speed Optimization", "Webflow", "Shopify", "Laravel"
    ],

    // Нежелательные слова в заголовке вакансии (чистый дизайн)
    EXCLUDE_TITLE_KEYWORDS: [
      "design", "designer", "graphic", "ui", "ux", "figma", "video", "branding", "illustrator",
      "дизайн", "дизайнер", "верстка", "верстальщик"
    ],

    // Ключевые слова разработки, отменяющие исключение по дизайну в заголовке
    STRONG_DEVELOPER_KEYWORDS: [
      "developer", "development", "coder", "programmer", "programming", "plugin",
      "backend", "frontend", "fullstack", "php", "javascript", "react", "api",
      "разработчик", "разработка", "программист"
    ],

    // Разрешённые страны клиента (см. ТЗ)
    ALLOWED_COUNTRIES: [
      "United States", "USA", "US",
      "United Kingdom", "UK",
      "Canada",
      "Australia",
      "Germany",
      "Switzerland",
      "Netherlands",
      "Singapore",
      "New Zealand",
      "Norway",
      "Sweden",
      "Ireland",
      "Denmark",
      "Japan",
    ],

    // Минимальный рейтинг клиента (шкала до 5.0)
    MIN_CLIENT_RATING: 4.5,

    // Обязательно ли подтверждён способ оплаты у клиента
    REQUIRE_PAYMENT_VERIFIED: true,

    // Компромисс вместо "5 завершённых контрактов" — используем totalPostedJobs (см. ТЗ)
    MIN_CLIENT_POSTED_JOBS: 5,

    // На всякий случай не показываем вакансии старше N минут (защита от дублей при полудлинных задержках cron)
    MAX_AGE_MINUTES: 60,
  },

  // ===== ВЕСА ДЛЯ SCORE (сортировка/приоритет внутри сообщения) =====
  SCORING_WEIGHTS: {
    hourlyRateWeight: 100,
    keywordMatchWeight: 50,
    clientRatingWeight: 20,
  },

  PATHS: {
    SEEN_JOBS_FILE: "data/seen_jobs.json",
  },
};
