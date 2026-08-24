# Telegram Upwork Job Bot

![Telegram Upwork Bot Banner](img-git/github-baner-telegram-upwork-bot.png)

A powerful, customizable Telegram bot designed to fetch, filter, and deliver new Upwork jobs matching your search criteria directly to your Telegram chat or channel in real-time. Never miss a job opportunity again!

## 🚀 Features

- **Real-time Monitoring:** Continuously tracks Upwork job feeds for newly posted jobs.
- **Customizable Search Filters:** Filter by keywords, categories, budget range, job type (hourly or fixed), client payment verification status, and required experience level.
- **Detailed Telegram Notifications:** Delivers rich messages containing job title, description snippet, budget, tags, link to the job post, and client information.
- **Duplicate Prevention:** Utilizes a lightweight local database to ensure you never receive duplicate notifications for the same job.
- **Channel/Group Support:** Can broadcast alerts to direct chats, private groups, or public Telegram channels.

## 🛠️ Built With

* [Python 3.10+](https://www.python.org/)
* [python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot) - For seamless Telegram API integration.
* [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) / [Feedparser](https://github.com/kurtmckee/feedparser) - For parsing Upwork RSS/Atom feeds.
* [SQLite](https://sqlite.org/index.html) - For tracking sent job IDs.

## 🏁 Getting Started

Follow these steps to set up and run your own Telegram Upwork Bot.

### Prerequisites

1. **Python:** Make sure Python 3.10 or higher is installed.
2. **Telegram Bot Token:**
   - Talk to [@BotFather](https://t.me/BotFather) on Telegram to create a new bot and obtain the API Token.
3. **Telegram Chat ID:**
   - Get the chat/channel/group ID where the bot should send job posts. You can use a bot like [@userinfobot](https://t.me/userinfobot) or check the channel info.
4. **Upwork RSS/Search Feed URL:**
   - Go to Upwork, perform a search with your desired filters, and click on the **RSS feed icon** (Atom/RSS feed link) to copy the URL.

### Installation

1. Clone this repository to your local machine (or navigate to the project directory):
   ```bash
   git clone https://github.com/yourusername/Telegram-Upwork-Bot.git
   cd Telegram-Upwork-Bot
   ```

2. Create a virtual environment and activate it:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Configuration

Create a `.env` file in the root directory of the project and populate it with your environment variables:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_or_channel_id
UPWORK_FEED_URLS=https://www.upwork.com/ab/feed/jobs/rss?q=python...,https://www.upwork.com/ab/feed/jobs/rss?q=react...
CHECK_INTERVAL_SECONDS=300
```

*Note: You can specify multiple feed URLs separated by commas.*

## 🚀 Running the Bot

Start the bot locally:
```bash
python main.py
```

## 🐳 Docker Deployment (Optional)

You can also run the bot containerized using Docker:

1. Build the Docker image:
   ```bash
   docker build -t telegram-upwork-bot .
   ```

2. Run the container:
   ```bash
   docker run -d --name upwork-bot --env-file .env telegram-upwork-bot
   ```

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvement, please open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
