# Telegram Upwork Bot with AI Cover Letter Generator

![Telegram Upwork Bot Banner](img-git/github-baner-telegram-upwork-bot.png)

A lightweight, serverless Node.js bot that monitors Upwork in real-time for high-quality job postings, generates personalized, ready-to-send proposal drafts (Cover Letters) via **Google Gemini AI**, and delivers rich alerts to your Telegram chat with **1-tap mobile copying**.

---

## ⚡ Architecture & Workflow

The bot operates in a semi-automated mode: it takes care of all the monitoring, filtering, and proposal drafting, while you retain full control over reviewing and submitting applications directly on Upwork.

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
            │  4. Evaluates filters & calculates score
            ▼
┌─────────────────────────┐      5. Job + resume_profile.txt  ┌────────────────────────┐
│ 🤖 Google Gemini AI     │ ◄──────────────────────────────── │ 📄 Developer Profile   │
│    (gemini-3.5-flash)   │ ────────────────────────────────► │    (data/profile.txt)  │
└───────────┬─────────────┘      6. Custom Cover Letter draft └────────────────────────┘
            │
            │  7. Sends HTML alert with <code>1-tap copy draft</code>
            ▼
┌─────────────────────────┐
│ 📱 Telegram Bot Alert   │ ──► 👨‍💻 Freelancer (Reviews, copies, submits on Upwork)
└─────────────────────────┘
```

---

## 🚀 Key Features

* 🤖 **AI-Powered Cover Letters (Google Gemini 3.5 Flash):**
  * Automatically analyzes job requirements and matches them with your actual experience from [`data/resume_profile.txt`](data/resume_profile.txt).
  * Detects client secret verification words / questions (e.g. *"start your proposal with BLUEBERRY"*) and addresses them immediately.
  * Formats concise (90–140 words), conversational proposals with strong calls-to-action and relevant portfolio links.
* 📱 **One-Tap Mobile Copying:** Cover letters are formatted in Telegram `<code>` blocks, allowing you to copy the entire proposal into your clipboard with a single tap on your smartphone.
* 🎯 **Strict Quality Filters:**
  * **Tier-1 Countries Only:** United States, United Kingdom, Canada, Australia, Germany, Netherlands, Switzerland, etc.
  * **Verified Clients:** Payment method verified, minimum 4.5+ star rating, and proven hire history.
  * **Budget Thresholds:** Configurable minimums (e.g., $25+/hr hourly, $200+ fixed-price).
  * **Smart Exclusions:** Automatically skips design-only or low-relevance jobs.
* ⚡ **100% Serverless & Free:** Powered by Cloudflare Workers (cron trigger) and GitHub Actions — zero server costs and no 24/7 VPS required.
* 🔄 **Automated OAuth Token Rotation:** Automatically refreshes the Upwork OAuth2 token and syncs the new refresh token back into GitHub Repository Secrets via GitHub CLI.
* 📦 **Zero npm Dependencies:** Built entirely with native Node.js 20+ APIs (`fetch`, `crypto`, `fs`).

---

## 🛠️ Tech Stack

* **Runtime:** [Node.js (v20+)](https://nodejs.org/) (Native ES / CommonJS without external libraries)
* **AI Engine:** [Google Gemini API (`gemini-3.5-flash`)](https://aistudio.google.com/)
* **APIs:** [Upwork GraphQL API v3](https://developers.upwork.com/) & [Telegram Bot API](https://core.telegram.org/bots/api)
* **Automation:** [GitHub Actions](https://github.com/features/actions) + [Cloudflare Workers](https://workers.cloudflare.com/)

---

## 📂 Project Structure

```text
├── .github/workflows/
│   └── poll.yml               # GitHub Actions workflow for polling Upwork
├── cloudflare-worker/
│   └── index.js               # Cloudflare Worker for cron dispatch
├── data/
│   ├── resume_profile.txt     # Your developer bio, skills, cases, and portfolio
│   └── seen_jobs.json         # State file storing processed job IDs
├── scripts/
│   └── test-gemini.js         # Isolated test script for AI cover letter generation
├── src/
│   ├── auth.js                # Upwork OAuth2 authentication & token refresh
│   ├── config.js              # Bot configuration, filters, and weights
│   ├── filters.js             # Multi-factor job filtering logic
│   ├── gemini.js              # Google Gemini API integration module
│   ├── index.js               # Main polling engine
│   ├── login.js               # One-time OAuth login script
│   ├── scoring.js             # Relevance scoring algorithm
│   ├── seenJobs.js            # Deduplication persistence
│   ├── telegram.js            # Telegram message builder & sender
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

Edit [`data/resume_profile.txt`](data/resume_profile.txt) with your actual skills, specialties, and portfolio links. The Gemini AI module reads this file to tailor proposals specifically to your background:

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
# Set your Upwork API credentials in terminal or .env
$env:UPWORK_CLIENT_ID="your_client_id"
$env:UPWORK_CLIENT_SECRET="your_client_secret"

npm run login
```

1. Open the generated authorization URL in your browser.
2. Log in and authorize access on Upwork.
3. Paste the redirect callback URL back into your terminal prompt to save the initial token.

---

### 4. Testing AI Cover Letter Generation Locally

To test the Gemini AI integration on a sample WordPress/WooCommerce job without polling Upwork:

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
