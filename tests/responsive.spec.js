const { test, expect } = require("@playwright/test");

const widths = [360, 390, 768, 1024, 1440];

test.describe("responsive layout", () => {
  for (const width of widths) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));

      expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(width + 1);
      expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(width + 1);
    });
  }

  for (const width of [360, 390, 768]) {
    test(`mobile drawer opens and closes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const open = page.locator("#sidebar-open");
      const sidebar = page.locator("#app-sidebar");
      const backdrop = page.locator("#sidebar-backdrop");

      await expect(open).toBeVisible();
      await expect(sidebar).toBeAttached();
      await expect(backdrop).toBeAttached();
      await expect(open).toHaveAttribute("aria-expanded", "false");

      await open.click();
      await expect(page.locator("body")).toHaveClass(/sidebar-open/);
      await expect(open).toHaveAttribute("aria-expanded", "true");

      await page.keyboard.press("Escape");
      await expect(page.locator("body")).not.toHaveClass(/sidebar-open/);
      await expect(open).toHaveAttribute("aria-expanded", "false");

      await open.click();
      await backdrop.click({ position: { x: width - 8, y: 450 } });
      await expect(page.locator("body")).not.toHaveClass(/sidebar-open/);
    });
  }

  test("desktop sidebar is present and mobile toggle is hidden at 1024px and above", async ({ page }) => {
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator("#app-sidebar")).toBeVisible();
      await expect(page.locator("#sidebar-open")).toBeHidden();
    }
  });
});
