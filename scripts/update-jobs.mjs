import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const config = require("../config.js");
const DAY = 86400000;
const MAX_JOBICY_PAGES = 5;
const MAX_HIMALAYAS_PAGES = 10;
const now = Date.now();

function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}
function typeOf(value) {
  const text = clean(Array.isArray(value) ? value.join(" ") : value).toLowerCase();
  if (/part[ -]?time/.test(text)) return "part_time";
  if (/contract|freelance/.test(text)) return "contract";
  if (/intern/.test(text)) return "internship";
  if (/full[ -]?time/.test(text)) return "full_time";
  return text.replace(/\s+/g, "_");
}
function allowedUrl(value, source) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && source.allowedHosts.some(host => url.hostname === host || url.hostname.endsWith("." + host));
  } catch { return false; }
}
function valid(job, source) {
  if (!job || !clean(job.title) || !clean(job.company_name) || !allowedUrl(job.url, source)) return false;
  const date = Date.parse(job.publication_date || "");
  if (!Number.isFinite(date) || date > now || now - date > config.maxJobAgeDays * DAY) return false;
  return !config.fraudPatterns.some(pattern => pattern.test(clean([job.title, job.description, job.salary].join(" "))));
}
function fromRemoteOK(job) {
  const min = Number(job.salary_min || 0), max = Number(job.salary_max || 0);
  return {
    id: "remoteok-" + String(job.id || job.slug), source_id: "remoteok", source_name: "Remote OK",
    source_url: job.url, url: job.url, title: job.position, company_name: job.company,
    company_logo: job.company_logo || job.logo || "", category: (job.tags || [])[0] || "",
    tags: Array.isArray(job.tags) ? job.tags : [], job_type: typeOf(job.tags),
    publication_date: job.date || (job.epoch ? new Date(Number(job.epoch) * 1000).toISOString() : ""),
    candidate_required_location: job.location || "Remote — eligibility not specified",
    salary: min || max ? [min, max].filter(Boolean).join("–") : "", description: job.description || ""
  };
}
function fromJobicy(job) {
  const min = Number(job.salaryMin || 0), max = Number(job.salaryMax || 0);
  const salary = min || max ? [min, max].filter(Boolean).join("–") + (job.salaryCurrency ? " " + job.salaryCurrency : "") + (job.salaryPeriod ? " / " + job.salaryPeriod : "") : "";
  return {
    id: "jobicy-" + String(job.id), source_id: "jobicy", source_name: "Jobicy",
    source_url: job.url, url: job.url, title: job.jobTitle, company_name: job.companyName,
    company_logo: job.companyLogo || "", category: (job.jobIndustry || []).join(", "),
    tags: Array.isArray(job.jobIndustry) ? job.jobIndustry : [], job_type: typeOf(job.jobType),
    job_level: job.jobLevel || "", publication_date: job.pubDate || "",
    candidate_required_location: job.jobGeo || "Remote — eligibility not specified",
    salary, description: job.jobDescription || job.jobExcerpt || ""
  };
}
async function fetchRemoteOK(source) {
  const response = await fetch(source.apiUrl, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const payload = await response.json();
  if (!Array.isArray(payload) || !payload.some(item => typeof item?.legal === "string")) throw new Error("Unexpected response or missing API attribution notice");
  return payload.filter(item => item && item.position).map(fromRemoteOK);
}
async function fetchJobicy(source) {
  const jobs = [];
  let cursor = "";
  for (let page = 0; page < MAX_JOBICY_PAGES; page += 1) {
    const url = new URL(source.apiUrl);
    url.searchParams.set("count", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json();
    if (payload.success === false || !Array.isArray(payload.jobs)) throw new Error(payload.error || "Unexpected API response");
    jobs.push(...payload.jobs.map(fromJobicy));
    cursor = payload.nextCursor || "";
    if (!cursor) break;
  }
  if (cursor) console.warn("Jobicy pagination capped at 500 listings per refresh.");
  return jobs;
}

function xmlText(item, tag) {
  const match = item.match(new RegExp("<" + tag + "[^>]*>([\s\S]*?)</" + tag + ">", "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'").replace(/&amp;/gi, "&").trim();
}
function fromWeWorkRemotely(item) {
  const rawTitle = xmlText(item, "title");
  const split = rawTitle.indexOf(":");
  const company = split > 0 ? rawTitle.slice(0, split).trim() : "";
  const title = split > 0 ? rawTitle.slice(split + 1).trim() : rawTitle;
  const region = xmlText(item, "region");
  const country = xmlText(item, "country");
  const state = xmlText(item, "state");
  const location = [region, country, state].filter(Boolean).join(", ") || "Remote — eligibility not specified";
  const link = xmlText(item, "link") || xmlText(item, "guid");
  const date = Date.parse(xmlText(item, "pubDate"));
  const description = xmlText(item, "description");
  return {
    id: "weworkremotely-" + link, source_id: "weworkremotely", source_name: "We Work Remotely",
    source_url: link, url: link, title, company_name: company, company_logo: "",
    category: xmlText(item, "category"), tags: xmlText(item, "skills").split(",").map(clean).filter(Boolean),
    job_type: typeOf(xmlText(item, "type")), publication_date: Number.isFinite(date) ? new Date(date).toISOString() : "",
    candidate_required_location: location, salary: "", description
  };
}
async function fetchWeWorkRemotely(source) {
  const response = await fetch(source.apiUrl, { headers: { accept: "application/rss+xml, application/xml, text/xml" } });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const xml = await response.text();
  if (!/<rss[\s>]/i.test(xml) || !/<channel[\s>]/i.test(xml)) throw new Error("Unexpected RSS response");
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(match => fromWeWorkRemotely(match[0]));
}
function fromHimalayas(job) {
  const locations = Array.isArray(job.locationRestrictions) ? job.locationRestrictions : [];
  const timezones = Array.isArray(job.timezoneRestrictions) ? job.timezoneRestrictions : [];
  const eligibility = locations.length ? locations.join(", ") : timezones.length
    ? "Remote — timezone restrictions: " + timezones.map(value => "UTC" + (Number(value) >= 0 ? "+" : "") + value).join(", ")
    : "Worldwide";
  const salary = job.minSalary || job.maxSalary
    ? [job.minSalary, job.maxSalary].filter(value => value !== null && value !== undefined).join("–") + (job.currency ? " " + job.currency : "") + (job.salaryPeriod ? " / " + job.salaryPeriod : "")
    : "";
  return {
    id: "himalayas-" + String(job.guid || job.applicationLink || job.title),
    source_id: "himalayas", source_name: "Himalayas",
    source_url: job.guid || job.applicationLink, url: job.applicationLink || job.guid,
    title: job.title, company_name: job.companyName, company_logo: job.companyLogo || "",
    category: (job.parentCategories || job.categories || []).join(", "),
    tags: [...(job.parentCategories || []), ...(job.categories || [])],
    job_type: typeOf(job.employmentType), job_level: (job.seniority || []).join(", "),
    publication_date: job.pubDate ? new Date(Number(job.pubDate) * 1000).toISOString() : "",
    candidate_required_location: eligibility, salary, description: job.description || job.excerpt || ""
  };
}
async function fetchHimalayas(source) {
  const jobs = [];
  let cursor = "";
  for (let page = 0; page < MAX_HIMALAYAS_PAGES; page += 1) {
    const url = new URL(source.apiUrl);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.jobs)) throw new Error("Unexpected API response");
    jobs.push(...payload.jobs.map(fromHimalayas));
    cursor = payload.nextCursor || "";
    if (!cursor || payload.jobs.length === 0) break;
  }
  if (cursor) console.warn("Himalayas pagination capped at " + MAX_HIMALAYAS_PAGES + " pages per refresh.");
  return jobs;
}

async function readPrevious() {
  try { return JSON.parse(await readFile(new URL("../data/jobs.json", import.meta.url), "utf8")); }
  catch { return { jobs: [] }; }
}
const previous = await readPrevious();
const sourceStatuses = [], collected = [];
for (const [id, source] of Object.entries(config.sources)) {
  if (!source.enabled) continue;
  try {
    const incoming = id === "remoteok" ? await fetchRemoteOK(source) : id === "jobicy" ? await fetchJobicy(source) : id === "weworkremotely" ? await fetchWeWorkRemotely(source) : id === "himalayas" ? await fetchHimalayas(source) : [];
    const accepted = incoming.filter(job => valid(job, source));
    collected.push(...accepted);
    sourceStatuses.push({ id, label: source.label, status: "success", fetchedAt: new Date(now).toISOString(), received: incoming.length, accepted: accepted.length });
    console.log(source.label + ": " + incoming.length + " received, " + accepted.length + " accepted");
  } catch (error) {
    const retained = (Array.isArray(previous.jobs) ? previous.jobs : []).filter(job => job.source_id === id && valid(job, source));
    collected.push(...retained);
    sourceStatuses.push({ id, label: source.label, status: "error", fetchedAt: new Date(now).toISOString(), retained: retained.length, error: String(error.message || error) });
    console.error(source.label + " failed: " + String(error.message || error) + "; retained " + retained.length + " current records");
  }
}
if (!sourceStatuses.some(item => item.status === "success")) throw new Error("All enabled sources failed; previous snapshot was not overwritten.");
const unique = new Map();
for (const job of collected) {
  const urlKey = job.url.toLowerCase().replace(/\/$/, "");
  const fingerprint = [clean(job.title), clean(job.company_name), clean(job.candidate_required_location)].join("|").toLowerCase().replace(/\s+/g, " ");
  const key = urlKey || fingerprint;
  if (!unique.has(key)) unique.set(key, job);
}
const jobs = [...unique.values()].sort((a, b) => Date.parse(b.publication_date) - Date.parse(a.publication_date));
const snapshot = { updatedAt: new Date(now).toISOString(), maxAgeDays: config.maxJobAgeDays, sourceStatuses, jobs };
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/jobs.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
console.log("Saved " + jobs.length + " unique current vacancies.");
