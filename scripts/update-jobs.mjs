import { mkdir, readFile, writeFile } from "node:fs/promises";

const CONFIG_PATH = new URL("../config.js", import.meta.url);
const API_URL = "https://remotive.com/api/remote-jobs?limit=1000";
const MAX_AGE_DAYS = 30;
const TRUSTED_HOSTS = new Set(["remotive.com", "www.remotive.com"]);
const FRAUD_PATTERNS = [
  /pay(?:ment)?\s+(?:a\s+)?(?:fee|for\s+training|to\s+apply)/i,
  /upfront\s+(?:fee|payment|deposit)/i,
  /заплатите\s+за\s+(?:трудоустройство|обучение|доступ)/i,
  /оплат\w*\s+(?:трудоустройств|обучени|доступ)/i,
  /send\s+(?:your\s+)?(?:passport|credit\s+card|bank\s+card)/i,
  /пришлите\s+(?:скан\s+)?паспорт|данные\s+(?:банковской\s+)?карт/i,
  /telegram\s+only|whatsapp\s+only|только\s+(?:в\s+)?(?:телеграм|telegram|whatsapp)/i
];

function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function validJob(job, now) {
  if (!job || !clean(job.title) || !clean(job.company_name)) return false;
  const date = Date.parse(job.publication_date || job.created_at || "");
  if (!Number.isFinite(date) || date > now || now - date > MAX_AGE_DAYS * 86400000) return false;
  try {
    const url = new URL(job.url);
    if (url.protocol !== "https:" || !TRUSTED_HOSTS.has(url.hostname)) return false;
  } catch { return false; }
  const text = clean([job.title, job.description, job.salary].join(" "));
  return !FRAUD_PATTERNS.some((pattern) => pattern.test(text));
}

const response = await fetch(API_URL, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`Remotive API returned HTTP ${response.status}`);
const payload = await response.json();
if (!Array.isArray(payload.jobs)) throw new Error("Unexpected Remotive response");

const now = Date.now();
const unique = new Map();
for (const job of payload.jobs) {
  if (!validJob(job, now)) continue;
  const key = clean(job.url).toLowerCase().replace(/\/$/, "");
  if (!unique.has(key)) unique.set(key, job);
}
const jobs = [...unique.values()];
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/jobs.json", import.meta.url), JSON.stringify({
  source: "Remotive",
  updatedAt: new Date(now).toISOString(),
  maxAgeDays: MAX_AGE_DAYS,
  jobs
}, null, 2) + "\n");
console.log(`Saved ${jobs.length} current unique vacancies.`);
