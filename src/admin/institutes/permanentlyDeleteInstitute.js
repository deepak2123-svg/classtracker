import { auth } from "../../firebase";

export async function permanentlyDeleteInstitute(instituteName, { instituteId = "" } = {}) {
  const label = String(instituteName || "").trim();
  if (!label) throw new Error("Institute name is required.");

  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again before deleting this institute.");

  const token = await user.getIdToken();
  const response = await fetch("/api/permanently-delete-institute", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instituteId,
      instituteName: label,
      confirmationName: label,
    }),
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new Error("The permanent-delete service is not deployed. Reload after the latest deployment and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || "Permanent institute deletion failed.");
  }
  return payload;
}
