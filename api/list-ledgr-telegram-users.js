import { listTelegramRecentPrivateContacts } from "./_lib/telegramDelivery.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Use GET to list Telegram users who have started the bot." });
  }

  try {
    const { requireAdminUser } = await import("./_lib/firebaseAdmin.js");
    await requireAdminUser(req);
    const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) {
      return sendJson(res, 500, { error: "Missing TELEGRAM_BOT_TOKEN on the server." });
    }

    const users = await listTelegramRecentPrivateContacts({ token, limit: 100 });
    return sendJson(res, 200, {
      ok: true,
      users,
      count: users.length,
    });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    return sendJson(res, status, { error: error?.message || "Could not list Telegram users." });
  }
}
