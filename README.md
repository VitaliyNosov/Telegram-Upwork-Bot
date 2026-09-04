# Telegram Upwork Bot with AI Cover Letter Generator & Mini App

![Telegram Upwork Bot Banner](img-git/github-baner-telegram-upwork-bot.png)

A lightweight, serverless Node.js bot and **Telegram Mini App** that monitors Upwork in real-time for high-quality job postings, generates personalized, ready-to-send proposal drafts (Cover Letters) via **Google Gemini AI**, delivers rich alerts with interactive action buttons to your Telegram chat, and provides a full-featured **Upwork-styled Telegram Web App** for browsing, searching, reviewing daily reports, and managing saved jobs.

---

## ⚡ Architecture & Workflow

The bot operates in a semi-automated workflow: it handles 24/7 monitoring, filtering, scoring, proposal drafting, and feed aggregation, while giving you full control via Telegram alerts and the interactive Mini App.

```text
┌─────────────────────────┐
│ ⏰ Cloudflare Worker    │  Runs on cron (every 2–5 min)
└───────────┬─────────────┘
            │  1. Dispatches GitHub Actions workflow
            ▼
┌─────────────────────────┐      2. Queries Search API        ┌────────────────────────┐
│ ⚙️ GitHub Actions Runner│ ────────────────────────────────► │ 🌐 Upwork API          │
│    (src/index.js)       │ ◄──────────────────────────────── │    (GraphQL Search)    │
└───────────┬─────────────┘      3. Returns new job listings  └────────────────────────┘
            │
            ├─► 4. Evaluates filters & calculates score
            │
            ├─► 5. Google Gemini AI drafts custom Cover Letters (src/gemini.js)
            │
            ├─► 6. Updates 150-job rolling feed & Mini App data (docs/data/jobs_feed.json)
            │
            ├─► 7. Tracks daily stats & mirrors to Mini App (docs/data/daily_stats.json)
            │
            ├─► 8. Sends Telegram alerts with 1-tap copy & inline action buttons
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 📱 Telegram Ecosystem                                                  │
│                                                                        │
│  💬 Bot Alerts:                                                        │
│     • Formatted job info + score badge                                 │
│     • <code>One-tap copyable AI proposal</code>                        │
│     • [ 🚀 Открыть вакансию ] & [ ✍️ Подать Proposal ] buttons         │
│     • 📊 Daily 21:00 digest with stats                                 │
│                                                                        │
│  🌐 Telegram Mini App ("Jobs" Menu Button):                            │
│     • Hosted on GitHub Pages (/docs)                                   │
│     • Dual Theme: Authentic Upwork Daylight (default) & Telegram Dark  │
│     • 📊 Daily Report tab: live KPI stats & search query breakdown     │
│     • 📥 1-Click styled PDF Report export with official Upwork logo    │
│     • Keyword search, filter chips, rating & budget sliders            │
│     • Job details bottom sheet modal + 1-tap proposal clipboard copy   │
│     • Local favorites / saved jobs bookmarking                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. 🤖 AI-Powered Cover Letters (Google Gemini Flash)
* **Tailored Proposals:** Analyzes job requirements and aligns them with your actual developer experience from [`data/resume_profile.txt`](data/resume_profile.txt).
* **Client Trap/Verification Detection:** Detects client verification keywords (e.g. *"start your proposal with BLUEBERRY"*) and integrates them immediately.
* **Resilient Engine:** Handles thinking tokens, includes stream parsing safety, automatic retry timeout, and fallback model switching (`gemini-2.5-flash` / `gemini-1.5-flash`).
* **High-Converting Format:** Concise (90–140 words), conversational structure with portfolio links and clear calls-to-action.

### 2. 📱 Telegram Alerts with Interactive Action Buttons
* **One-Tap Mobile Copying:** Cover letters are formatted in Telegram `<code>` blocks for instant tap-to-copy.
* **Direct Action Buttons:**
  * `[ 🚀 Открыть вакансию ]` — Direct link to the Upwork job posting.
  * `[ ✍️ Подать Proposal ]` — Direct link straight to the `/apply` proposal submission form on Upwork.

### 3. 🌐 Upwork-Styled Telegram Mini App (Web App)
* **Dual Theme Support (Light by default / Telegram Dark):**
  * **Daylight Upwork (Default):** Crisp white cards (`#FFFFFF`), light gray backdrop (`#F7F7F7`), dark green-black typography (`#001E00`), and signature Upwork green accents (`#14A800`).
  * **Telegram Dark Mode:** Beautiful dark theme styled after Telegram Desktop (`#17212B` backdrop, `#242F3D` card surface, pure white typography, dual-mode Upwork logo).
  * Fast header toggle button (☀️ / 🌙) with persistent `localStorage` memory and Telegram window header/background synchronization.
