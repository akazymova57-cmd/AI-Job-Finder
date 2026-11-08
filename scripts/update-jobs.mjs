import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const APP_CONFIG = require("../config.js");
const source = APP_CONFIG.sources.remotive;
const API_URL = source.apiUrl + "?limit=1000";

function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function validJob(job, now) {
  if (!job || !clean(job.title) || !clean(job.company_name)) return false;
  const date = Date.parse(job.publication_date || job.created_at || "");
  if (!Number.isFinite(date) || date > now || now - date > APP_CONFIG.maxJobAgeDays * 86400000) return false;

  try {
    const url = new URL(job.url);
    const hostAllowed = source.allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host)
    );
    if (url.protocol !== "https:" || !hostAllowed) return false;
  } catch {
    return false;
  }

  const text = clean([job.title, job.description, job.salary].join(" "));
  return !APP_CONFIG.fraudPatterns.some((pattern) => pattern.test(text));
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
await writeFile(
  new URL("../data/jobs.json", import.meta.url),
  JSON.stringify({
    source: source.label,
    updatedAt: new Date(now).toISOString(),
    maxAgeDays: APP_CONFIG.maxJobAgeDays,
    jobs
  }, null, 2) + "\n"
);
console.log(`Saved ${jobs.length} current unique vacancies.`);
