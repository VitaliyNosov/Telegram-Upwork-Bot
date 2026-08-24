const fs = require("fs");
const path = require("path");

function loadSeenJobs(filePath) {
  const fullPath = path.join(__dirname, "..", filePath);
  if (!fs.existsSync(fullPath)) {
    return new Set();
  }
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    return new Set(data);
  } catch (err) {
    console.error("Не удалось прочитать seen_jobs.json, начинаем с пустого списка:", err.message);
    return new Set();
  }
}

function saveSeenJobs(filePath, seenSet) {
  const fullPath = path.join(__dirname, "..", filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify([...seenSet], null, 2));
}

module.exports = { loadSeenJobs, saveSeenJobs };