* **Official Upwork Brand Assets:** Features the official dual-mode Upwork logo (`logo.png` / `logo-dark.png`).
* **Real-Time Rolling Feed:** Displays the latest 150 filtered Upwork opportunities with automatic synchronization.
* **Search & Filter Suite:**
  * Real-time search across job titles, descriptions, and client countries.
  * Quick filter chips: `All Jobs`, `Hourly Only`, `Fixed-Price`, `$35+/hr`, `Unread`.
  * Advanced filter modal: minimum hourly rate slider, skill tag selector, and unviewed-only toggle.
  * Sorting options: `Newest First`, `Highest Score`, `Highest Budget`.
* **📊 Daily Report & Analytics Tab:**
  * Interactive **Report** tab in bottom navigation.
  * **4 Live KPI Cards:** Total jobs scanned, filtered matches, AI cover letters drafted, and top relevance score.
  * Search queries breakdown with match counts.
  * Full list of today's matched opportunities with direct Upwork link and Proposal buttons.
* **📥 1-Click Styled PDF Export:**
  * Instant generation and download of a branded, print-ready A4 PDF report (`Upwork_Daily_Report_YYYY-MM-DD.pdf`).
  * Complete with official Upwork header logo, date badge, executive KPI grid, keyword tags, and clickable job links.
* **Interactive Bottom Sheet:** Full job details view with budget breakdown, client reputation metrics, and a dedicated **"📋 Скопировать AI Proposal"** button with toast confirmation.
* **Saved Jobs (Favorites):** Bookmarks saved locally on device via `localStorage`.

### 4. 📊 Daily Analytics Digest (21:00 Kyiv)
* Automatically monitors daily execution metrics:
  * Total polling workflow runs
  * Total jobs scanned and evaluated
  * High-relevance jobs matching your criteria
  * AI cover letters generated
  * Error tracking
* Dispatches a formatted summary report to Telegram every evening at 21:00 Kyiv time.

### 5. 🎯 Strict Quality Filters
* **Tier-1 Countries Only:** United States, United Kingdom, Canada, Australia, Germany, Netherlands, Switzerland, etc.
* **Verified Clients:** Payment method verified, minimum 4.5+ star rating, and proven hire history.
* **Budget Thresholds:** Configurable minimums (e.g., $25+/hr hourly, $200+ fixed-price).
* **Smart Exclusions:** Automatically skips design-only or low-relevance jobs.

### 6. ⚡ 100% Serverless & Zero Maintenance Costs
* Powered by **Cloudflare Workers** (cron trigger) and **GitHub Actions** (runner) — no paid VPS required.
* **GitHub Pages** hosts the Mini App frontend directly from the repository's `/docs` folder for free.
* **Zero npm Dependencies:** Core bot built entirely with native Node.js 20+ APIs (`fetch`, `crypto`, `fs`).

---

## 📋 Latest Enhancements & Technical Specifications

A comprehensive upgrade package expanded the Telegram Mini App and background monitoring capabilities:

