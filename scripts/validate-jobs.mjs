import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const config = require("../config.js");
const snapshot = JSON.parse(await readFile(new URL("../data/jobs.json", import.meta.url), "utf8"));
if (!Array.isArray(snapshot.jobs)) throw new Error("data/jobs.json must contain a jobs array");

const now = Date.now();
const seen = new Set();
const issues = [];
for (const [index, job] of snapshot.jobs.entries()) {
  const label = "jobs[" + index + "]";
  if (!job || typeof job !== "object") {
    issues.push(label + ": invalid job record");
    continue;
  }
  if (!String(job.title || "").trim()) issues.push(label + ": missing title");
  if (!job || !String(job.company_name || "").trim()) issues.push(label + ": missing company");
  const publishedAt = Date.parse(job?.publication_date || job?.created_at || "");
  if (!Number.isFinite(publishedAt) || publishedAt > now || now - publishedAt > config.maxJobAgeDays * 86400000) {
    issues.push(label + ": invalid or stale publication date");
  }
  try {
    const url = new URL(job.url);
    const allowed = config.sources.remotive.allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith("." + host));
    if (url.protocol !== "https:" || !allowed) issues.push(label + ": URL outside HTTPS allowlist");
  } catch {
    issues.push(label + ": invalid URL");
  }
  const key = String(job.url || "").toLowerCase().replace(/\/$/, "");
  if (key && seen.has(key)) issues.push(label + ": duplicate URL");
  seen.add(key);
  const text = [job.title, job.description, job.salary].join(" ");
  if (config.fraudPatterns.some((pattern) => pattern.test(text))) issues.push(label + ": suspicious wording");
}
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Validated " + snapshot.jobs.length + " unique current vacancies.");
}
