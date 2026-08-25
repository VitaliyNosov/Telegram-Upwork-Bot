// Cloudflare Worker для запуска GitHub Action по расписанию.
// Позволяет запускать парсер Upwork без задержек.

export default {
  async fetch(request, env, ctx) {
    // Позволяет запустить экшен вручную при переходе по ссылке в браузере
    try {
      await triggerGitHubAction(env);
      return new Response("GitHub Action triggered successfully!", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    } catch (err) {
      return new Response(`Error: ${err.message}`, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
  },

  async scheduled(event, env, ctx) {
    console.log(`[${new Date().toISOString()}] Scheduled trigger fired.`);
    ctx.waitUntil(triggerGitHubAction(env));
  }
};

async function triggerGitHubAction(env) {
  if (!env.GITHUB_PAT) {
    throw new Error("Секрет GITHUB_PAT не настроен в Cloudflare.");
  }

  // URL для запуска workflow poll.yml на GitHub
  const url = "https://api.github.com/repos/VitaliyNosov/Telegram-Upwork-Bot/actions/workflows/poll.yml/dispatches";

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_PAT}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "Cloudflare-Worker-Trigger",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      ref: "main" // Запускаем workflow на ветке main
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GitHub API returned status ${resp.status}: ${errText}`);
  }

  console.log("Successfully triggered GitHub Action workflow!");
}
