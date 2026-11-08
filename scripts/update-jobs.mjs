import { mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "./load-config.mjs";

const CONFIG = await loadConfig();
const SOURCE = CONFIG.sources.remotive;
if (!SOURCE.enabled) throw new Error("Remotive source is disabled in config.js");
const API_URL = `${SOURCE.apiUrl}?limit=1000`;
const MAX_AGE_DAYS = CONFIG.maxJobAgeDays;
const TRUSTED_HOSTS = new Set(SOURCE.allowedHosts);
const FRAUD_PATTERNS = CONFIG.fraudPatterns;

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
