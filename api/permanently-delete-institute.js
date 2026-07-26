import { adminDb, requireAdminUser } from "./_lib/firebaseAdmin.js";
import { permanentlyPurgeRecycleItem } from "./_lib/tenantRecycle.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Use POST for permanent institute deletion." });
  }

  try {
    const actor = await requireAdminUser(req);
    if (!["manager", "admin"].includes(actor.role)) {
      return sendJson(res, 403, { error: "Manager access is required for permanent institute deletion." });
    }

    const body = requestBody(req);
    const result = await permanentlyPurgeRecycleItem(
      adminDb(),
      {
        entityType: "institute",
        instituteId: body.instituteId,
        instituteName: body.instituteName,
        confirmationName: body.confirmationName,
      },
      actor,
      {
        allowActiveInstitute: true,
        preserveInstituteTombstone: true,
        exactInstituteNameOnly: true,
      }
    );
    return sendJson(res, 200, result);
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    if (status >= 500) console.error("Permanent institute deletion failed", error);
    return sendJson(res, status, { error: error?.message || "Permanent institute deletion failed." });
  }
}
