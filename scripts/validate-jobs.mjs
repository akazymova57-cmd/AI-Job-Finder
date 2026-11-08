import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const config = require("../config.js");
const snapshot = JSON.parse(await readFile(new URL("../data/jobs.json", import.meta.url), "utf8"));
if (!Array.isArray(snapshot.jobs)) throw new Error("data/jobs.json must contain a jobs array");
const now = Date.now(), seen = new Set(), issues = [];
for (const [index, job] of snapshot.jobs.entries()) {
  const label = "jobs[" + index + "]";
  if (!job || typeof job !== "object") { issues.push(label + ": invalid job record"); continue; }
  if (!String(job.title || "").trim()) issues.push(label + ": missing title");
  if (!String(job.company_name || "").trim()) issues.push(label + ": missing company");
  const legacyRemotive = !job.source_id && /(^|\\.)remotive\\.com$/i.test((() => { try { return new URL(job.url).hostname; } catch { return ""; } })());
  const source = config.sources[job.source_id] || (legacyRemotive ? config.sources.remotive : null);
  if (!source || (!legacyRemotive && !source.enabled)) { issues.push(label + ": unknown or disabled source " + String(job.source_id)); continue; }
  const date = Date.parse(job.publication_date || "");
  if (!Number.isFinite(date) || date > now || now - date > config.maxJobAgeDays * 86400000) issues.push(label + ": invalid or stale publication date");
  try {
    const url = new URL(job.url);
    const allowed = source.allowedHosts.some(host => url.hostname === host || url.hostname.endsWith("." + host));
    if (url.protocol !== "https:" || !allowed) issues.push(label + ": URL outside " + source.label + " HTTPS allowlist");
  } catch { issues.push(label + ": invalid URL"); }
  const key = String(job.url || "").toLowerCase().replace(/\/$/, "");
  if (key && seen.has(key)) issues.push(label + ": duplicate URL");
  seen.add(key);
  if (config.fraudPatterns.some(pattern => pattern.test([job.title, job.description, job.salary].join(" ")))) issues.push(label + ": suspicious wording");
  if (!legacyRemotive && job.source_name !== source.label) issues.push(label + ": missing or inconsistent source attribution");
}
if (issues.length) { console.error(issues.join("\n")); process.exitCode = 1; }
else {
  const counts = snapshot.jobs.reduce((out, job) => { out[job.source_name] = (out[job.source_name] || 0) + 1; return out; }, {});
  console.log("Validated " + snapshot.jobs.length + " vacancies: " + JSON.stringify(counts));
}
