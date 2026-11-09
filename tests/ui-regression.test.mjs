import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [css, html, app] = await Promise.all([
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8")
]);

const themeStart = css.lastIndexOf("/* AI Job Finder — graphite and emerald theme */");
assert.notEqual(themeStart, -1, "the final graphite/emerald theme layer must exist");
const theme = css.slice(themeStart);

test("final theme uses emerald and contains no blue accent values", () => {
  assert.match(theme, /--accent:\s*#27866f/i);
  assert.match(theme, /--accent-strong:\s*#1f6b5b/i);
  assert.match(theme, /--accent-soft:\s*#e8f3ee/i);
  assert.match(theme, /--blue:\s*var\(--accent\)/i);
  assert.doesNotMatch(theme, /#(?:356dff|326bdf|2857e8|9bb4ff|5b88ff|4078ff|2d5fe9)/i);
  assert.doesNotMatch(theme, /cornflowerblue|dodgerblue|royalblue|steelblue|deepskyblue/i);
});

test("responsive shell has explicit mobile drawer and desktop grid breakpoints", () => {
  assert.match(theme, /@media\s*\(min-width:\s*1024px\)/);
  assert.match(theme, /@media\s*\(max-width:\s*1023px\)/);
  assert.match(theme, /body\.sidebar-open/);
  assert.ok(theme.includes(".sidebar-backdrop"));
  assert.match(theme, /min-width:\s*0/);
  assert.match(theme, /overflow-x:\s*clip/);
});

test("existing application controls remain available to app.js", () => {
  for (const id of [
    "sidebar-open", "sidebar-close", "sidebar-backdrop", "sidebar-nav",
    "location", "level", "type", "sort", "salary-only", "no-experience-only",
    "jobs", "pagination", "pagination-top", "no-english-required-only", "no-degree-required-only"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

test("mobile drawer is hidden from tab order and has keyboard focus management", () => {
  assert.ok(theme.includes("visibility:hidden"));
  assert.ok(theme.includes("body.sidebar-open .filter-sidebar{transform:translateX(0);visibility:visible}"));
  assert.ok(app.includes("function openSidebar()"));
  assert.ok(app.includes('event.key !== "Tab"'));
  assert.ok(app.includes("sidebarToggle?.focus()"));
  assert.ok(app.includes("last.focus()"));
  assert.ok(app.includes("function hasExplicitEnglishRequirement(job)"));
  assert.ok(app.includes("function hasExplicitNoDegreeRequirement(job)"));
});

const requirementHelperStart = app.indexOf("function hasExplicitEnglishRequirement(job)");
const requirementHelperEnd = app.indexOf("function getExperienceRequirement(job)", requirementHelperStart);
const requirementHelpers = new Function(
  "getJobText",
  app.slice(requirementHelperStart, requirementHelperEnd) +
    "; return { hasExplicitEnglishRequirement, hasExplicitNoDegreeRequirement };"
);

test("English filter distinguishes mandatory requirements from preferences", () => {
  const { hasExplicitEnglishRequirement } = requirementHelpers((job) => job.description || "");
  assert.equal(hasExplicitEnglishRequirement({ description: "English B2 required" }), true);
  assert.equal(hasExplicitEnglishRequirement({ description: "Fluent in English is mandatory" }), true);
  assert.equal(hasExplicitEnglishRequirement({ description: "English B2 preferred" }), false);
  assert.equal(hasExplicitEnglishRequirement({ description: "English is a plus" }), false);
});

test("degree filter only accepts explicit no-degree statements", () => {
  const { hasExplicitNoDegreeRequirement } = requirementHelpers((job) => job.description || "");
  assert.equal(hasExplicitNoDegreeRequirement({ description: "Degree or equivalent experience" }), true);
  assert.equal(hasExplicitNoDegreeRequirement({ description: "Bachelor degree required" }), false);
  assert.equal(hasExplicitNoDegreeRequirement({ description: "No degree required" }), true);
});


const experienceHelperStart = app.indexOf("function hasMandatoryExperienceRequirement(job)");
const experienceHelperEnd = app.indexOf("function cleanText(value)", experienceHelperStart);
const experienceBlock = app.slice(experienceHelperStart, experienceHelperEnd);
const entryHelperStart = app.indexOf("function isEntryLevelJob(job)");
const entryHelperEnd = app.indexOf("function getJobDifficulty(job)", entryHelperStart);
const entryBlock = app.slice(entryHelperStart, entryHelperEnd);
const experienceHelpers = new Function(
  "getJobText", "normalizeText", "cleanText", "seniorPattern", "entryPattern",
  experienceBlock + entryBlock + "; return { hasMandatoryExperienceRequirement, getExperienceSortRank };"
);
const makeExperienceHelpers = () => {
  const normalize = (value) => String(value || "").toLowerCase();
  const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();
  const getText = (job) => normalize([job.title, job.description, ...(job.tags || [])].join(" "));
  const isEntry = (job) => /\\b(junior|entry.level|intern|trainee|graduate)\\b|стаж[её]р|младш/i.test(normalize(job.title || "")) ||
    /no experience (?:required|needed)|no prior experience|without experience|entry.level|0\\s*[-–]\\s*1 years?|training (?:will be )?provided|без опыта|опыт не требуется/i.test(normalize(job.description || ""));
  return experienceHelpers(getText, normalize, clean, /senior|lead|principal|staff engineer|head of|director|руководител/i, /junior|entry[\\s-]?level|no experience|without experience|graduate|trainee|intern(?:ship)?|associate|assistant|coordinator|customer support|support agent|data annotat|virtual assistant|без опыта|начальн\\w*\\s+уровн|стаж[её]р|помощник/i);
};

test("experience filter respects required years and ignores unrelated preferences", () => {
  const { hasMandatoryExperienceRequirement } = makeExperienceHelpers();
  assert.equal(hasMandatoryExperienceRequirement({ title: "Cloud Systems Administrator", description: "3+ years of experience required. English B2 preferred." }), true);
  assert.equal(hasMandatoryExperienceRequirement({ title: "Data Analyst", description: "3+ years of experience preferred. English B2 required." }), false);
  assert.equal(hasMandatoryExperienceRequirement({ title: "Senior Product Designer", description: "Build design systems." }), true);
  assert.equal(hasMandatoryExperienceRequirement({ title: "Customer Support Agent", description: "No experience required. Training provided." }), false);
});

test("no-experience sorting ranks entry-level first and mandatory-experience roles last", () => {
  const { getExperienceSortRank } = makeExperienceHelpers();
  const junior = { title: "Junior Customer Support Agent", description: "No experience required." };
  const unspecified = { title: "Operations Specialist", description: "Work with the team." };
  const experienced = { title: "Cloud Systems Administrator", description: "3+ years of experience required." };
  assert.equal(getExperienceSortRank(junior), 0);
  assert.equal(getExperienceSortRank(unspecified), 1);
  assert.equal(getExperienceSortRank(experienced), 2);
});
