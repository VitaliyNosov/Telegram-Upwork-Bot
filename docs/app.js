/**
 * Upwork Telegram Mini App Client Logic
 */

(function () {
  const tg = window.Telegram?.WebApp;

  // Initialize Telegram WebApp features if running inside Telegram
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      
      // Lock to authentic Upwork daylight theme
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');

      if (typeof tg.setHeaderColor === 'function') {
        try { tg.setHeaderColor('#ffffff'); } catch (_) {}
      }
      if (typeof tg.setBackgroundColor === 'function') {
        try { tg.setBackgroundColor('#f7f7f7'); } catch (_) {}
      }
    } catch (e) {
      console.warn('Telegram WebApp init warning:', e);
    }
  }

  // Application State
  const state = {
    jobs: [],
    dailyStats: null,
    savedIds: new Set(getStorage('upwork_saved_ids', [])),
    viewedIds: new Set(getStorage('upwork_viewed_ids', [])),
    deletedIds: new Set(getStorage('upwork_deleted_ids', [])),
    selectedDate: 'all',
    activeTab: 'view-jobs',
    quickFilter: 'all',
    searchQuery: '',
    sortBy: 'newest',
    theme: getStorage('upwork_theme', 'light'),
    filters: {
      type: 'all', // 'all', 'hourly', 'fixed'
      minRate: 25,
      selectedSkills: new Set(),
      onlyUnviewed: false,
    },
    activeJob: null,
    analyticsPeriod: 'all', // 'all', '7d', 'today'
  };

  // Chart.js Instances Store
  const chartInstances = {
    activity: null,
    rates: null,
    types: null,
    skills: null,
    countries: null,
  };

  // DOM Elements
  const el = {
    jobsList: document.getElementById('jobs-list'),
    savedList: document.getElementById('saved-list'),
    jobsCountLabel: document.getElementById('jobs-count-label'),
    savedCountLabel: document.getElementById('saved-count-label'),
    emptyJobs: document.getElementById('empty-jobs'),
    emptySaved: document.getElementById('empty-saved'),
    inputSearch: document.getElementById('input-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    selectSort: document.getElementById('select-sort'),
    filterChips: document.getElementById('filter-chips'),
    filterChipsWrapper: document.querySelector('.filter-chips-wrapper'),
    btnChipPrev: document.getElementById('btn-chip-prev'),
    btnChipNext: document.getElementById('btn-chip-next'),
    searchBox: document.querySelector('.search-box'),
    navJobsBadge: document.getElementById('nav-jobs-badge'),
    navSavedBadge: document.getElementById('nav-saved-badge'),
    navFilterDot: document.getElementById('nav-filter-indicator'),
    btnSync: document.getElementById('btn-sync'),

    // Calendar & Cleanup
    btnOpenCalendar: document.getElementById('btn-open-calendar'),
    headerCalendarDot: document.getElementById('header-calendar-dot'),
    chipCalendarBtn: document.getElementById('chip-calendar-btn'),
    chipCalendarText: document.getElementById('chip-calendar-text'),
    modalCalendar: document.getElementById('modal-calendar'),
    btnCloseCalendar: document.getElementById('btn-close-calendar'),
    btnCloseCalendarFooter: document.getElementById('btn-close-calendar-footer'),
    calendarDaysGrid: document.getElementById('calendar-days-grid'),
    btnResetDateFilter: document.getElementById('btn-reset-date-filter'),
    btnCleanViewed: document.getElementById('btn-clean-viewed'),
    btnCleanOlder3d: document.getElementById('btn-clean-older-3d'),
    btnCleanSelectedDate: document.getElementById('btn-clean-selected-date'),
    labelCleanSelectedDate: document.getElementById('label-clean-selected-date'),
    badgeCountViewed: document.getElementById('badge-count-viewed'),
    badgeCountOlder: document.getElementById('badge-count-older'),
    badgeCountDate: document.getElementById('badge-count-date'),
    restoreCleanupBox: document.getElementById('restore-cleanup-box'),
    countDeletedJobs: document.getElementById('count-deleted-jobs'),
    btnRestoreDeleted: document.getElementById('btn-restore-deleted'),

    // Theme Toggle
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    iconThemeDark: document.getElementById('icon-theme-dark'),
    iconThemeLight: document.getElementById('icon-theme-light'),

    // Daily Report View
    viewReport: document.getElementById('view-report'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),
    kpiScanned: document.getElementById('kpi-scanned'),
    kpiMatched: document.getElementById('kpi-matched'),
    kpiProposals: document.getElementById('kpi-proposals'),
    kpiScore: document.getElementById('kpi-score'),
    reportDateBadge: document.getElementById('report-date-badge'),
    keywordStatsList: document.getElementById('keyword-stats-list'),
    pdfContainer: document.getElementById('pdf-report-container'),

    // Market Analytics View
    viewAnalytics: document.getElementById('view-analytics'),
    periodSelector: document.getElementById('analytics-period-selector'),
    statAvgRate: document.getElementById('stat-avg-rate'),
    statTier1Ratio: document.getElementById('stat-tier1-ratio'),
    statPeakHours: document.getElementById('stat-peak-hours'),
    statAnalyzedCount: document.getElementById('stat-analyzed-count'),
    badgePeakHour: document.getElementById('badge-peak-hour'),
    donutHourlyPct: document.getElementById('donut-hourly-pct'),
    funnelContainer: document.getElementById('funnel-container'),
    
    // Modals
    modalDetails: document.getElementById('modal-details'),
    detailJobBody: document.getElementById('detail-job-body'),
    btnCloseDetails: document.getElementById('btn-close-details'),
    btnDetailsSave: document.getElementById('btn-details-save'),
    btnDetailsTranslate: document.getElementById('btn-details-translate'),
    btnModalApply: document.getElementById('btn-modal-apply'),
    btnModalView: document.getElementById('btn-modal-view'),
    
    modalFilters: document.getElementById('modal-filters'),
    btnOpenFilters: document.getElementById('btn-open-filter-modal'),
    btnCloseFilters: document.getElementById('btn-close-filters'),
    btnApplyFilters: document.getElementById('btn-apply-modal-filters'),
    btnResetFilters: document.getElementById('btn-reset-modal-filters'),
    filterMinRate: document.getElementById('filter-min-rate'),
    rateValueDisplay: document.getElementById('rate-value-display'),
    tagsSelector: document.getElementById('tags-selector'),
    filterUnviewedOnly: document.getElementById('filter-unviewed-only'),
    
    toast: document.getElementById('toast'),
  };

  // Helper: LocalStorage
  function getStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set error:', e);
    }
  }

  // Haptic feedback helper
  function triggerHaptic(type = 'light') {
    if (tg?.HapticFeedback) {
      try {
        if (type === 'selection') tg.HapticFeedback.selectionChanged();
        else if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
        else tg.HapticFeedback.impactOccurred('light');
      } catch {}
    }
  }

  // Embedded fallback jobs in case network fetch fails or running via file:// protocol
  const FALLBACK_SEED_JOBS = [
    {
      id: "2095766280133754562",
      ciphertext: "~022095766280133754562",
      title: "Build Responsive Website for a Media Agency",
      description: "We're a post-production studio serving media houses, production companies, and content agencies across North America.\n\nWe're hiring a designer-developer to design and build our marketing site from scratch. The site's job is to convert North American production teams into booked discovery calls.",
      isHourly: false,
      hourlyBudgetMin: 0,
      hourlyBudgetMax: 0,
      budgetDisplay: "Fixed-price",
      client: {
        country: "United Kingdom",
        totalFeedback: 4.58,
        verificationStatus: "VERIFIED",
        totalPostedJobs: 7,
        avgHourlyRatePaid: 0,
      },
      skills: ["WordPress", "Web Design", "HTML5", "JavaScript", "CSS3"],
      score: 92,
      coverLetter: "Hi! I saw your requirement for a responsive marketing site for your post-production media studio.\n\nI have extensive experience designing and developing fast, high-converting agency websites from scratch. I focus on clean structure, modern responsive layouts, and clear CTAs that maximize discovery call bookings.\n\nDo you already have branding assets and copy prepared, or are we designing from scratch? Let's connect!",
      publishedDateTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      url: "https://www.upwork.com/jobs/~022095766280133754562",
      applyUrl: "https://www.upwork.com/ab/proposals/job/~022095766280133754562/apply/"
    },
    {
      id: "2095841597182299911",
      ciphertext: "~022095841597182299911",
      title: "Urgent: Fix WooCommerce Checkout 500 Error and Stripe Webhook Issue",
      description: "Our WooCommerce store is having fatal errors on checkout after the latest update to WooCommerce 9.0 and Stripe payment gateway. Customers are reporting white screens and 500 Internal Server Errors when attempting payment.\n\nWe need an experienced WordPress/WooCommerce developer who can inspect error logs, resolve conflicts in staging, and push fixes safely to live production without downtime.",
      isHourly: true,
      hourlyBudgetMin: 35,
      hourlyBudgetMax: 65,
      budgetDisplay: "$35 - $65/hr",
      client: {
        country: "United States",
        totalFeedback: 4.96,
        verificationStatus: "VERIFIED",
        totalPostedJobs: 38,
        avgHourlyRatePaid: 48.5,
      },
      skills: ["WooCommerce", "WordPress", "PHP", "Stripe", "Debugging"],
      score: 280,
      coverLetter: "Hi! I can troubleshoot and resolve your WooCommerce checkout 500 error immediately.\n\nI regularly debug Stripe webhook failures, fatal PHP exceptions after core updates, and plugin conflicts on high-traffic WooCommerce shops. I will inspect the WooCommerce error logs, reproduce the issue in a safe sandbox environment, fix the root cause, and deploy without disturbing existing orders.\n\nReady to start right away.",
      publishedDateTime: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      url: "https://www.upwork.com/jobs/~022095841597182299911",
      applyUrl: "https://www.upwork.com/ab/proposals/job/~022095841597182299911/apply/"
    },
    {
      id: "2095704253291379753",
      ciphertext: "~022095704253291379753",
      title: "Ghost CRM Website Customization & HubSpot Integration",
      description: "I need an expert developer to customize our existing Ghost publication and connect it with CRM workflows (HubSpot/Make). We need custom member gating and automated lead capture pipelines set up within 2 weeks.",
      isHourly: true,
      hourlyBudgetMin: 40,
      hourlyBudgetMax: 60,
      budgetDisplay: "$40 - $60/hr",
      client: {
        country: "United States",
        totalFeedback: 4.88,
        verificationStatus: "VERIFIED",
        totalPostedJobs: 14,
        avgHourlyRatePaid: 45.0,
      },
      skills: ["Ghost", "JavaScript", "API Integration", "HubSpot"],
      score: 195,
      coverLetter: "Hi! I can customize your Ghost setup and seamlessly connect it with HubSpot workflows and membership access rules.\n\nSince you need this completed in two weeks, we can set up the webhook listeners and field mapping right away. Let's discuss your specific CRM tags and requirements!",
      publishedDateTime: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      url: "https://www.upwork.com/jobs/~022095704253291379753",
      applyUrl: "https://www.upwork.com/ab/proposals/job/~022095704253291379753/apply/"
    },
    {
      id: "2095817534805495309",
      ciphertext: "~022095817534805495309",
      title: "WordPress Speed Optimization - Core Web Vitals (LCP, CLS)",
      description: "Our mobile Google PageSpeed score is currently 32, and desktop is 68. We are failing Core Web Vitals (LCP is 4.8s). Looking for a specialist who can optimize images, configure caching, defer unused JavaScript, and fix database queries without breaking our Elementor layout.",
      isHourly: true,
      hourlyBudgetMin: 30,
      hourlyBudgetMax: 50,
      budgetDisplay: "$30 - $50/hr",
      client: {
        country: "Canada",
        totalFeedback: 5.0,
        verificationStatus: "VERIFIED",
        totalPostedJobs: 5,
        avgHourlyRatePaid: 38.0,
      },
      skills: ["WordPress", "Speed Optimization", "Elementor", "CSS"],
      score: 160,
      coverLetter: "Hi! I specialize in Core Web Vitals and WordPress performance engineering.\n\nI can bring your mobile PageSpeed score to 90+ without breaking any Elementor design elements or fonts. My optimization process includes unused CSS/JS cleanup, critical CSS generation, image WebP conversion, object caching, and database query optimization.\n\nReady to diagnose your site today!",
      publishedDateTime: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      url: "https://www.upwork.com/jobs/~022095817534805495309",
      applyUrl: "https://www.upwork.com/ab/proposals/job/~022095817534805495309/apply/"
    }
  ];

  // Load stats from JSON with fallback
  async function fetchDailyStats() {
    const urlsToTry = [
      'data/daily_stats.json',
      './data/daily_stats.json',
      '../data/daily_stats.json'
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && typeof data === 'object') {
            state.dailyStats = data;
            break;
          }
        }
      } catch (e) {
        // try next
      }
    }
  }

  // Load feed from JSON with fallback
  async function fetchJobs() {
    el.jobsCountLabel.textContent = 'Loading latest jobs...';
    let loadedJobs = null;

    await fetchDailyStats();

    const urlsToTry = [
      'data/jobs_feed.json',
      './data/jobs_feed.json',
      '../data/jobs_feed.json'
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            loadedJobs = data;
            break;
          }
        }
      } catch (e) {
        // try next
      }
    }

    if (loadedJobs && loadedJobs.length > 0) {
      state.jobs = loadedJobs;
    } else if (state.jobs.length === 0) {
      // Use embedded fallback seed
      state.jobs = [...FALLBACK_SEED_JOBS];
    }

    renderAll();
  }

  // Filter & Sort Logic
  function getFilteredJobs() {
    let list = state.jobs.filter((j) => !state.deletedIds.has(j.id));

    // Date filter
    if (state.selectedDate && state.selectedDate !== 'all') {
      list = list.filter((j) => {
        if (!j.publishedDateTime) return false;
        return j.publishedDateTime.slice(0, 10) === state.selectedDate;
      });
    }

    // Quick filter chips
    if (state.quickFilter === 'hourly') {
      list = list.filter((j) => j.isHourly);
    } else if (state.quickFilter === 'fixed') {
      list = list.filter((j) => !j.isHourly);
    } else if (state.quickFilter === 'high-rate') {
      list = list.filter((j) => (j.hourlyBudgetMax || j.hourlyBudgetMin) >= 35);
    } else if (state.quickFilter === 'unviewed') {
      list = list.filter((j) => !state.viewedIds.has(j.id));
    }

    // Modal filters
    if (state.filters.type === 'hourly') {
      list = list.filter((j) => j.isHourly);
    } else if (state.filters.type === 'fixed') {
      list = list.filter((j) => !j.isHourly);
    }

    if (state.filters.minRate > 15) {
      list = list.filter((j) => {
        if (!j.isHourly) return true;
        const rate = j.hourlyBudgetMax || j.hourlyBudgetMin || 0;
        return rate >= state.filters.minRate;
      });
    }

    if (state.filters.selectedSkills.size > 0) {
      list = list.filter((j) => {
        const skills = (j.skills || []).map((s) => s.toLowerCase());
        for (const skill of state.filters.selectedSkills) {
          if (skills.some((s) => s.includes(skill.toLowerCase()))) {
            return true;
          }
        }
        return false;
      });
    }

    if (state.filters.onlyUnviewed) {
      list = list.filter((j) => !state.viewedIds.has(j.id));
    }

    // Search query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter((j) => {
        const titleMatch = (j.title || '').toLowerCase().includes(q);
        const descMatch = (j.description || '').toLowerCase().includes(q);
        const skillsMatch = (j.skills || []).some((s) => s.toLowerCase().includes(q));
        const countryMatch = (j.client?.country || '').toLowerCase().includes(q);
        return titleMatch || descMatch || skillsMatch || countryMatch;
      });
    }

    // Sorting
    if (state.sortBy === 'newest') {
      list.sort((a, b) => new Date(b.publishedDateTime || 0) - new Date(a.publishedDateTime || 0));
    } else if (state.sortBy === 'score') {
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (state.sortBy === 'rate') {
      list.sort((a, b) => {
        const rateA = a.hourlyBudgetMax || a.hourlyBudgetMin || 0;
        const rateB = b.hourlyBudgetMax || b.hourlyBudgetMin || 0;
        return rateB - rateA;
      });
    }

    return list;
  }

  function getSavedJobs() {
    return state.jobs.filter((j) => state.savedIds.has(j.id) && !state.deletedIds.has(j.id));
  }

  // Format Relative Time (e.g. "15 minutes ago")
  function formatRelativeTime(dateString) {
    if (!dateString) return 'recently';
    const now = Date.now();
    const past = new Date(dateString).getTime();
    const diffMin = Math.max(1, Math.round((now - past) / 60000));

    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  }

  // Create Job Card HTML
  function createCardElement(job) {
    const isSaved = state.savedIds.has(job.id);
    const isViewed = state.viewedIds.has(job.id);

    const card = document.createElement('div');
    card.className = `job-card ${isViewed ? 'viewed' : ''}`;
    card.dataset.jobId = job.id;

    // Rate / Budget display
    const budgetHtml = job.isHourly
      ? `Hourly: $${job.hourlyBudgetMin || 0} - $${job.hourlyBudgetMax || 0}/hr`
      : `Fixed-price (Est. Budget: $200+)`;

    // Skills pills (up to 4, then +N)
    const skills = job.skills || [];
    const visibleSkills = skills.slice(0, 4);
    const remainingCount = skills.length - visibleSkills.length;
    let skillsHtml = visibleSkills.map((s) => `<span class="skill-pill">${escapeHtml(s)}</span>`).join('');
    if (remainingCount > 0) {
      skillsHtml += `<span class="skill-pill-more">+${remainingCount}</span>`;
    }

    // Client line
    const country = job.client?.country || 'Unknown';
    const rating = job.client?.totalFeedback ? Number(job.client.totalFeedback).toFixed(1) : 'New';
    const isVerified = job.client?.verificationStatus === 'VERIFIED';
    const verifiedBadge = isVerified ? '<span class="verified-badge">✓ Payment verified</span>' : '<span>Unverified</span>';

    // Heart icon SVG
    const heartSvg = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    `;

    card.innerHTML = `
      <div class="card-top">
        <span class="card-posted-time">Posted ${formatRelativeTime(job.publishedDateTime)}</span>
        <div class="card-actions-top">
          ${!isViewed ? '<span class="badge-new">New</span>' : ''}
          ${job.score ? `<span class="badge-score">Score: ${job.score}</span>` : ''}
          <button class="btn-save-card ${isSaved ? 'saved' : ''}" data-action="save" aria-label="Save Job">
            ${heartSvg}
          </button>
          <button class="btn-dismiss-card" data-action="dismiss" title="Dismiss job" aria-label="Dismiss job">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <h2 class="job-title">${escapeHtml(job.title)}</h2>

      <div class="job-budget-line">
        <span>${escapeHtml(budgetHtml)}</span>
      </div>

      <div class="job-description">
        ${escapeHtml(job.description)}
      </div>

      <div class="skills-pills">
        ${skillsHtml}
      </div>

      <div class="card-client-meta">
        <span class="meta-item">${verifiedBadge}</span>
        <span class="meta-item">⭐ ${rating}</span>
        <span class="meta-item">📍 ${escapeHtml(country)}</span>
      </div>
    `;

    // Click handler to open details
    card.addEventListener('click', (e) => {
      // If clicking save button, do not open details
      if (e.target.closest('[data-action="save"]')) {
        e.stopPropagation();
        toggleSave(job.id);
        return;
      }
      // If clicking dismiss button, hide/delete job
      if (e.target.closest('[data-action="dismiss"]')) {
        e.stopPropagation();
        dismissJob(job.id, card);
        return;
      }
      openJobModal(job);
    });

    return card;
  }

  // Render Functions
  function renderAll() {
    renderJobsFeed();
    renderSavedFeed();
    renderDailyReport();
    if (state.activeTab === 'view-analytics') {
      renderAnalytics();
    }
    updateBadges();
    updateCalendarIndicators();
  }

  function renderJobsFeed() {
    const filtered = getFilteredJobs();
    el.jobsList.innerHTML = '';

    el.jobsCountLabel.textContent = `${filtered.length} jobs found`;

    if (filtered.length === 0) {
      el.emptyJobs.classList.remove('hidden');
    } else {
      el.emptyJobs.classList.add('hidden');
      filtered.forEach((job) => {
        el.jobsList.appendChild(createCardElement(job));
      });
    }
  }

  function renderSavedFeed() {
    const saved = getSavedJobs();
    el.savedList.innerHTML = '';

    el.savedCountLabel.textContent = `${saved.length} Saved Jobs`;

    if (saved.length === 0) {
      el.emptySaved.classList.remove('hidden');
    } else {
      el.emptySaved.classList.add('hidden');
      saved.forEach((job) => {
        el.savedList.appendChild(createCardElement(job));
      });
    }
  }

  function renderDailyReport() {
    if (!el.viewReport) return;

    const stats = state.dailyStats || {};
    const totalScanned = stats.totalScanned || Math.max(state.jobs.length * 6, 28);
    const matched = stats.matchedFilters || state.jobs.length;
    const proposalsCount = state.jobs.filter((j) => j.coverLetter).length;
    const topScore = Math.max(0, ...state.jobs.map((j) => j.score || 0));

    if (el.kpiScanned) el.kpiScanned.textContent = totalScanned;
    if (el.kpiMatched) el.kpiMatched.textContent = matched;
    if (el.kpiProposals) el.kpiProposals.textContent = proposalsCount;
    if (el.kpiScore) el.kpiScore.textContent = topScore > 0 ? topScore : 'N/A';

    const dateStr = stats.date || new Date().toISOString().slice(0, 10);
    if (el.reportDateBadge) {
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          el.reportDateBadge.textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } else {
          el.reportDateBadge.textContent = dateStr;
        }
      } catch {
        el.reportDateBadge.textContent = dateStr;
      }
    }

    if (el.keywordStatsList) {
      const keywords = stats.byKeyword || { "wordpress developer": 2, "woocommerce": 1, "api integration": 1 };
      el.keywordStatsList.innerHTML = Object.entries(keywords).map(([kw, count]) => `
        <div class="keyword-stat-pill">
          <span>${escapeHtml(kw)}</span>
          <span class="keyword-stat-count">${count}</span>
        </div>
      `).join('');
    }
  }

  // ==========================================
  // Market Analytics & Chart.js Visualizations
  // ==========================================

  function getAnalyticsJobs() {
    const activeJobs = state.jobs.filter((j) => !state.deletedIds.has(j.id));
    if (state.analyticsPeriod === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      return activeJobs.filter((j) => {
        const d = j.publishedDateTime || j.addedAt;
        return d && d.slice(0, 10) === todayStr;
      });
    } else if (state.analyticsPeriod === '7d') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return activeJobs.filter((j) => {
        const d = j.publishedDateTime || j.addedAt;
        return d && new Date(d).getTime() >= sevenDaysAgo;
      });
    }
    return activeJobs;
  }

  function getChartThemeColors() {
    const isDark = state.theme === 'dark';
    return {
      isDark,
      primary: isDark ? '#22c55e' : '#14a800',
      primaryTint: isDark ? 'rgba(34, 197, 94, 0.18)' : 'rgba(20, 168, 0, 0.12)',
      textPrimary: isDark ? '#f0f2f5' : '#001e00',
      textSecondary: isDark ? '#94a3b8' : '#5e6d55',
      textMuted: isDark ? '#64748b' : '#6f7d66',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      cardBg: isDark ? '#242f3d' : '#ffffff',
      tooltipBg: isDark ? '#1b2633' : '#001e00',
      tooltipText: '#ffffff',
      donutPalette: [
        isDark ? '#22c55e' : '#14a800',
        '#3b82f6',
        '#f59e0b',
        '#a855f7',
        '#ec4899',
        '#06b6d4',
        '#94a3b8'
      ]
    };
  }

  function renderAnalytics() {
    if (!el.viewAnalytics) return;

    const jobs = getAnalyticsJobs();
    const colors = getChartThemeColors();

    // 1. KPI Calculation
    let hourlySum = 0;
    let hourlyCount = 0;
    let fixedCount = 0;
    const tier1Keywords = ['united states', 'usa', 'us', 'united kingdom', 'uk', 'canada', 'australia', 'germany', 'netherlands', 'switzerland', 'sweden', 'norway', 'denmark', 'new zealand', 'ireland'];
    let tier1Count = 0;

    const hourCounts = new Array(24).fill(0);
    const rateBrackets = { '<$20': 0, '$20–35': 0, '$35–50': 0, '$50–75': 0, '$75+': 0 };
    const skillCounts = {};
    const countryCounts = {};

    jobs.forEach((j) => {
      // Rates & Types
      if (j.isHourly) {
        hourlyCount++;
        const maxRate = Number(j.hourlyBudgetMax || j.hourlyBudgetMin || 0);
        const minRate = Number(j.hourlyBudgetMin || j.hourlyBudgetMax || 0);
        const avg = maxRate > 0 && minRate > 0 ? (maxRate + minRate) / 2 : (maxRate || minRate || 0);
        if (avg > 0) {
          hourlySum += avg;
        }

        const effectiveRate = maxRate || minRate || 0;
        if (effectiveRate < 20) rateBrackets['<$20']++;
        else if (effectiveRate <= 35) rateBrackets['$20–35']++;
        else if (effectiveRate <= 50) rateBrackets['$35–50']++;
        else if (effectiveRate <= 75) rateBrackets['$50–75']++;
        else rateBrackets['$75+']++;
      } else {
        fixedCount++;
      }

      // Country & Tier-1
      const rawCountry = (j.client?.country || 'Unknown').trim();
      const lowerCountry = rawCountry.toLowerCase();
      if (tier1Keywords.some((k) => lowerCountry.includes(k))) {
        tier1Count++;
      }

      // Normalize country for chart
      let normCountry = 'Other';
      if (lowerCountry.includes('united states') || lowerCountry === 'usa' || lowerCountry === 'us') normCountry = 'United States';
      else if (lowerCountry.includes('united kingdom') || lowerCountry === 'uk') normCountry = 'United Kingdom';
      else if (lowerCountry.includes('canada')) normCountry = 'Canada';
      else if (lowerCountry.includes('australia')) normCountry = 'Australia';
      else if (lowerCountry.includes('germany') || lowerCountry.includes('netherlands') || lowerCountry.includes('france') || lowerCountry.includes('spain') || lowerCountry.includes('italy')) normCountry = 'Europe';
      else if (rawCountry && rawCountry !== 'Unknown') normCountry = rawCountry;

      countryCounts[normCountry] = (countryCounts[normCountry] || 0) + 1;

      // Hour of day (Europe/Kyiv / Local)
      const dStr = j.publishedDateTime || j.addedAt;
      if (dStr) {
        try {
          const d = new Date(dStr);
          const h = d.getHours();
          if (h >= 0 && h < 24) hourCounts[h]++;
        } catch (_) {}
      }

      // Skills
      (j.skills || []).forEach((s) => {
        const clean = s.trim();
        if (clean) {
          skillCounts[clean] = (skillCounts[clean] || 0) + 1;
        }
      });
    });

    // Populate KPI Cards
    if (el.statAnalyzedCount) el.statAnalyzedCount.textContent = jobs.length;

    const avgHourly = hourlyCount > 0 ? Math.round(hourlySum / hourlyCount) : 0;
    if (el.statAvgRate) el.statAvgRate.textContent = avgHourly > 0 ? `$${avgHourly}/hr` : 'N/A';

    const tier1Pct = jobs.length > 0 ? Math.round((tier1Count / jobs.length) * 100) : 0;
    if (el.statTier1Ratio) el.statTier1Ratio.textContent = `${tier1Pct}%`;

    // Find peak 3-hour window
    let max3hWindow = 0;
    let peakStartHour = 17;
    for (let h = 0; h < 22; h++) {
      const sum = hourCounts[h] + hourCounts[h + 1] + hourCounts[h + 2];
      if (sum > max3hWindow) {
        max3hWindow = sum;
        peakStartHour = h;
      }
    }
    const peakStr = `${String(peakStartHour).padStart(2, '0')}:00 – ${String((peakStartHour + 3) % 24).padStart(2, '0')}:00`;
    if (el.statPeakHours) el.statPeakHours.textContent = peakStr;

    // Peak badge
    let topSingleHour = 0;
    let topSingleVal = 0;
    hourCounts.forEach((val, h) => {
      if (val > topSingleVal) {
        topSingleVal = val;
        topSingleHour = h;
      }
    });
    if (el.badgePeakHour) {
      el.badgePeakHour.textContent = `⚡ Top: ${String(topSingleHour).padStart(2, '0')}:00 (${topSingleVal} jobs)`;
    }

    // Hourly vs Fixed Percentage
    const totalWithBudget = hourlyCount + fixedCount;
    const hourlyPct = totalWithBudget > 0 ? Math.round((hourlyCount / totalWithBudget) * 100) : 0;
    if (el.donutHourlyPct) el.donutHourlyPct.textContent = `${hourlyPct}%`;

    // If Chart.js is not yet loaded, retry shortly
    if (typeof Chart === 'undefined') {
      setTimeout(renderAnalytics, 300);
      return;
    }

    // Global Chart.js defaults
    Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    Chart.defaults.color = colors.textSecondary;

    // Render All 4 Charts
    renderActivityChart(hourCounts, colors);
    renderRatesChart(rateBrackets, colors);
    renderTypesChart(hourlyCount, fixedCount, colors);
    renderSkillsChart(skillCounts, colors);
    renderCountriesChart(countryCounts, colors);

    // Render Funnel
    renderFunnelView(jobs);
  }

  // --- Chart 1: Activity ---
  function renderActivityChart(hourCounts, colors) {
    const canvas = document.getElementById('chart-activity');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Gradient fill
    let gradient = colors.primaryTint;
    try {
      const g = ctx.createLinearGradient(0, 0, 0, 180);
      g.addColorStop(0, colors.isDark ? 'rgba(34, 197, 94, 0.45)' : 'rgba(20, 168, 0, 0.35)');
      g.addColorStop(1, colors.isDark ? 'rgba(34, 197, 94, 0.02)' : 'rgba(20, 168, 0, 0.02)');
      gradient = g;
    } catch (_) {}

    if (chartInstances.activity) {
      chartInstances.activity.destroy();
    }

    chartInstances.activity = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Jobs Posted',
          data: hourCounts,
          borderColor: colors.primary,
          borderWidth: 2.4,
          backgroundColor: gradient,
          fill: true,
          tension: 0.38,
          pointRadius: (ctx) => {
            const val = ctx.raw || 0;
            return val > 0 ? 3 : 0;
          },
          pointHoverRadius: 6,
          pointBackgroundColor: colors.primary,
          pointBorderColor: colors.cardBg,
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => `Time: ${items[0].label}`,
              label: (item) => ` ${item.raw} new jobs`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 8,
              font: { size: 10 },
              color: colors.textMuted,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridColor },
            ticks: {
              precision: 0,
              font: { size: 10 },
              color: colors.textMuted,
            },
          },
        },
      },
    });
  }

  // --- Chart 2A: Rates ---
  function renderRatesChart(rateBrackets, colors) {
    const canvas = document.getElementById('chart-rates');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = Object.keys(rateBrackets);
    const data = Object.values(rateBrackets);

    if (chartInstances.rates) {
      chartInstances.rates.destroy();
    }

    chartInstances.rates = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Hourly Jobs',
          data,
          backgroundColor: colors.primary,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 32,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.raw} jobs in this rate`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              color: colors.textMuted,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridColor },
            ticks: {
              precision: 0,
              font: { size: 10 },
              color: colors.textMuted,
            },
          },
        },
      },
    });
  }

  // --- Chart 2B: Types (Hourly vs Fixed) ---
  function renderTypesChart(hourlyCount, fixedCount, colors) {
    const canvas = document.getElementById('chart-types');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (chartInstances.types) {
      chartInstances.types.destroy();
    }

    chartInstances.types = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Hourly', 'Fixed-Price'],
        datasets: [{
          data: [hourlyCount, fixedCount],
          backgroundColor: [
            colors.primary,
            colors.isDark ? '#3b82f6' : '#2563eb',
          ],
          borderColor: colors.cardBg,
          borderWidth: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { size: 10 },
              color: colors.textSecondary,
              padding: 8,
            },
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 8,
            cornerRadius: 8,
          },
        },
      },
    });
  }

  // --- Chart 3: Skills ---
  function renderSkillsChart(skillCounts, colors) {
    const canvas = document.getElementById('chart-skills');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const sorted = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = sorted.map((s) => s[0]);
    const data = sorted.map((s) => s[1]);

    if (chartInstances.skills) {
      chartInstances.skills.destroy();
    }

    chartInstances.skills = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          axis: 'y',
          label: 'Demand Count',
          data,
          backgroundColor: colors.isDark ? 'rgba(34, 197, 94, 0.85)' : 'rgba(20, 168, 0, 0.85)',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` Mentioned in ${item.raw} jobs`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.gridColor },
            ticks: {
              precision: 0,
              font: { size: 10 },
              color: colors.textMuted,
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, weight: '500' },
              color: colors.textPrimary,
            },
          },
        },
      },
    });
  }

  // --- Chart 4: Client Countries ---
  function renderCountriesChart(countryCounts, colors) {
    const canvas = document.getElementById('chart-countries');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const sorted = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const labels = sorted.map((c) => c[0]);
    const data = sorted.map((c) => c[1]);

    if (chartInstances.countries) {
      chartInstances.countries.destroy();
    }

    chartInstances.countries = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.donutPalette.slice(0, labels.length),
          borderColor: colors.cardBg,
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              font: { size: 11 },
              color: colors.textSecondary,
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.label}: ${item.raw} jobs`,
            },
          },
        },
      },
    });
  }

  // --- Chart 5: Funnel View ---
  function renderFunnelView(jobs) {
    if (!el.funnelContainer) return;

    const stats = state.dailyStats || {};
    const totalScanned = Math.max(stats.totalScanned || 0, jobs.length * 5, 25);
    const matched = jobs.length;
    const withProposals = jobs.filter((j) => j.coverLetter).length;
    const viewed = jobs.filter((j) => state.viewedIds.has(j.id)).length;
    const saved = jobs.filter((j) => state.savedIds.has(j.id)).length;

    const steps = [
      { label: '📡 Scanned by Upwork Bot', count: totalScanned, pct: 100, color: 'var(--color-primary)' },
      { label: '🎯 Matched your Filters', count: matched, pct: Math.round((matched / totalScanned) * 100), color: '#3b82f6' },
      { label: '✨ AI Cover Letter Ready', count: withProposals, pct: matched > 0 ? Math.round((withProposals / matched) * 100) : 0, color: '#8b5cf6' },
      { label: '👁️ Viewed by You', count: viewed, pct: matched > 0 ? Math.round((viewed / matched) * 100) : 0, color: '#f59e0b' },
      { label: '💚 Saved in Favorites', count: saved, pct: matched > 0 ? Math.round((saved / matched) * 100) : 0, color: '#10b981' },
    ];

    el.funnelContainer.innerHTML = steps.map((s) => `
      <div class="funnel-step">
        <div class="funnel-step-header">
          <span>${escapeHtml(s.label)}</span>
          <span class="funnel-step-count" style="color: ${s.color};">${s.count} <small style="color: var(--text-muted); font-weight: 400;">(${s.pct}%)</small></span>
        </div>
        <div class="funnel-bar-bg">
          <div class="funnel-bar-fill" style="width: ${Math.max(s.pct, 4)}%; background-color: ${s.color};"></div>
        </div>
      </div>
    `).join('');
  }

  function updateChartThemes() {
    if (state.activeTab === 'view-analytics') {
      renderAnalytics();
    }
  }

  function updateBadges() {
    const activeJobs = state.jobs.filter((j) => !state.deletedIds.has(j.id));
    const unviewedCount = activeJobs.filter((j) => !state.viewedIds.has(j.id)).length;
    if (unviewedCount > 0) {
      el.navJobsBadge.textContent = unviewedCount > 99 ? '99+' : unviewedCount;
      el.navJobsBadge.classList.remove('hidden');
    } else {
      el.navJobsBadge.classList.add('hidden');
    }

    const savedCount = activeJobs.filter((j) => state.savedIds.has(j.id)).length;
    if (savedCount > 0) {
      el.navSavedBadge.textContent = savedCount;
      el.navSavedBadge.classList.remove('hidden');
    } else {
      el.navSavedBadge.classList.add('hidden');
    }

    // Indicator if filters active
    const hasActiveFilters =
      state.filters.type !== 'all' ||
      state.filters.minRate > 25 ||
      state.filters.selectedSkills.size > 0 ||
      state.filters.onlyUnviewed;

    if (hasActiveFilters) {
      el.navFilterDot.classList.remove('hidden');
    } else {
      el.navFilterDot.classList.add('hidden');
    }

    updateCalendarIndicators();
  }

  // Actions
  function toggleSave(jobId) {
    triggerHaptic('impact');
    if (state.savedIds.has(jobId)) {
      state.savedIds.delete(jobId);
      showToast('Removed from Saved Jobs');
    } else {
      state.savedIds.add(jobId);
      showToast('Saved to Favorites! 💚');
    }
    setStorage('upwork_saved_ids', Array.from(state.savedIds));
    renderAll();

    // Update modal heart if open
    if (state.activeJob && state.activeJob.id === jobId) {
      updateModalSaveBtn(state.savedIds.has(jobId));
    }
  }

  function markViewed(jobId) {
    if (!state.viewedIds.has(jobId)) {
      state.viewedIds.add(jobId);
      setStorage('upwork_viewed_ids', Array.from(state.viewedIds));
      updateBadges();
    }
  }

  // ==========================================
  // Translation Engine & On-The-Fly Logic
  // ==========================================
  async function translateSingleChunk(chunk, targetLang = 'ru') {
    const cleanChunk = chunk.trim();
    if (!cleanChunk) return '';

    // Multiple Google Translate client endpoints to bypass 429 rate limiting
    const googleClients = ['dict-chrome-ex', 'it', 'at', 'gtx'];

    for (const client of googleClients) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanChunk)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((item) => (item && item[0] ? item[0] : '')).join('');
          if (translated && translated.trim()) {
            return translated;
          }
        }
      } catch (err) {
        // Continue to next client
      }
    }

    // Secondary backup: MyMemory Translation API
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanChunk)}&langpair=auto|${encodeURIComponent(targetLang)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.responseData?.translatedText) {
          return data.responseData.translatedText;
        }
      }
    } catch (err) {
      // Ignore
    }

    throw new Error('All translation providers failed');
  }

  async function translateText(text, targetLang = 'ru') {
    if (!text || !text.trim()) return '';

    if (text.length <= 900) {
      return await translateSingleChunk(text, targetLang);
    }

    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + '\n\n' + para).length > 900 && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // Sequential chunk processing to prevent 429 burst rate limiting
    const translatedChunks = [];
    for (const chunk of chunks) {
      const translated = await translateSingleChunk(chunk, targetLang);
      translatedChunks.push(translated);
    }
    return translatedChunks.join('\n\n');
  }

  function updateHeaderTranslateBtn(job) {
    if (!el.btnDetailsTranslate) return;
    const isTranslated = Boolean(job._showRuDesc || job._showRuProposal);
    if (isTranslated) {
      el.btnDetailsTranslate.classList.add('active');
      el.btnDetailsTranslate.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        <span class="btn-translate-label">EN</span>
      `;
      el.btnDetailsTranslate.title = 'Switch to English';
    } else {
      el.btnDetailsTranslate.classList.remove('active');
      el.btnDetailsTranslate.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="btn-translate-label">RU</span>
      `;
      el.btnDetailsTranslate.title = 'Translate to Russian';
    }
    updateModalActionButtons(isTranslated);
  }

  function updateModalActionButtons() {
    if (el.btnModalView) {
      const span = el.btnModalView.querySelector('span');
      if (span) span.textContent = 'View Job';
    }
    if (el.btnModalApply) {
      const span = el.btnModalApply.querySelector('span');
      if (span) span.textContent = 'Apply on Upwork';
    }
  }

  async function toggleTranslateDescription(job) {
    const descEl = document.getElementById('detail-job-description');
    const btnDesc = document.getElementById('btn-translate-desc');
    const titleEl = document.getElementById('detail-job-title');
    if (!descEl || !btnDesc) return;

    if (job._showRuDesc) {
      job._showRuDesc = false;
      job._showRuTitle = false;
      descEl.textContent = job.description;
      if (titleEl) titleEl.textContent = job.title;
      btnDesc.classList.remove('active');
      btnDesc.innerHTML = `<span class="translate-icon">🌐</span><span class="translate-text">Translate</span>`;
      updateHeaderTranslateBtn(job);
      triggerHaptic('selection');
    } else {
      triggerHaptic('impact');
      if (job._cacheRu?.description) {
        job._showRuDesc = true;
        job._showRuTitle = true;
        descEl.textContent = job._cacheRu.description;
        if (titleEl && job._cacheRu.title) titleEl.textContent = job._cacheRu.title;
        btnDesc.classList.add('active');
        btnDesc.innerHTML = `<span class="translate-icon">↩️</span><span class="translate-text">Original</span>`;
        updateHeaderTranslateBtn(job);
      } else {
        btnDesc.classList.add('loading');
        btnDesc.innerHTML = `<span class="translate-icon">⏳</span><span class="translate-text">Translating...</span>`;
        try {
          const transDesc = await translateText(job.description);
          let transTitle = job.title;
          try {
            if (job.title) {
              transTitle = await translateText(job.title);
            }
          } catch (e) {
            console.warn('Title translation failed, keeping original', e);
          }

          job._cacheRu = job._cacheRu || {};
          job._cacheRu.description = transDesc;
          job._cacheRu.title = transTitle;
          job._showRuDesc = true;
          job._showRuTitle = true;

          if (state.activeJob?.id === job.id) {
            descEl.textContent = transDesc;
            if (titleEl && transTitle) titleEl.textContent = transTitle;
            btnDesc.classList.add('active');
            btnDesc.innerHTML = `<span class="translate-icon">↩️</span><span class="translate-text">Original</span>`;
            updateHeaderTranslateBtn(job);
            showToast('Description translated to Russian 🌐');
          }
        } catch (err) {
          console.error('Translation error:', err);
          btnDesc.classList.remove('active');
          btnDesc.innerHTML = `<span class="translate-icon">🌐</span><span class="translate-text">Translate</span>`;
          showToast('Translation failed. Please try again.');
        } finally {
          btnDesc.classList.remove('loading');
        }
      }
    }
  }

  async function toggleTranslateProposal(job) {
    const propEl = document.getElementById('detail-job-proposal');
    const btnProp = document.getElementById('btn-translate-proposal');
    if (!propEl || !btnProp || !job.coverLetter) return;

    if (job._showRuProposal) {
      job._showRuProposal = false;
      propEl.textContent = job.coverLetter;
      btnProp.classList.remove('active');
      btnProp.innerHTML = `<span class="translate-icon">🌐</span><span class="translate-text">Translate</span>`;
      updateHeaderTranslateBtn(job);
      triggerHaptic('selection');
    } else {
      triggerHaptic('impact');
      if (job._cacheRu?.coverLetter) {
        job._showRuProposal = true;
        propEl.textContent = job._cacheRu.coverLetter;
        btnProp.classList.add('active');
        btnProp.innerHTML = `<span class="translate-icon">↩️</span><span class="translate-text">Original</span>`;
        updateHeaderTranslateBtn(job);
      } else {
        btnProp.classList.add('loading');
        btnProp.innerHTML = `<span class="translate-icon">⏳</span><span class="translate-text">Translating...</span>`;
        try {
          const transProposal = await translateText(job.coverLetter);
          job._cacheRu = job._cacheRu || {};
          job._cacheRu.coverLetter = transProposal;
          job._showRuProposal = true;

          if (state.activeJob?.id === job.id) {
            propEl.textContent = transProposal;
            btnProp.classList.add('active');
            btnProp.innerHTML = `<span class="translate-icon">↩️</span><span class="translate-text">Original</span>`;
            updateHeaderTranslateBtn(job);
            showToast('Proposal translated to Russian 🌐');
          }
        } catch (err) {
          console.error('Translation error:', err);
          btnProp.classList.remove('active');
          btnProp.innerHTML = `<span class="translate-icon">🌐</span><span class="translate-text">Translate</span>`;
          showToast('Translation failed. Please try again.');
        } finally {
          btnProp.classList.remove('loading');
        }
      }
    }
  }

  async function toggleHeaderTranslate(job) {
    triggerHaptic('impact');
    const isCurrentlyTranslated = Boolean(job._showRuDesc || job._showRuProposal);

    if (isCurrentlyTranslated) {
      if (job._showRuDesc) toggleTranslateDescription(job);
      if (job._showRuProposal) toggleTranslateProposal(job);
    } else {
      // Sequential translation to avoid rate-limiting spikes
      if (!job._showRuDesc) await toggleTranslateDescription(job);
      if (job.coverLetter && !job._showRuProposal) await toggleTranslateProposal(job);
    }
  }


  // Open Details Modal
  function openJobModal(job) {
    state.activeJob = job;
    markViewed(job.id);
    triggerHaptic('selection');

    job._cacheRu = job._cacheRu || {};
    job._showRuDesc = Boolean(job._showRuDesc);
    job._showRuProposal = Boolean(job._showRuProposal);
    job._showRuTitle = Boolean(job._showRuTitle);

    const isHourly = job.isHourly;
    const budgetText = isHourly
      ? `$${job.hourlyBudgetMin || 0} - $${job.hourlyBudgetMax || 0}/hr`
      : 'Fixed-price ($200+ budget)';

    const skillsHtml = (job.skills || [])
      .map((s) => `<span class="skill-pill">${escapeHtml(s)}</span>`)
      .join('');

    const country = job.client?.country || 'Unknown';
    const rating = job.client?.totalFeedback ? Number(job.client.totalFeedback).toFixed(2) : 'N/A';
    const totalJobs = job.client?.totalPostedJobs || 0;
    const avgPaid = job.client?.avgHourlyRatePaid ? `$${Number(job.client.avgHourlyRatePaid).toFixed(2)}/hr` : 'N/A';

    let coverLetterSection = '';
    if (job.coverLetter) {
      const activeProposalText = job._showRuProposal && job._cacheRu?.coverLetter
        ? job._cacheRu.coverLetter
        : job.coverLetter;

      coverLetterSection = `
        <div class="ai-proposal-card">
          <div class="ai-card-header">
            <span class="ai-card-title">✨ AI Proposal Assistant</span>
            <div class="ai-card-actions">
              <button id="btn-translate-proposal" class="btn-translate-inline ${job._showRuProposal ? 'active' : ''}" type="button">
                <span class="translate-icon">${job._showRuProposal ? '↩️' : '🌐'}</span>
                <span class="translate-text">${job._showRuProposal ? 'Original' : 'Translate'}</span>
              </button>
              <button id="btn-copy-proposal" class="btn btn-secondary" style="font-size: 12px; padding: 5px 12px;">
                📋 Copy Proposal
              </button>
            </div>
          </div>
          <div id="detail-job-proposal" class="ai-proposal-body">${escapeHtml(activeProposalText)}</div>
          <span style="font-size: 11px; color: var(--text-muted);">
            💡 Tailored to your resume and the client's problem. You can paste it into Upwork and review before submitting.
          </span>
        </div>
      `;
    }

    const activeTitle = job._showRuTitle && job._cacheRu?.title
      ? job._cacheRu.title
      : job.title;

    const activeDescription = job._showRuDesc && job._cacheRu?.description
      ? job._cacheRu.description
      : job.description;

    el.detailJobBody.innerHTML = `
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
        Posted ${formatRelativeTime(job.publishedDateTime)} • ${job.score ? `Score: ${job.score}` : ''}
      </div>
      <h1 class="detail-title" id="detail-job-title">${escapeHtml(activeTitle)}</h1>

      <div class="detail-price-box">
        <div>
          <div style="font-size: 11px; color: var(--text-muted);">${isHourly ? 'Hourly Rate' : 'Job Type'}</div>
          <div class="price-main">${escapeHtml(budgetText)}</div>
        </div>
        ${job.client?.verificationStatus === 'VERIFIED' ? '<span class="verified-badge">✓ Payment verified</span>' : ''}
      </div>

      <div class="detail-section-header">
        <div class="detail-section-title">Job Description</div>
        <button id="btn-translate-desc" class="btn-translate-inline ${job._showRuDesc ? 'active' : ''}" type="button">
          <span class="translate-icon">${job._showRuDesc ? '↩️' : '🌐'}</span>
          <span class="translate-text">${job._showRuDesc ? 'Original' : 'Translate'}</span>
        </button>
      </div>
      <div id="detail-job-description" class="detail-description">${escapeHtml(activeDescription)}</div>

      <div class="detail-section-title">Skills and Expertise</div>
      <div class="skills-pills">${skillsHtml}</div>

      <div class="detail-section-title">About the Client</div>
      <div class="client-details-grid">
        <div class="client-stat-item">
          <span class="stat-label">Country</span>
          <span class="stat-value">📍 ${escapeHtml(country)}</span>
        </div>
        <div class="client-stat-item">
          <span class="stat-label">Rating</span>
          <span class="stat-value">⭐ ${rating}</span>
        </div>
        <div class="client-stat-item">
          <span class="stat-label">Jobs Posted</span>
          <span class="stat-value">📋 ${totalJobs} jobs</span>
        </div>
        <div class="client-stat-item">
          <span class="stat-label">Avg Rate Paid</span>
          <span class="stat-value">💵 ${avgPaid}</span>
        </div>
      </div>

      ${coverLetterSection}
    `;

    updateModalSaveBtn(state.savedIds.has(job.id));
    updateHeaderTranslateBtn(job);

    if (el.btnDetailsTranslate) {
      el.btnDetailsTranslate.onclick = () => toggleHeaderTranslate(job);
    }

    const btnTranslateDesc = document.getElementById('btn-translate-desc');
    if (btnTranslateDesc) {
      btnTranslateDesc.onclick = () => toggleTranslateDescription(job);
    }

    const btnTranslateProp = document.getElementById('btn-translate-proposal');
    if (btnTranslateProp) {
      btnTranslateProp.onclick = () => toggleTranslateProposal(job);
    }

    // Event listener for copy button
    const copyBtn = document.getElementById('btn-copy-proposal');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyToClipboard(job.coverLetter);
        triggerHaptic('impact');
        if (job._showRuProposal) {
          showToast('Оригинал (EN) скопирован для Upwork! 📋');
        } else {
          showToast('Proposal copied to clipboard! 📋');
        }
      });
    }

    // View Job button (navigates to original job post)
    if (el.btnModalView) {
      el.btnModalView.onclick = () => {
        const targetUrl = job.url || job.applyUrl;
        triggerHaptic('impact');
        if (tg?.openLink) {
          tg.openLink(targetUrl);
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      };
    }

    // Apply button URL (navigates to proposals/apply)
    if (el.btnModalApply) {
      el.btnModalApply.onclick = () => {
        const targetUrl = job.applyUrl || job.url;
        triggerHaptic('impact');
        if (tg?.openLink) {
          tg.openLink(targetUrl);
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      };
    }

    el.modalDetails.classList.remove('hidden');
  }

  function updateModalSaveBtn(isSaved) {
    if (isSaved) {
      el.btnDetailsSave.classList.add('saved');
      el.btnDetailsSave.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-primary)" stroke="var(--color-primary)" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      `;
    } else {
      el.btnDetailsSave.classList.remove('saved');
      el.btnDetailsSave.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      `;
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(el.toastTimer);
    el.toastTimer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 2200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // Calendar & Feed Cleanup Logic
  // ==========================================
  function formatCalendarDateLabel(dateStr) {
    if (!dateStr || dateStr === 'all') return 'All Dates';

    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      if (dateStr === todayStr) return 'Today';
      if (dateStr === yesterdayStr) return 'Yesterday';

      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  function updateCalendarIndicators() {
    const isDateFiltered = state.selectedDate && state.selectedDate !== 'all';

    if (el.headerCalendarDot) {
      if (isDateFiltered) {
        el.headerCalendarDot.classList.remove('hidden');
      } else {
        el.headerCalendarDot.classList.add('hidden');
      }
    }

    if (el.chipCalendarBtn && el.chipCalendarText) {
      if (isDateFiltered) {
        el.chipCalendarBtn.classList.add('active');
        el.chipCalendarText.textContent = formatCalendarDateLabel(state.selectedDate);
      } else {
        el.chipCalendarBtn.classList.remove('active');
        el.chipCalendarText.textContent = 'All Dates';
      }
    }
  }

  function openCalendarModal() {
    triggerHaptic('selection');
    renderCalendarModal();
    if (el.modalCalendar) {
      el.modalCalendar.classList.remove('hidden');
    }
  }

  function closeCalendarModal() {
    if (el.modalCalendar) {
      el.modalCalendar.classList.add('hidden');
    }
  }

  function renderCalendarModal() {
    if (!el.calendarDaysGrid) return;

    const activeJobs = state.jobs.filter((j) => !state.deletedIds.has(j.id));
    
    // Group active jobs by date (YYYY-MM-DD)
    const dateCounts = {};
    activeJobs.forEach((job) => {
      const dateKey = job.publishedDateTime ? job.publishedDateTime.slice(0, 10) : 'unknown';
      if (dateKey !== 'unknown') {
        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
      }
    });

    const sortedDates = Object.keys(dateCounts).sort().reverse();

    el.calendarDaysGrid.innerHTML = '';

    // "All Dates" pill
    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = `day-pill ${state.selectedDate === 'all' ? 'active' : ''}`;
    allPill.innerHTML = `
      <span>All Dates</span>
      <span class="day-badge">${activeJobs.length}</span>
    `;
    allPill.addEventListener('click', () => {
      triggerHaptic('selection');
      state.selectedDate = 'all';
      updateCalendarIndicators();
      renderCalendarModal();
      renderJobsFeed();
    });
    el.calendarDaysGrid.appendChild(allPill);

    // Individual date pills
    sortedDates.forEach((dStr) => {
      const count = dateCounts[dStr];
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `day-pill ${state.selectedDate === dStr ? 'active' : ''}`;
      pill.innerHTML = `
        <span>${escapeHtml(formatCalendarDateLabel(dStr))}</span>
        <span class="day-badge">${count}</span>
      `;
      pill.addEventListener('click', () => {
        triggerHaptic('selection');
        state.selectedDate = dStr;
        updateCalendarIndicators();
        renderCalendarModal();
        renderJobsFeed();
      });
      el.calendarDaysGrid.appendChild(pill);
    });

    // Reset date button in section header
    if (el.btnResetDateFilter) {
      if (state.selectedDate !== 'all') {
        el.btnResetDateFilter.classList.remove('hidden');
      } else {
        el.btnResetDateFilter.classList.add('hidden');
      }
    }

    // Quick cleanup counters
    const viewedActive = activeJobs.filter((j) => state.viewedIds.has(j.id)).length;
    if (el.badgeCountViewed) el.badgeCountViewed.textContent = viewedActive;

    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const olderActive = activeJobs.filter((j) => {
      if (!j.publishedDateTime) return false;
      return new Date(j.publishedDateTime).getTime() < threeDaysAgo;
    }).length;
    if (el.badgeCountOlder) el.badgeCountOlder.textContent = olderActive;

    if (el.btnCleanSelectedDate) {
      if (state.selectedDate !== 'all') {
        el.btnCleanSelectedDate.classList.remove('hidden');
        const selectedCount = dateCounts[state.selectedDate] || 0;
        if (el.badgeCountDate) el.badgeCountDate.textContent = selectedCount;
        if (el.labelCleanSelectedDate) {
          el.labelCleanSelectedDate.textContent = `Purge jobs for ${formatCalendarDateLabel(state.selectedDate)}`;
        }
      } else {
        el.btnCleanSelectedDate.classList.add('hidden');
      }
    }

    // Restore section
    const deletedCount = state.deletedIds.size;
    if (el.restoreCleanupBox) {
      if (deletedCount > 0) {
        el.restoreCleanupBox.classList.remove('hidden');
        if (el.countDeletedJobs) el.countDeletedJobs.textContent = deletedCount;
      } else {
        el.restoreCleanupBox.classList.add('hidden');
      }
    }
  }

  function dismissJob(jobId, cardEl) {
    triggerHaptic('impact');
    state.deletedIds.add(jobId);
    setStorage('upwork_deleted_ids', Array.from(state.deletedIds));

    if (cardEl) {
      cardEl.classList.add('removing');
      setTimeout(() => {
        renderJobsFeed();
        renderSavedFeed();
        renderDailyReport();
        updateBadges();
        updateCalendarIndicators();
      }, 260);
    } else {
      renderJobsFeed();
      renderSavedFeed();
      renderDailyReport();
      updateBadges();
      updateCalendarIndicators();
    }
    showToast('Job dismissed');
  }

  function cleanViewedJobs() {
    triggerHaptic('impact');
    const activeJobs = state.jobs.filter((j) => !state.deletedIds.has(j.id));
    const toDelete = activeJobs.filter((j) => state.viewedIds.has(j.id));

    if (toDelete.length === 0) {
      showToast('No viewed jobs to remove');
      return;
    }

    toDelete.forEach((j) => state.deletedIds.add(j.id));
    setStorage('upwork_deleted_ids', Array.from(state.deletedIds));

    renderCalendarModal();
    renderJobsFeed();
    renderSavedFeed();
    renderDailyReport();
    updateBadges();
    showToast(`Removed viewed jobs: ${toDelete.length} 🗑️`);
  }

  function cleanOlderJobs(days = 3) {
    triggerHaptic('impact');
    const activeJobs = state.jobs.filter((j) => !state.deletedIds.has(j.id));
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    const toDelete = activeJobs.filter((j) => {
      if (!j.publishedDateTime) return false;
      return new Date(j.publishedDateTime).getTime() < threshold;
    });

    if (toDelete.length === 0) {
      showToast(`No jobs older than ${days} days`);
      return;
    }

    toDelete.forEach((j) => state.deletedIds.add(j.id));
    setStorage('upwork_deleted_ids', Array.from(state.deletedIds));

    renderCalendarModal();
    renderJobsFeed();
    renderSavedFeed();
    renderDailyReport();
    updateBadges();
    showToast(`Removed older jobs: ${toDelete.length} 🗑️`);
  }

  function cleanSelectedDateJobs() {
    triggerHaptic('impact');
    if (!state.selectedDate || state.selectedDate === 'all') return;

    const activeJobs = state.jobs.filter((j) => !state.deletedIds.has(j.id));
    const toDelete = activeJobs.filter((j) => {
      if (!j.publishedDateTime) return false;
      return j.publishedDateTime.slice(0, 10) === state.selectedDate;
    });

    if (toDelete.length === 0) {
      showToast('No jobs for selected day');
      return;
    }

    toDelete.forEach((j) => state.deletedIds.add(j.id));
    setStorage('upwork_deleted_ids', Array.from(state.deletedIds));

    const dateName = formatCalendarDateLabel(state.selectedDate);
    state.selectedDate = 'all';

    renderCalendarModal();
    renderJobsFeed();
    renderSavedFeed();
    renderDailyReport();
    updateBadges();
    showToast(`Cleared jobs for ${dateName}: ${toDelete.length} 🗑️`);
  }

  function restoreDeletedJobs() {
    triggerHaptic('impact');
    const count = state.deletedIds.size;
    if (count === 0) return;

    state.deletedIds.clear();
    setStorage('upwork_deleted_ids', []);

    renderCalendarModal();
    renderJobsFeed();
    renderSavedFeed();
    renderDailyReport();
    updateBadges();
    showToast(`Restored jobs: ${count} ♻️`);
  }

  // ==========================================
  // Theme Management (Light by default / Telegram Dark)
  // ==========================================
  function initTheme() {
    const savedTheme = getStorage('upwork_theme', 'light');
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    state.theme = theme;
    setStorage('upwork_theme', theme);

    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
      if (el.iconThemeDark) el.iconThemeDark.classList.add('hidden');
      if (el.iconThemeLight) el.iconThemeLight.classList.remove('hidden');

      if (tg?.setHeaderColor) {
        try { tg.setHeaderColor('#17212b'); } catch (_) {}
      }
      if (tg?.setBackgroundColor) {
        try { tg.setBackgroundColor('#17212b'); } catch (_) {}
      }
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      if (el.iconThemeDark) el.iconThemeDark.classList.remove('hidden');
      if (el.iconThemeLight) el.iconThemeLight.classList.add('hidden');

      if (tg?.setHeaderColor) {
        try { tg.setHeaderColor('#ffffff'); } catch (_) {}
      }
      if (tg?.setBackgroundColor) {
        try { tg.setBackgroundColor('#f7f7f7'); } catch (_) {}
      }
    }

    updateChartThemes();
  }

  function toggleTheme() {
    triggerHaptic('selection');
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    showToast(newTheme === 'dark' ? 'Тёмная тема Telegram 🌙' : 'Светлая тема Upwork ☀️');
  }

  // ==========================================
  // PDF Export
  // ==========================================
  async function downloadReportPDF() {
    triggerHaptic('impact');
    showToast('Формирование PDF-отчета... ⏳');

    const dateStr = state.dailyStats?.date || new Date().toISOString().slice(0, 10);
    const pdfFilename = `Upwork_Daily_Report_${dateStr}.pdf`;

    // 1. Извлекаем ровно те вакансии, которые соответствуют текущей статистике дня
    const topJobUrls = new Set((state.dailyStats?.topJobs || []).map((j) => j.url).filter(Boolean));
    const matchedFromTop = (state.jobs || []).filter((j) => topJobUrls.has(j.url));

    const matchedByDate = (state.jobs || []).filter((j) => {
      if (state.deletedIds.has(j.id) || topJobUrls.has(j.url)) return false;
      const pubDate = j.publishedDateTime ? j.publishedDateTime.slice(0, 10) : "";
      const addDate = j.addedAt ? j.addedAt.slice(0, 10) : "";
      return pubDate === dateStr || addDate === dateStr;
    });

    let displayJobs = [...matchedFromTop, ...matchedByDate];

    // Если полных вакансий в ленте нет, но в topJobs они зафиксированы — используем их
    if (displayJobs.length < (state.dailyStats?.topJobs || []).length) {
      const existingUrls = new Set(displayJobs.map((j) => j.url));
      (state.dailyStats?.topJobs || []).forEach((tj) => {
        if (!existingUrls.has(tj.url)) {
          displayJobs.push({
            title: tj.title,
            budgetDisplay: tj.budget,
            score: tj.score,
            url: tj.url,
            description: "",
            client: { country: "Verified Client", totalFeedback: "5.0" }
          });
        }
      });
    }

    if (displayJobs.length === 0) {
      displayJobs = (state.jobs || []).filter((j) => !state.deletedIds.has(j.id)).slice(0, 5);
    }

    displayJobs.sort((a, b) => (b.score || 0) - (a.score || 0));
    const jobsToInclude = displayJobs;

    // Цифры строго из текущего состояния экрана
    const totalScanned = state.dailyStats?.totalScanned || jobsToInclude.length;
    const matched = state.dailyStats?.matchedFilters || jobsToInclude.length;
    const proposalsCount = jobsToInclude.filter((j) => j.coverLetter).length || 0;
    const topScore = jobsToInclude.length > 0
      ? Math.max(...jobsToInclude.map((j) => j.score || 0))
      : (state.dailyStats?.topJobs?.[0]?.score || 0);

    const pdfDate = document.getElementById('pdf-date');
    if (pdfDate) pdfDate.textContent = `Date: ${dateStr}`;

    const pdfScanned = document.getElementById('pdf-scanned');
    const pdfMatched = document.getElementById('pdf-matched');
    const pdfProposals = document.getElementById('pdf-proposals');
    const pdfScore = document.getElementById('pdf-score');

    if (pdfScanned) pdfScanned.textContent = totalScanned;
    if (pdfMatched) pdfMatched.textContent = matched;
    if (pdfProposals) pdfProposals.textContent = proposalsCount;
    if (pdfScore) pdfScore.textContent = topScore > 0 ? topScore : 'N/A';

    const pdfKeywords = document.getElementById('pdf-keywords');
    if (pdfKeywords) {
      const keywords = state.dailyStats?.byKeyword || { "wordpress developer": matched };
      pdfKeywords.innerHTML = Object.entries(keywords).map(([kw, count]) => `
        <span style="border: 1px solid #e4e4e4; background: #f7f7f7; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 500; color: #001e00;">
          ${escapeHtml(kw)} <strong style="color: #14a800;">(${count})</strong>
        </span>
      `).join('');
    }

    const pdfJobsList = document.getElementById('pdf-jobs-list');
    if (pdfJobsList) {
      pdfJobsList.innerHTML = jobsToInclude.map((job, idx) => {
        const targetUrl = job.url || job.applyUrl || (job.ciphertext ? `https://www.upwork.com/jobs/${job.ciphertext}` : 'https://www.upwork.com');
        const budgetDisplay = job.budgetDisplay || (job.isHourly ? `$${job.hourlyBudgetMin || 0} - $${job.hourlyBudgetMax || 0}/hr` : 'Fixed-price');
        const clientCountry = job.client?.country || job.client?.location?.country || 'Unknown';
        const clientFeedback = job.client?.totalFeedback ? Number(job.client.totalFeedback).toFixed(1).replace(/\.0$/, '') : '5';
        const descSnippet = (job.description || '').replace(/\s+/g, ' ').trim().slice(0, 220);

        return `
        <div style="border: 1px solid #e4e4e4; border-radius: 8px; padding: 12px 14px; background: #ffffff; page-break-inside: avoid; break-inside: avoid; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 13px; color: #001e00; line-height: 1.35; max-width: 82%;">
              ${idx + 1}. ${escapeHtml(job.title || 'Untitled Job')}
            </div>
            <span style="background: #e4f7e2; color: #14a800; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px; white-space: nowrap; margin-left: 8px;">
              Score: ${job.score || 'N/A'}
            </span>
          </div>
          <div style="font-size: 11px; color: #5e6d55; margin-bottom: 6px;">
            <strong>Budget:</strong> ${escapeHtml(budgetDisplay)} • <strong>Client:</strong> ${escapeHtml(clientCountry)} (★ ${escapeHtml(clientFeedback)})
          </div>
          <div style="font-size: 11px; color: #333333; line-height: 1.45; margin-bottom: 6px;">
            ${escapeHtml(descSnippet)}${descSnippet.length >= 220 ? '...' : ''}
          </div>
          <div style="font-size: 11px; margin-top: 4px;">
            <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" style="color: #14a800; text-decoration: underline; font-weight: 700; display: inline-block;">
              View Job on Upwork ➔
            </a>
          </div>
        </div>
      `;
      }).join('');
    }

    const element = document.getElementById('pdf-report-container');
    if (!element) return;

    // Сохраняем исходный скролл и перемещаемся наверх, чтобы html2canvas запечатлел элемент без сдвига вьюпорта
    const prevScrollY = window.scrollY;
    window.scrollTo(0, 0);

    // Делаем контейнер видимым для отрисовки в нормальном потоке документа (не absolute!)
    element.classList.remove('pdf-hidden');
    element.style.display = 'block';
    element.style.position = 'relative';
    element.style.width = '760px';
    element.style.margin = '0 auto';
    element.style.background = '#ffffff';
    element.style.opacity = '1';

    // Даем браузеру время для полного расчета геометрии и отрисовки шрифтов
    await new Promise((resolve) => setTimeout(resolve, 200));

    const opt = {
      margin: [8, 8, 8, 8],
      filename: pdfFilename,
      image: { type: 'jpeg', quality: 0.98 },
      enableLinks: true,
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 800
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (window.html2pdf) {
        await window.html2pdf().set(opt).from(element).save();
        showToast('PDF-отчет успешно скачан! 📥');
      } else {
        window.print();
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Ошибка экспорта PDF. Открываем печать...');
      window.print();
    } finally {
      element.classList.add('pdf-hidden');
      element.style.display = 'none';
      element.style.position = '';
      window.scrollTo(0, prevScrollY);
    }
  }

  // Bind Event Listeners
  function bindEvents() {
    // Theme toggle
    if (el.btnThemeToggle) {
      el.btnThemeToggle.addEventListener('click', toggleTheme);
    }

    // PDF Download
    if (el.btnDownloadPdf) {
      el.btnDownloadPdf.addEventListener('click', downloadReportPDF);
    }

    // Navigation tabs
    document.querySelectorAll('.bottom-nav .nav-item[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerHaptic('selection');
        const targetView = btn.dataset.target;
        state.activeTab = targetView;

        document.querySelectorAll('.bottom-nav .nav-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.view-content').forEach((v) => v.classList.remove('active'));
        const targetEl = document.getElementById(targetView);
        if (targetEl) targetEl.classList.add('active');

        // Toggle search & filters visibility
        const filterCarousel = document.querySelector('.filter-carousel');
        if (targetView === 'view-report') {
          if (el.searchBox) el.searchBox.classList.add('hidden');
          if (filterCarousel) filterCarousel.classList.add('hidden');
          else if (el.filterChipsWrapper) el.filterChipsWrapper.classList.add('hidden');
          renderDailyReport();
        } else if (targetView === 'view-analytics') {
          if (el.searchBox) el.searchBox.classList.add('hidden');
          if (filterCarousel) filterCarousel.classList.add('hidden');
          else if (el.filterChipsWrapper) el.filterChipsWrapper.classList.add('hidden');
          renderAnalytics();
        } else {
          if (el.searchBox) el.searchBox.classList.remove('hidden');
          if (filterCarousel) filterCarousel.classList.remove('hidden');
          else if (el.filterChipsWrapper) el.filterChipsWrapper.classList.remove('hidden');
          updateSliderArrows();
        }
      });
    });

    // Filter Chips Slider Logic
    function updateSliderArrows() {
      if (!el.filterChipsWrapper) return;
      const sl = el.filterChipsWrapper.scrollLeft;
      const maxScroll = el.filterChipsWrapper.scrollWidth - el.filterChipsWrapper.clientWidth;

      if (el.btnChipPrev) {
        if (sl <= 6) {
          el.btnChipPrev.classList.add('hidden');
        } else {
          el.btnChipPrev.classList.remove('hidden');
        }
      }

      if (el.btnChipNext) {
        if (sl >= maxScroll - 6) {
          el.btnChipNext.classList.add('hidden');
        } else {
          el.btnChipNext.classList.remove('hidden');
        }
      }
    }

    if (el.filterChipsWrapper) {
      el.filterChipsWrapper.addEventListener('scroll', updateSliderArrows, { passive: true });
      window.addEventListener('resize', updateSliderArrows);

      // Mouse drag-to-scroll for desktop / Telegram Desktop
      let isDragging = false;
      let startX = 0;
      let startScrollLeft = 0;
      let dragMoved = false;

      el.filterChipsWrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragMoved = false;
        startX = e.pageX - el.filterChipsWrapper.offsetLeft;
        startScrollLeft = el.filterChipsWrapper.scrollLeft;
        el.filterChipsWrapper.classList.add('grabbing');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = e.pageX - el.filterChipsWrapper.offsetLeft;
        const walk = (x - startX) * 1.4;
        if (Math.abs(walk) > 4) dragMoved = true;
        el.filterChipsWrapper.scrollLeft = startScrollLeft - walk;
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          el.filterChipsWrapper.classList.remove('grabbing');
        }
      });
    }

    if (el.btnChipPrev) {
      el.btnChipPrev.addEventListener('click', () => {
        triggerHaptic('selection');
        el.filterChipsWrapper.scrollBy({ left: -160, behavior: 'smooth' });
      });
    }

    if (el.btnChipNext) {
      el.btnChipNext.addEventListener('click', () => {
        triggerHaptic('selection');
        el.filterChipsWrapper.scrollBy({ left: 160, behavior: 'smooth' });
      });
    }

    // Quick filter chips
    el.filterChips.querySelectorAll('.chip[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        triggerHaptic('selection');
        el.filterChips.querySelectorAll('.chip[data-filter]').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.quickFilter = chip.dataset.filter;
        chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        renderJobsFeed();
      });
    });

    // Analytics Period Selector
    if (el.periodSelector) {
      el.periodSelector.querySelectorAll('.period-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          triggerHaptic('selection');
          el.periodSelector.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          state.analyticsPeriod = btn.dataset.period;
          renderAnalytics();
        });
      });
    }

    if (el.chipCalendarBtn) {
      el.chipCalendarBtn.addEventListener('click', () => {
        el.chipCalendarBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        openCalendarModal();
      });
    }

    setTimeout(updateSliderArrows, 150);

    // Calendar & Cleanup controls
    if (el.btnOpenCalendar) {
      el.btnOpenCalendar.addEventListener('click', openCalendarModal);
    }
    if (el.btnCloseCalendar) {
      el.btnCloseCalendar.addEventListener('click', closeCalendarModal);
    }
    if (el.btnCloseCalendarFooter) {
      el.btnCloseCalendarFooter.addEventListener('click', closeCalendarModal);
    }
    if (el.modalCalendar) {
      el.modalCalendar.addEventListener('click', (e) => {
        if (e.target === el.modalCalendar) {
          closeCalendarModal();
        }
      });
    }

    if (el.btnResetDateFilter) {
      el.btnResetDateFilter.addEventListener('click', () => {
        triggerHaptic('selection');
        state.selectedDate = 'all';
        updateCalendarIndicators();
        renderCalendarModal();
        renderJobsFeed();
      });
    }

    if (el.btnCleanViewed) {
      el.btnCleanViewed.addEventListener('click', cleanViewedJobs);
    }

    if (el.btnCleanOlder3d) {
      el.btnCleanOlder3d.addEventListener('click', () => cleanOlderJobs(3));
    }

    if (el.btnCleanSelectedDate) {
      el.btnCleanSelectedDate.addEventListener('click', cleanSelectedDateJobs);
    }

    if (el.btnRestoreDeleted) {
      el.btnRestoreDeleted.addEventListener('click', restoreDeletedJobs);
    }

    // Search input
    el.inputSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        el.btnClearSearch.classList.remove('hidden');
      } else {
        el.btnClearSearch.classList.add('hidden');
      }
      renderJobsFeed();
    });

    el.btnClearSearch.addEventListener('click', () => {
      el.inputSearch.value = '';
      state.searchQuery = '';
      el.btnClearSearch.classList.add('hidden');
      renderJobsFeed();
    });

    // Sort select
    el.selectSort.addEventListener('change', (e) => {
      triggerHaptic('selection');
      state.sortBy = e.target.value;
      renderJobsFeed();
    });

    // Sync / Refresh button
    el.btnSync.addEventListener('click', () => {
      triggerHaptic('impact');
      fetchJobs();
      showToast('Refreshed job feed! 🔄');
    });

    // Details Modal controls
    el.btnCloseDetails.addEventListener('click', () => {
      el.modalDetails.classList.add('hidden');
      state.activeJob = null;
    });

    el.modalDetails.addEventListener('click', (e) => {
      if (e.target === el.modalDetails) {
        el.modalDetails.classList.add('hidden');
        state.activeJob = null;
      }
    });

    el.btnDetailsSave.addEventListener('click', () => {
      if (state.activeJob) {
        toggleSave(state.activeJob.id);
      }
    });

    // Filters Modal controls
    el.btnOpenFilters.addEventListener('click', () => {
      triggerHaptic('selection');
      el.modalFilters.classList.remove('hidden');
    });

    el.btnCloseFilters.addEventListener('click', () => {
      el.modalFilters.classList.add('hidden');
    });

    el.modalFilters.addEventListener('click', (e) => {
      if (e.target === el.modalFilters) {
        el.modalFilters.classList.add('hidden');
      }
    });

    // Type buttons in modal
    el.modalFilters.querySelectorAll('.filter-opt-btn[data-type="type"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerHaptic('selection');
        el.modalFilters.querySelectorAll('.filter-opt-btn[data-type="type"]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.filters.type = btn.dataset.val;
      });
    });

    // Min Rate slider
    el.filterMinRate.addEventListener('input', (e) => {
      const val = e.target.value;
      el.rateValueDisplay.textContent = `$${val}/hr`;
      state.filters.minRate = Number(val);
    });

    // Tags selection in modal
    el.tagsSelector.querySelectorAll('.tag-toggle').forEach((tag) => {
      tag.addEventListener('click', () => {
        triggerHaptic('selection');
        const skill = tag.dataset.skill;
        if (state.filters.selectedSkills.has(skill)) {
          state.filters.selectedSkills.delete(skill);
          tag.classList.remove('active');
        } else {
          state.filters.selectedSkills.add(skill);
          tag.classList.add('active');
        }
      });
    });

    // Unviewed checkbox
    el.filterUnviewedOnly.addEventListener('change', (e) => {
      state.filters.onlyUnviewed = e.target.checked;
    });

    // Apply modal filters
    el.btnApplyFilters.addEventListener('click', () => {
      triggerHaptic('impact');
      el.modalFilters.classList.add('hidden');
      renderJobsFeed();
      updateBadges();
      showToast('Filters applied!');
    });

    // Reset modal filters
    el.btnResetFilters.addEventListener('click', resetFilters);
    document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);

    function resetFilters() {
      state.filters.type = 'all';
      state.filters.minRate = 25;
      state.filters.selectedSkills.clear();
      state.filters.onlyUnviewed = false;
      state.quickFilter = 'all';
      state.searchQuery = '';
      state.selectedDate = 'all';
      updateCalendarIndicators();
      el.inputSearch.value = '';
      el.filterMinRate.value = 25;
      el.rateValueDisplay.textContent = '$25/hr';
      el.filterUnviewedOnly.checked = false;

      el.filterChips.querySelectorAll('.chip[data-filter]').forEach((c) => c.classList.remove('active'));
      el.filterChips.querySelector('[data-filter="all"]').classList.add('active');

      el.tagsSelector.querySelectorAll('.tag-toggle').forEach((t) => t.classList.remove('active'));

      el.modalFilters.querySelectorAll('.filter-opt-btn[data-type="type"]').forEach((b) => b.classList.remove('active'));
      el.modalFilters.querySelector('[data-val="all"]').classList.add('active');

      el.modalFilters.classList.add('hidden');
      renderJobsFeed();
      updateBadges();
      showToast('Filters reset to default');
    }

    // Go to feed from empty saved or report
    document.getElementById('btn-go-to-feed')?.addEventListener('click', () => {
      document.querySelector('.bottom-nav .nav-item[data-target="view-jobs"]').click();
    });

    document.getElementById('btn-report-go-feed')?.addEventListener('click', () => {
      triggerHaptic('selection');
      document.querySelector('.bottom-nav .nav-item[data-target="view-jobs"]').click();
    });
  }

  // Start Application
  initTheme();
  bindEvents();
  fetchJobs();
})();
