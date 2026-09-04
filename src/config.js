// Конфиг бота. Секреты хранятся здесь же (осознанное решение — репозиторий приватный).

module.exports = {
  // ===== СЕКРЕТЫ — считываются из переменных окружения =====
  UPWORK_CLIENT_ID: process.env.UPWORK_CLIENT_ID,
  UPWORK_CLIENT_SECRET: process.env.UPWORK_CLIENT_SECRET,

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash",

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
    MIN_FIXED_BUDGET: 200,

    // Разрешенные теги разработчика (хотя бы один тег вакансии должен совпадать)
    ALLOWED_DEVELOPER_TAGS: [
      "WordPress", "PHP", "WooCommerce", "JavaScript",
      "WordPress Development", "WordPress Theme", "WordPress Plugin", "WordPress Customization", "WordPress Optimization",
      "jQuery", "React", "Next.js", "CMS Development", "CMS Development Skills",
      "Ecommerce Website Development", "E-Commerce", "BigCommerce", "Shopify", "Webflow",
      "Elementor", "Divi", "Gutenberg Editor", "WP Engine",
      "Page Speed Optimization", "Speed Optimization", "Website Speed Optimization",
      "Web Development", "Website Development", "Website Customization",
      "HTML", "CSS", "HTML5", "CSS3", "API Integration", "REST API", "Laravel"
    ],

    // Нежелательные слова в заголовке вакансии (чистая графика, видео, копирайтинг и т.д.)
    EXCLUDE_TITLE_KEYWORDS: [
      "logo", "graphic designer", "graphic design", "video editor", "video editing",
      "animator", "animation", "branding", "illustrator", "illustration", "banner",
      "copywriter", "content writer", "virtual assistant", "voiceover"
    ],

    // Ключевые слова разработки, отменяющие исключение по нежелательным словам
    STRONG_DEVELOPER_KEYWORDS: [
      "developer", "development", "coder", "programmer", "programming", "plugin",
      "backend", "frontend", "fullstack", "php", "javascript", "react", "api",
      "wordpress", "woocommerce", "convert", "build", "integration", "migration", "elementor", "fix"
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

    // Минимальное количество опубликованных клиентом вакансий
    MIN_CLIENT_POSTED_JOBS: 2,

    // На всякий случай не показываем вакансии старше N минут (защита от дублей при полудлинных задержках cron)
    MAX_AGE_MINUTES: 10,
  },

  // ===== ВЕСА ДЛЯ SCORE (сортировка/приоритет внутри сообщения) =====
  SCORING_WEIGHTS: {
    hourlyRateWeight: 100,
    keywordMatchWeight: 50,
    clientRatingWeight: 20,
  },

  PATHS: {
    SEEN_JOBS_FILE: "data/seen_jobs.json",
    PROFILE_FILE: "data/resume_profile.txt",
    DAILY_STATS_FILE: "data/daily_stats.json",
    JOBS_FEED_FILE: "data/jobs_feed.json",
    WEBAPP_FEED_FILE: "webapp/data/jobs_feed.json",
    DOCS_FEED_FILE: "docs/data/jobs_feed.json",
  },

  // Час отправки вечерней сводки в Telegram (по киевскому времени, 21 = 21:00)
  DIGEST_HOUR: 21,
};
