export const PARENT_INVITE_STORAGE_KEY = "ct_parent_invite_token";

export function captureParentInvite() {
  if (typeof window === "undefined") return "";
  const token = new URLSearchParams(window.location.search).get("invite")?.trim() || "";
  if (token) window.sessionStorage.setItem(PARENT_INVITE_STORAGE_KEY, token);
  return token || window.sessionStorage.getItem(PARENT_INVITE_STORAGE_KEY) || "";
}

export function clearParentInvite() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PARENT_INVITE_STORAGE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.toString());
}
