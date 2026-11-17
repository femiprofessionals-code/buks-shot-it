// Site check: screenshots, accessibility scan (axe), internal link crawl, form behaviour.
// Usage: BASE=http://localhost:3100 OUT=/path node tests/e2e/site-check.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Uses the machine's installed Playwright (set NODE_PATH to the global node_modules if needed).
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "test-results";
fs.mkdirSync(OUT, { recursive: true });
const pages = ["/", "/wedding-photography", "/portrait-photography", "/event-photography", "/product-photography", "/pricing", "/portfolio", "/portfolio/weddings", "/about", "/contact", "/book?service=weddings&package=wedding-classic", "/gallery", "/booking-terms", "/privacy", "/does-not-exist"];
const results = { axe: {}, console: [], links: {}, checks: [] };
const check = (name, ok, detail = "") => { results.checks.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// Route through an outbound proxy when the environment requires one.
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } } : {});
for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !page.url().endsWith("/does-not-exist")) results.console.push(`${label} ${page.url()}: ${m.text()}`); });
  page.on("pageerror", (e) => results.console.push(`${label} ${page.url()}: ${e.message}`));
  for (const p of pages) {
    const res = await page.goto(BASE + p, { waitUntil: "networkidle" });
    if (label === "desktop") {
      const expect404 = p === "/does-not-exist";
      check(`${p} returns ${expect404 ? 404 : 200}`, res.status() === (expect404 ? 404 : 200), String(res.status()));
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      results.axe[p] = axe.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, target: v.nodes[0]?.target }));
      for (const a of await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))) {
        if (a && a.startsWith("/")) results.links[a.split("#")[0]] = true;
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) check(`${label} ${p} has no horizontal scroll`, false, `${overflow}px`);
    const name = `${label}${p.replace(/[/?&=]/g, "_") || "_home"}`;
    if (["/", "/wedding-photography", "/pricing", "/portfolio", "/contact", "/book?service=weddings&package=wedding-classic"].includes(p)) {
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    }
  }
  if (label === "phone") {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    check("Phone menu opens", await dialog.isVisible());
    await page.screenshot({ path: `${OUT}/phone_menu.png` });
    await page.keyboard.press("Escape");
    check("Phone menu closes with Escape", !(await dialog.isVisible().catch(() => false)));
  }
  await ctx.close();
}

// Internal link crawl
const ctx = await browser.newContext({ ignoreHTTPSErrors: Boolean(proxyServer) });

// Home page: photographs first, no prices (decided 18 Nov 2026)
{
  const home = await ctx.newPage();
  await home.setViewportSize({ width: 1440, height: 900 });
  await home.goto(BASE + "/", { waitUntil: "networkidle" });
  const mainText = await home.locator("main").innerText();
  check("Home page shows no prices", !/\$\s?\d/.test(mainText), (mainText.match(/\$\s?[\d,]+/g) ?? []).join(" "));
  const services = home.getByRole("button", { name: "Services" });
  await services.focus();
  await home.keyboard.press("Enter");
  const weddingsLink = home.getByRole("banner").getByRole("link", { name: "Weddings" });
  check("Services menu opens from the keyboard", await weddingsLink.isVisible());
  await home.keyboard.press("Escape");
  check("Services menu closes with Escape and returns focus", !(await weddingsLink.isVisible()) && (await services.evaluate((el) => el === document.activeElement)));
  await services.click();
  check("Services menu stays open after a mouse click", await weddingsLink.isVisible());
  await home.close();
}
const page = await ctx.newPage();
for (const href of Object.keys(results.links)) {
  const r = await page.request.get(BASE + href);
  results.links[href] = r.status();
}
const broken = Object.entries(results.links).filter(([, s]) => s !== 200);
check("All internal links resolve", broken.length === 0, broken.map(([h, s]) => `${h}:${s}`).join(", "));