### 1. 📊 Daily Report Tab in Mini App
* **Purpose & Scope:** Brings the daily analytics and filtered opportunity digest directly into the Telegram Mini App interface for quick review without digging through chat history.
* **Data Pipeline:** Driven by `data/daily_stats.json`, mirrored automatically to `docs/data/daily_stats.json` and `webapp/data/daily_stats.json`.
* **4 Live KPI Metrics:**
  * **Scanned Today:** Total number of Upwork job listings ingested and evaluated during the current day.
  * **Matched Opportunities:** Jobs that fully passed all strict quality criteria (Tier-1 countries, client rating ≥ 4.5, verified payment, minimum budget).
  * **AI Proposals:** Count of tailored, ready-to-send proposal drafts generated by Google Gemini Flash.
  * **Top Relevance Score:** The highest relevance score achieved among today's matched jobs.
* **Search Query Breakdown:** Interactive query badges with live counts of matched opportunities for each search term (e.g. `WordPress: 6`, `WooCommerce: 4`).
* **Today's Opportunities Feed:** Clean cards for all matched jobs with budget badges, client verification, relevance score, and direct action buttons:
  * `[ Open Job ]` — Direct link to the Upwork posting.
  * `[ Proposal ]` — Direct link to the `/apply` proposal submission page.

### 2. 📥 Styled PDF Export (1-Click Client-Side Export)
* **Purpose & Scope:** Instant export of the full daily report as a beautifully styled, print-ready PDF document matching the application design system.
* **Official Upwork Branding:** Embeds the official high-resolution Upwork logo (`logo.png`) in the document header alongside the report date badge (`Upwork_Daily_Report_YYYY-MM-DD.pdf`).
* **Zero-Server Client Rendering:** Utilizes `html2pdf.js` (Canvas + jsPDF) for fast, client-side PDF compilation without server load or third-party paid rendering APIs.
* **A4 Portrait Layout:**
  * Branded header with the official Upwork logo and date stamp.
  * Summary KPI grid (4 metric cards with clean borders and typography).
  * Keyword search breakdown tags.
  * Full list of today's opportunities with scores, budgets, client info, and clickable Upwork links.

### 3. 🌓 Theme Customization: Daylight Default & Telegram Dark Mode
* **Design Standards:**
  * **Daylight Upwork (Default):** Classic Upwork brand aesthetic (crisp white cards `#FFFFFF`, light neutral backdrop `#F7F7F7`, high-contrast typography `#001E00`, signature Upwork green `#14A800`).
  * **Telegram Dark Mode:** Native Telegram Desktop dark palette (`#17212B` window background, `#242F3D` card surfaces, clean white text, `#14A800` / `#5288C1` accents).
* **Controls & Persistence:**
  * Instant theme toggle button (☀️ / 🌙) in the top-right header.
  * Persistent user choice stored in `localStorage`.
  * Deep Telegram WebApp SDK integration: calls `Telegram.WebApp.setHeaderColor()` and `Telegram.WebApp.setBackgroundColor()` to match native Telegram window framing.
  * Adaptive brand assets: switches automatically between `logo.png` (light theme) and `logo-dark.png` (dark theme).

### 4. 🔄 Automated Data Synchronization Pipeline (GitHub Actions)
* **Continuous Real-Time Sync:**
  * Every polling run executed by `src/analytics.js` updates daily metrics and synchronizes them across `data/`, `webapp/data/`, and `docs/data/`.
  * The GitHub Actions workflow (`.github/workflows/poll.yml`) automatically stages, commits, and pushes updated `jobs_feed.json` and `daily_stats.json` files.
  * GitHub Pages instantly serves refreshed data to all Mini App users without requiring bot restarts.

---

## 🛠️ Tech Stack

