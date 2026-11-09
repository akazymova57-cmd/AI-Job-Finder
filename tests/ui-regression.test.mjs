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
  assert.ok(app.includes("last.focus()"));\n  assert.ok(app.includes("function hasExplicitEnglishRequirement(job)"));\n  assert.ok(app.includes("function hasExplicitNoDegreeRequirement(job)"));
});
