// Load every page of the static site in headless Chromium and report anything broken.
// Usage: NODE_PATH=<dir with playwright-core> CHROME=<chromium path> node check.cjs <baseUrl> <docsDir>
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const [base, docs] = process.argv.slice(2);

function pages(dir, rel = "") {
  let out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) out = out.concat(pages(dir, r));
    else if (e.name.endsWith(".html")) out.push(r);
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const list = pages(docs).sort();
  let problems = 0;
  for (const file of list) {
    const url = base + encodeURI(file.replace(/index\.html$/, ""));
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const issues = [];
    page.on("pageerror", (e) => issues.push("JS error: " + e.message));
    page.on("console", (m) => m.type() === "error" && issues.push("console: " + m.text()));
    page.on("requestfailed", (r) => issues.push("failed: " + r.url() + " " + (r.failure() || {}).errorText));
    page.on("response", (r) => r.status() >= 400 && issues.push(r.status() + ": " + r.url()));
    // When checking a copy on another host, flag anything still loaded from the real domain.
    if (!/enyeszpontok\.hu/.test(base))
      page.on("request", (r) => /enyeszpontok\.hu/.test(r.url()) && issues.push("old server: " + r.url()));
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 100));
        }
      });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      const dom = await page.evaluate(() => ({
        brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
        errorText: [...document.querySelectorAll("body *")]
          .filter((el) => el.children.length === 0 && !/^(SCRIPT|STYLE)$/.test(el.tagName))
          .map((el) => el.textContent.trim())
          .filter((t) => t.length < 300 && /cannot load|fake worker|^error\b|failed:/i.test(t)),
        // PDF embeds: each viewer should have drawn at least one page.
        emptyPdfs: [...document.querySelectorAll(".pdfemb-viewer")]
          .filter((v) => ![...v.querySelectorAll("canvas")].some((c) => c.width > 0 && c.height > 0))
          .map((v) => v.getAttribute("href") || v.dataset.pdfUrl || "pdf viewer"),
      }));
      dom.emptyPdfs.forEach((s) => issues.push("PDF not rendered: " + s));
      dom.brokenImgs.forEach((s) => issues.push("broken image: " + s));
      dom.errorText.forEach((t) => issues.push("error text on page: " + t));
    } catch (e) {
      issues.push("load error: " + e.message.split("\n")[0]);
    }
    await page.close();
    const uniq = [...new Set(issues)];
    if (uniq.length) {
      problems++;
      console.log("✗ " + url);
      uniq.forEach((i) => console.log("    " + i));
    } else console.log("✓ " + url);
  }
  console.log(`\n${list.length} pages, ${problems} with problems`);
  await browser.close();
})();