* **Core Engine:** [Node.js (v20+)](https://nodejs.org/) (Native ES / CommonJS without external dependencies)
* **AI Engine:** [Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`)](https://aistudio.google.com/)
* **APIs:** [Upwork GraphQL API v3](https://developers.upwork.com/) & [Telegram Bot API](https://core.telegram.org/bots/api)
* **Frontend (Mini App):** Vanilla HTML5, CSS3 (Upwork Design System & Telegram Dark Mode), Vanilla ES6 JavaScript, [Telegram WebApp SDK](https://telegram.org/js/telegram-web-app.js), [html2pdf.js](https://raw.githack.com/eKoopmans/html2pdf.js/master/dist/html2pdf.bundle.min.js) (Client-side PDF Generation)
* **Hosting & CI/CD:** [GitHub Actions](https://github.com/features/actions), [GitHub Pages](https://pages.github.com/), [Cloudflare Workers](https://workers.cloudflare.com/)

---

## 📂 Project Structure

```text
├── .github/workflows/
│   └── poll.yml               # GitHub Actions workflow for polling & feed updating
├── cloudflare-worker/
│   └── index.js               # Cloudflare Worker for cron dispatch
├── data/
│   ├── daily_stats.json       # Daily analytics tracking state
│   ├── jobs_feed.json         # Rolling feed of latest 150 processed jobs
│   ├── resume_profile.txt     # Your developer bio, skills, cases, and portfolio
│   └── seen_jobs.json         # Deduplication persistence (processed job IDs)
├── docs/                      # GitHub Pages deployment bundle (Mini App)
│   ├── data/
│   │   ├── daily_stats.json   # Live daily metrics for the Report tab
│   │   └── jobs_feed.json     # Live feed consumed by the Mini App
│   ├── app.js                 # Mini App client logic & Telegram SDK integration
│   ├── index.html             # Mini App HTML structure (Upwork design + Report tab)
│   ├── logo.png               # Official Upwork logo (Light theme & PDF export)
│   ├── logo-dark.png          # Official Upwork logo (Telegram Dark theme)
│   └── styles.css             # Dual-theme stylesheet (Daylight & Telegram Dark)
├── webapp/                    # Mini App source directory (mirrored to docs/)
│   ├── data/
│   │   ├── daily_stats.json
│   │   └── jobs_feed.json
│   ├── app.js
│   ├── index.html
│   ├── logo.png
│   ├── logo-dark.png
│   └── styles.css
├── scripts/
│   ├── seed-feed.js           # Feed generator & verification script
│   └── test-gemini.js         # Isolated test script for AI cover letter generation
├── src/
│   ├── analytics.js           # Polling stats tracker & 21:00 Kyiv digest sender
│   ├── auth.js                # Upwork OAuth2 authentication & token refresh
│   ├── config.js              # Bot configuration, filters, and weights
│   ├── filters.js             # Multi-factor job filtering logic
│   ├── gemini.js              # Google Gemini API integration module
│   ├── index.js               # Main polling engine
│   ├── jobsFeed.js            # 150-job rolling feed manager
│   ├── login.js               # One-time OAuth login script
│   ├── scoring.js             # Relevance scoring algorithm
│   ├── seenJobs.js            # Deduplication persistence
│   ├── telegram.js            # Telegram message builder & inline button sender
│   └── upwork.js              # Upwork GraphQL API queries
├── package.json
└── wrangler.toml              # Cloudflare Worker configuration
```

---

## 🏁 Getting Started

### 1. Prerequisites

* **Node.js 20+** installed locally.
* **Upwork API Keys:** `Client ID` & `Client Secret` from the [Upwork Developer Center](https://www.upwork.com/developer/).
* **Telegram Bot:** Create a bot via [@BotFather](https://t.me/BotFather) and obtain your Bot Token & Chat ID (via [@userinfobot](https://t.me/userinfobot)).
* **Google Gemini API Key:** Free key from [Google AI Studio](https://aistudio.google.com/).
* **GitHub Personal Access Token (PAT):** Token with `repo` scope to allow updating secrets in Actions.

---

### 2. Developer Profile Setup

Edit [`data/resume_profile.txt`](data/resume_profile.txt) with your actual skills, specialties, and portfolio links. Gemini AI reads this file to tailor proposals specifically to your background:

```text
WORDPRESS & WOOCOMMERCE DEVELOPER
==================================
ABOUT: Professional WordPress engineer specializing in custom plugins, checkout fixes, and speed optimization.
CORE SKILLS: PHP, WooCommerce, Custom Plugins, Gutenberg, Core Web Vitals, Stripe API.
PORTFOLIO:
- https://example1.com (Speed optimization from 30 to 85)
- https://example2.com (Custom booking & payment integration)
```

---

### 3. One-Time Upwork OAuth Login

Run the interactive login script locally to authenticate with Upwork:

```bash
$env:UPWORK_CLIENT_ID="your_client_id"
$env:UPWORK_CLIENT_SECRET="your_client_secret"

npm run login
```

1. Open the generated authorization URL in your browser.
2. Log in and authorize access on Upwork.
3. Paste the redirect callback URL back into your terminal prompt to save the initial token.

---

### 4. Testing AI Cover Letter Generation Locally

To test the Gemini AI integration on a sample job without polling Upwork:

```bash
$env:GEMINI_API_KEY="AIzaSyYourGeminiApiKey"
npm run test:gemini
```

---

### 5. Running the Poller Locally

To perform a single manual poll of Upwork:

```bash
npm run poll
```

---

## 📱 Telegram Mini App Setup

### Step 1: Enable GitHub Pages

1. Open your repository on GitHub.
2. Navigate to **Settings -> Pages**.
3. Under **Build and deployment -> Source**, select **Deploy from a branch**.
4. Choose Branch: `main` and Folder: `/docs`. Click **Save**.
5. Your Mini App will be live at: `https://<your-username>.github.io/<repo-name>/`.

### Step 2: Configure the Bot Menu Button in @BotFather

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/setmenubutton` and choose your bot.
3. Send the menu button title: `Jobs`
4. Send your GitHub Pages URL: `https://<your-username>.github.io/<repo-name>/`
5. Done! The `Jobs` button will now appear directly inside your bot's chat interface.

---

## ☁️ Deployment (GitHub Actions + Cloudflare Workers)

### Step 1: Configure GitHub Repository Secrets

Go to **Settings -> Secrets and variables -> Actions** in your GitHub repository and add:

| Secret Name | Description |
| :--- | :--- |
| `UPWORK_CLIENT_ID` | Your Upwork API Client ID |
| `UPWORK_CLIENT_SECRET` | Your Upwork API Client Secret |
| `UPWORK_REFRESH_TOKEN` | Initial refresh token from `data/token.json` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target Telegram Chat / Channel ID |
| `GEMINI_API_KEY` | Google Gemini API key from Google AI Studio |
| `GH_PAT` | GitHub Personal Access Token (for secret updating) |

### Step 2: Set up Cloudflare Worker Scheduler

1. Deploy the worker in `cloudflare-worker/`:
   ```bash
   npx wrangler deploy
   ```
2. In the Cloudflare Dashboard, set the `GITHUB_PAT` secret variable for the worker.
3. The worker will trigger the GitHub Actions workflow according to the cron schedule in `wrangler.toml` (e.g. every 2 minutes).

---

## ⚙️ Filter Customization

You can fine-tune search criteria, rating thresholds, and keywords directly in [`src/config.js`](src/config.js):

* `KEYWORDS`: List of search queries (e.g., `"wordpress developer"`, `"woocommerce"`).
* `FILTERS.MIN_HOURLY_RATE`: Minimum hourly rate (default: `$25`).
* `FILTERS.MIN_FIXED_BUDGET`: Minimum fixed-price budget (default: `$200`).
* `FILTERS.MIN_CLIENT_RATING`: Minimum client rating (default: `4.5`).
* `FILTERS.MIN_CLIENT_POSTED_JOBS`: Minimum number of jobs posted by the client (default: `2`).
* `FILTERS.ALLOWED_COUNTRIES`: Whitelisted Tier-1 countries.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