// Contact form
await page.goto(BASE + "/contact", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForSelector("#name-error");
check("Empty contact form shows field errors", (await page.locator("[id$=-error]").count()) === 4);
await page.fill("#c-name", "Test Person");
await page.fill("#c-email", "test@example.com");
await page.selectOption("#c-topic", "weddings");
await page.fill("#c-message", "Testing the form.");
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForSelector("text=isn't connected yet");
check("Valid message without a database is not falsely reported as sent", await page.isVisible("text=isn't connected yet"));
check("Entered values are kept after submit", (await page.inputValue("#c-name")) === "Test Person");

// Portfolio viewer
await page.goto(BASE + "/portfolio", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /View larger/ }).first().click();
const viewer = page.getByRole("dialog", { name: "Photograph viewer" });
check("Portfolio viewer opens", await viewer.isVisible());
await page.keyboard.press("ArrowRight");
check("Viewer advances with the arrow key", (await viewer.textContent()).includes("2 /"));
await page.keyboard.press("Escape");
check("Viewer closes with Escape and returns focus", !(await viewer.isVisible().catch(() => false)) && (await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")).startsWith("View larger"));

// Booking preselection
await page.goto(BASE + "/book?service=events&package=event-half-day", { waitUntil: "networkidle" });
check("Booking page preselects service and package from the link", (await page.locator("aside").textContent()).includes("Half Day (8 Hours)") && (await page.locator("aside").textContent()).includes("$262.50"));


// Booking flow: package -> hours -> date -> time -> details. Works against a live or a preview (not connected) site.
{
  await page.goto(BASE + "/book?service=events&package=event-hourly", { waitUntil: "networkidle" });
  await page.selectOption("#b-hours", "2");
  const dayButtons = page.locator('ul[aria-label^="Dates in"] button:not([disabled])');
  await dayButtons.first().waitFor({ timeout: 10000 }).catch(() => {});
  if ((await dayButtons.count()) === 0) await page.getByRole("button", { name: "Next month" }).click();
  await dayButtons.first().waitFor({ timeout: 10000 });
  check("Booking: open dates are shown after choosing a package", (await dayButtons.count()) > 0);
  await dayButtons.nth(Math.min(5, (await dayButtons.count()) - 1)).click();
  const timeButtons = page.locator('section[aria-labelledby="step-time"] button');
  await timeButtons.first().waitFor({ timeout: 10000 });
  check("Booking: start times are shown after choosing a date", (await timeButtons.count()) > 0);
  await timeButtons.first().click();
  check("Booking: summary shows the total and retainer for 2 hours", (await page.locator("aside").textContent()).includes("$200") && (await page.locator("aside").textContent()).includes("$70"));
  const send = page.getByRole("button", { name: "Send booking request" });
  await send.click();
  await page.locator("#full_name-error").waitFor({ timeout: 10000 });
  check("Booking: empty details are refused with field messages", await page.locator("#terms-error").isVisible());
  await page.fill("#b-name", "Site Check");
  await page.fill("#b-location", "Check Hall");
  await send.click();
  await page.locator("#email-error").waitFor({ timeout: 10000 });
  check("Booking: typed details are kept after an error", (await page.inputValue("#b-name")) === "Site Check" && (await page.inputValue("#b-location")) === "Check Hall");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  results.axe["/book (all steps open)"] = axe.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, target: v.nodes[0]?.target }));
  if (process.env.SITE_LIVE_BOOKING !== "1") {
    await page.fill("#b-email", "site.check@example.com");
    await page.check('input[name="terms"]');
    await send.click();
    await page.getByRole("alert").filter({ hasText: /isn.t connected|didn.t send|bot/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
    const alertText = (await page.getByRole("alert").allTextContents()).join(" ");
    check("Booking: without a database, a request is never reported as sent", !page.url().includes("/book/requested") && /isn.t connected/.test(alertText), alertText.slice(0, 200));
  }
}

await browser.close();
const axeTotal = Object.values(results.axe).flat();
check("No WCAG 2.1 AA accessibility violations (axe)", axeTotal.length === 0, JSON.stringify(results.axe).slice(0, 1500));
check("No console errors", results.console.length === 0, results.console.slice(0, 5).join(" | "));
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const failed = results.checks.filter((c) => !c.ok).length;
console.log(`\n${results.checks.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
