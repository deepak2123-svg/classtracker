import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export function safePdfFilename(value) {
  const name = String(value || "ledgr-report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return name.toLowerCase().endsWith(".pdf") ? name : `${name || "ledgr-report"}.pdf`;
}

export async function renderLedgrPdfBuffer(html) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(35000);
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: ["domcontentloaded", "networkidle0"], timeout: 35000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
