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
    searchBox: document.querySelector('.search-box'),
    navJobsBadge: document.getElementById('nav-jobs-badge'),
    navSavedBadge: document.getElementById('nav-saved-badge'),
    navFilterDot: document.getElementById('nav-filter-indicator'),
    btnSync: document.getElementById('btn-sync'),

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
    reportJobsCount: document.getElementById('report-jobs-count'),
    reportJobsList: document.getElementById('report-jobs-list'),
    pdfContainer: document.getElementById('pdf-report-container'),
    
    // Modals
    modalDetails: document.getElementById('modal-details'),
    detailJobBody: document.getElementById('detail-job-body'),
    btnCloseDetails: document.getElementById('btn-close-details'),
    btnDetailsSave: document.getElementById('btn-details-save'),
    btnModalApply: document.getElementById('btn-modal-apply'),
    
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
    let list = [...state.jobs];

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
    return state.jobs.filter((j) => state.savedIds.has(j.id));
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
      openJobModal(job);
    });

    return card;
  }

  // Render Functions
  function renderAll() {
    renderJobsFeed();
    renderSavedFeed();
    renderDailyReport();
    updateBadges();
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

    if (el.reportJobsList) {
      el.reportJobsList.innerHTML = '';
      if (el.reportJobsCount) el.reportJobsCount.textContent = `${state.jobs.length} вакансий`;

      state.jobs.forEach((job) => {
        const isHourly = job.isHourly;
        const budgetText = isHourly
          ? `$${job.hourlyBudgetMin || 0} - $${job.hourlyBudgetMax || 0}/hr`
          : 'Fixed-price';

        const country = job.client?.country || 'Unknown';
        const rating = job.client?.totalFeedback ? Number(job.client.totalFeedback).toFixed(1) : '5.0';

        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
          <div class="card-header">
            <span class="card-time">Сегодня</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${job.score ? `<span class="badge-score">Score: ${job.score}</span>` : ''}
              <button class="card-save-btn ${state.savedIds.has(job.id) ? 'saved' : ''}" data-id="${job.id}" aria-label="Save job">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${state.savedIds.has(job.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
          </div>
          <h2 class="card-title">${escapeHtml(job.title)}</h2>
          <div class="card-budget">${escapeHtml(budgetText)}</div>
          <div class="card-footer">
            <span class="client-stat client-verified">✓ Verified</span>
            <span class="client-stat">★ ${rating}</span>
            <span class="client-stat">📍 ${escapeHtml(country)}</span>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="btn btn-secondary btn-report-details" style="flex: 1; padding: 8px 12px; font-size: 13px;">
              📋 AI Proposal
            </button>
            <a href="${job.url}" target="_blank" class="btn btn-primary" style="flex: 1; padding: 8px 12px; font-size: 13px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span>🚀 Upwork</span>
            </a>
          </div>
        `;

        card.querySelector('.btn-report-details').addEventListener('click', (e) => {
          e.stopPropagation();
          openJobModal(job);
        });

        card.querySelector('.card-save-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSave(job.id);
        });

        card.addEventListener('click', () => openJobModal(job));

        el.reportJobsList.appendChild(card);
      });
    }
  }

  function updateBadges() {
    const unviewedCount = state.jobs.filter((j) => !state.viewedIds.has(j.id)).length;
    if (unviewedCount > 0) {
      el.navJobsBadge.textContent = unviewedCount > 99 ? '99+' : unviewedCount;
      el.navJobsBadge.classList.remove('hidden');
    } else {
      el.navJobsBadge.classList.add('hidden');
    }

    const savedCount = state.savedIds.size;
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

  // Open Details Modal
  function openJobModal(job) {
    state.activeJob = job;
    markViewed(job.id);
    triggerHaptic('selection');

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
      coverLetterSection = `
        <div class="ai-proposal-card">
          <div class="ai-card-header">
            <span class="ai-card-title">✨ AI Proposal Assistant</span>
            <button id="btn-copy-proposal" class="btn btn-secondary" style="font-size: 12px; padding: 5px 12px;">
              📋 Copy Proposal
            </button>
          </div>
          <div class="ai-proposal-body">${escapeHtml(job.coverLetter)}</div>
          <span style="font-size: 11px; color: var(--text-muted);">
            💡 Tailored to your resume and the client's problem. You can paste it into Upwork and review before submitting.
          </span>
        </div>
      `;
    }

    el.detailJobBody.innerHTML = `
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
        Posted ${formatRelativeTime(job.publishedDateTime)} • ${job.score ? `Score: ${job.score}` : ''}
      </div>
      <h1 class="detail-title">${escapeHtml(job.title)}</h1>

      <div class="detail-price-box">
        <div>
          <div style="font-size: 11px; color: var(--text-muted);">${isHourly ? 'Hourly Rate' : 'Job Type'}</div>
          <div class="price-main">${escapeHtml(budgetText)}</div>
        </div>
        ${job.client?.verificationStatus === 'VERIFIED' ? '<span class="verified-badge">✓ Payment verified</span>' : ''}
      </div>

      <div class="detail-section-title">Job Description</div>
      <div class="detail-description">${escapeHtml(job.description)}</div>

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

    // Event listener for copy button
    const copyBtn = document.getElementById('btn-copy-proposal');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyToClipboard(job.coverLetter);
        triggerHaptic('impact');
        showToast('Proposal copied to clipboard! 📋');
      });
    }

    // Apply button URL
    el.btnModalApply.onclick = () => {
      const targetUrl = job.applyUrl || job.url;
      triggerHaptic('impact');
      if (tg?.openLink) {
        tg.openLink(targetUrl);
      } else {
        window.open(targetUrl, '_blank');
      }
    };

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
  function downloadReportPDF() {
    triggerHaptic('impact');
    showToast('Формирование PDF отчета... ⏳');

    const dateStr = state.dailyStats?.date || new Date().toISOString().slice(0, 10);
    const pdfDate = document.getElementById('pdf-date');
    if (pdfDate) pdfDate.textContent = `Дата: ${dateStr}`;

    const totalScanned = state.dailyStats?.totalScanned || Math.max(state.jobs.length * 6, 28);
    const matched = state.dailyStats?.matchedFilters || state.jobs.length;
    const proposalsCount = state.jobs.filter((j) => j.coverLetter).length;
    const topScore = Math.max(0, ...state.jobs.map((j) => j.score || 0));

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
      const keywords = state.dailyStats?.byKeyword || { "wordpress developer": 2, "woocommerce": 1, "api integration": 1 };
      pdfKeywords.innerHTML = Object.entries(keywords).map(([kw, count]) => `
        <span style="border: 1px solid #e4e4e4; background: #f7f7f7; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 500;">
          ${escapeHtml(kw)} <strong style="color: #14a800;">(${count})</strong>
        </span>
      `).join('');
    }

    const pdfJobsList = document.getElementById('pdf-jobs-list');
    if (pdfJobsList) {
      pdfJobsList.innerHTML = state.jobs.slice(0, 10).map((job, idx) => `
        <div style="border: 1px solid #e4e4e4; border-radius: 8px; padding: 12px; background: #ffffff; page-break-inside: avoid; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 13px; color: #001e00;">${idx + 1}. ${escapeHtml(job.title)}</div>
            <span style="background: #e4f7e2; color: #14a800; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px; white-space: nowrap;">
              Score: ${job.score || 'N/A'}
            </span>
          </div>
          <div style="font-size: 11px; color: #5e6d55; margin-bottom: 6px;">
            <strong>Бюджет:</strong> ${escapeHtml(job.budgetDisplay || (job.isHourly ? `$${job.hourlyBudgetMin}-$${job.hourlyBudgetMax}/hr` : 'Fixed'))} •
            <strong>Клиент:</strong> ${escapeHtml(job.client?.country || 'Unknown')} (★ ${job.client?.totalFeedback || '5.0'})
          </div>
          <div style="font-size: 11px; color: #333333; line-height: 1.4; margin-bottom: 6px;">
            ${escapeHtml((job.description || '').slice(0, 220))}...
          </div>
          <div style="font-size: 10px;">
            <a href="${job.url}" target="_blank" style="color: #14a800; text-decoration: underline; font-weight: 600;">
              Открыть вакансию на Upwork ➔
            </a>
          </div>
        </div>
      `).join('');
    }

    const element = document.getElementById('pdf-report-container');
    if (!element) return;

    element.style.display = 'block';

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Upwork_Daily_Report_${dateStr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save().then(() => {
        element.style.display = 'none';
        showToast('PDF отчет успешно скачан! 📥');
      }).catch((err) => {
        console.error('PDF export error:', err);
        element.style.display = 'none';
        window.print();
      });
    } else {
      element.style.display = 'none';
      window.print();
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
        if (targetView === 'view-report') {
          if (el.searchBox) el.searchBox.classList.add('hidden');
          if (el.filterChipsWrapper) el.filterChipsWrapper.classList.add('hidden');
          renderDailyReport();
        } else {
          if (el.searchBox) el.searchBox.classList.remove('hidden');
          if (el.filterChipsWrapper) el.filterChipsWrapper.classList.remove('hidden');
        }
      });
    });

    // Quick filter chips
    el.filterChips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        triggerHaptic('selection');
        el.filterChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.quickFilter = chip.dataset.filter;
        renderJobsFeed();
      });
    });

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
      el.inputSearch.value = '';
      el.filterMinRate.value = 25;
      el.rateValueDisplay.textContent = '$25/hr';
      el.filterUnviewedOnly.checked = false;

      el.filterChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      el.filterChips.querySelector('[data-filter="all"]').classList.add('active');

      el.tagsSelector.querySelectorAll('.tag-toggle').forEach((t) => t.classList.remove('active'));

      el.modalFilters.querySelectorAll('.filter-opt-btn[data-type="type"]').forEach((b) => b.classList.remove('active'));
      el.modalFilters.querySelector('[data-val="all"]').classList.add('active');

      el.modalFilters.classList.add('hidden');
      renderJobsFeed();
      updateBadges();
      showToast('Filters reset to default');
    }

    // Go to feed from empty saved
    document.getElementById('btn-go-to-feed').addEventListener('click', () => {
      document.querySelector('.bottom-nav .nav-item[data-target="view-jobs"]').click();
    });
  }

  // Start Application
  initTheme();
  bindEvents();
  fetchJobs();
})();
