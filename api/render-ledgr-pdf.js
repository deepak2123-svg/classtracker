import { renderLedgrPdfBuffer, safePdfFilename } from "./_lib/renderLedgrPdf.js";

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

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Use POST to render a Ledgr PDF." });
  }

  try{
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const html = typeof body.html === "string" ? body.html : "";
    if(!html || !html.includes("<html")){
      return sendJson(res, 400, { error: "A complete HTML document is required." });
    }
    if(Buffer.byteLength(html, "utf8") > 10 * 1024 * 1024){
      return sendJson(res, 413, { error: "This report is too large to render in one request." });
    }

    const pdf = await renderLedgrPdfBuffer(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safePdfFilename(body.filename)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 200;
    return res.end(pdf);
  } catch(error){
    console.error("Ledgr PDF render failed", error);
    return sendJson(res, 500, { error: "Could not render institute PDF. Please try again." });
  }
}
