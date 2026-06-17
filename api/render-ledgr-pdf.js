import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

function sendJson(res, status, payload){
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function safeFilename(value){
  const name = String(value || "ledgr-report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return name.toLowerCase().endsWith(".pdf") ? name : `${name || "ledgr-report"}.pdf`;
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Use POST to render a Ledgr PDF." });
  }

  let browser = null;
  try{
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const html = typeof body.html === "string" ? body.html : "";
    if(!html || !html.includes("<html")){
      return sendJson(res, 400, { error: "A complete HTML document is required." });
    }
    if(Buffer.byteLength(html, "utf8") > 10 * 1024 * 1024){
      return sendJson(res, 413, { error: "This report is too large to render in one request." });
    }

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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(body.filename)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 200;
    return res.end(Buffer.from(pdf));
  } catch(error){
    console.error("Ledgr PDF render failed", error);
    return sendJson(res, 500, { error: "Could not render institute PDF. Please try again." });
  } finally {
    if(browser){
      await browser.close().catch(() => {});
    }
  }
}
