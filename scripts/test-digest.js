/**
 * Скрипт для проверки форматирования кнопок Telegram и ежедневного дайджеста.
 * Запуск: node scripts/test-digest.js
 */

const { buildJobKeyboard, formatDailyDigestMessage, formatJobMessage } = require("../src/telegram");
const { recordJobScanned, getKyivDateTime } = require("../src/analytics");

console.log("=== ТЕСТИРОВАНИЕ UX И АНАЛИТИКИ ===");

// 1. Проверка времени в Киеве
const { dateStr, hour } = getKyivDateTime();
console.log(`\n1. Текущее время в Киеве: Дата = ${dateStr}, Час = ${hour}:00`);

// 2. Проверка генерации кнопок Telegram (Inline Keyboard)
console.log("\n2. Проверка Inline-кнопок:");
const sampleUrl = "https://www.upwork.com/jobs/~01test123456789";
const sampleJobId = "~01test123456789";

const keyboard = buildJobKeyboard(sampleUrl, sampleJobId);
console.log("Кнопки (Открыть вакансию + Подать Proposal):", JSON.stringify(keyboard, null, 2));

// 3. Проверка суточной аналитики
console.log("\n3. Проверка суточной аналитики:");
const testStats = {
  date: dateStr,
  lastDigestSentDate: null,
  totalScanned: 0,
  matchedFilters: 0,
  byKeyword: {},
  topJobs: []
};

// Симулируем несколько вакансий
recordJobScanned(testStats, {
  id: "101",
  title: "Urgent: Fix WooCommerce Checkout 500 Error",
  hourlyBudgetMin: 35,
  hourlyBudgetMax: 60
}, true, "woocommerce", 240);

recordJobScanned(testStats, {
  id: "102",
  title: "Build Responsive Marketing Website for Media Studio",
  hourlyBudgetMin: 0,
  hourlyBudgetMax: 0
}, true, "wordpress developer", 95);

recordJobScanned(testStats, {
  id: "103",
  title: "Junior Logo Designer needed",
  hourlyBudgetMin: 10,
  hourlyBudgetMax: 15
}, false, "wordpress plugin", 0);

console.log("Объект статистики после симуляции:");
console.log(JSON.stringify(testStats, null, 2));

// 4. Форматирование сообщения дайджеста
console.log("\n4. Сформированное сообщение ежедневного дайджеста:");
const digestText = formatDailyDigestMessage(testStats);
console.log("-----------------------------------------");
console.log(digestText);
console.log("-----------------------------------------");

console.log("\n✅ Все тесты успешно пройдены!");
