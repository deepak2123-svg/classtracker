// ── RAW ERROR CAPTURE (runs before React mounts) ─────────────────────────────
// Captures errors that happen before the error boundary is alive,
// and stores them so FatalAppScreen can display the full details.
(function installRawErrorCapture() {
  const STORE_KEY = "ct_last_raw_error";
  function save(data) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_) {}
  }
  window.__CT_RAW_ERROR_KEY = STORE_KEY;
  window.addEventListener("error", function(e) {
    // e.error is null for cross-origin scripts — capture everything we can
    save({
      message:  e.message  || "Script error",
      filename: e.filename || "",
      lineno:   e.lineno   || 0,
      colno:    e.colno    || 0,
      stack:    e.error?.stack || null,
      ts:       Date.now(),
    });
  }, true); // capture phase — fires before React
  window.addEventListener("unhandledrejection", function(e) {
    const r = e.reason;
    save({
      message:  r?.message || String(r || "Unhandled promise rejection"),
      stack:    r?.stack   || null,
      ts:       Date.now(),
    });
  }, true);
})();
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode, Suspense, lazy, useState, useEffect, useRef, Component } from "react";
import { createRoot } from "react-dom/client";
import { onAuth, getUserRole, logout } from "./firebase";
import { Spinner } from "./shared.jsx";
import Auth from "./Auth";
import { getAdminAppUrl, getAppMode, getTeacherAppUrl, isNativeApp } from "./platform";

// Web keeps the existing split build. Native uses one shared shell.
const APP_MODE = getAppMode();
const IS_ADMIN_APP = APP_MODE === "admin";
const IS_MANAGER_APP = APP_MODE === "manager";
const IS_NATIVE_SHELL = APP_MODE === "native";
const ADMIN_INVITE_STORAGE_KEY = "ct_admin_invite_token";
const CHUNK_RELOAD_STORAGE_KEY = "ct_chunk_reload_attempt";
const CHUNK_RELOAD_QUERY_KEY = "__ct_chunk";
const ADMIN_APP_ROLES = new Set(["admin", "manager", "group_admin", "institute_admin"]);

function isDynamicImportFailure(error) {
  const message = error?.message || String(error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\d]+ failed/i.test(message);
}

function buildChunkRetryUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set(CHUNK_RELOAD_QUERY_KEY, Date.now().toString(36));
  return url.toString();
}

function clearChunkRetryState() {
  if (typeof window === "undefined") return;
  const key = `${CHUNK_RELOAD_STORAGE_KEY}:${APP_MODE}`;
  window.sessionStorage.removeItem(key);
  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHUNK_RELOAD_QUERY_KEY)) return;
  url.searchParams.delete(CHUNK_RELOAD_QUERY_KEY);
  window.history.replaceState({}, "", url.toString());
}

function forceChunkRefresh() {
  if (typeof window === "undefined") return;
  const key = `${CHUNK_RELOAD_STORAGE_KEY}:${APP_MODE}`;
  window.sessionStorage.setItem(key, "1");
  window.location.replace(buildChunkRetryUrl());
}

async function importWithChunkRecovery(loader) {
  try {
    const mod = await loader();
    clearChunkRetryState();
    return mod;
  } catch (error) {
    if (typeof window !== "undefined" && isDynamicImportFailure(error)) {
      const key = `${CHUNK_RELOAD_STORAGE_KEY}:${APP_MODE}`;
      if (window.sessionStorage.getItem(key) !== "1") {
        forceChunkRefresh();
        return new Promise(() => {});
      }
    }
    throw error;
  }
}

const lazyWithChunkRecovery = (loader) => lazy(() => importWithChunkRecovery(loader));
const ClassTracker = lazyWithChunkRecovery(() => import("./ClassTracker"));
const AdminAuth = lazyWithChunkRecovery(() => import("./AdminAuth"));
const AdminPanel = lazyWithChunkRecovery(() => import("./AdminPanel"));
const ManagerPanel = lazyWithChunkRecovery(() => import("./ManagerPanel"));

function hasPendingAdminInvite() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("invite") || !!window.sessionStorage.getItem(ADMIN_INVITE_STORAGE_KEY);
}

function App() {
  const [user,        setUser]        = useState(undefined); // undefined = loading
  const [role,        setRole]        = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const hasAdminInvite = hasPendingAdminInvite();

  useEffect(() => {
    clearChunkRetryState();
  }, []);

  // Prevents onAuth's async getUserRole from overwriting the role
  // after handleAdminVerified has already set it correctly.
  const adminVerifiedRef = useRef(false);

  useEffect(() => onAuth(async (u) => {
    setUser(u);
    if (u) {
      // handleAdminVerified already owns the role — don't race against it
      if (adminVerifiedRef.current) return;
      setRoleLoading(true);
      const r = await getUserRole(u.uid);
      // Check again — handleAdminVerified may have fired while we were fetching
      if (!adminVerifiedRef.current) {
        setRole(r);
      }
      setRoleLoading(false);
    } else {
      adminVerifiedRef.current = false;
      setRole(null);
    }
  }), []);

  // Called by AdminAuth after login + any promotion via invite.
  // Sets the lock so onAuth can't overwrite the freshly-written role.
  const handleAdminVerified = async (u, verifiedRole = "admin") => {
    adminVerifiedRef.current = true;
    setUser(u);
    setRole(verifiedRole);
    setRoleLoading(false);
  };

  // ── MANAGER APP (manager.ledgrclasses.com) ────────────────────────────────
  if (IS_MANAGER_APP) {
    if (user === undefined || roleLoading) return <Spinner text="Loading…" />;

    if (!user) {
      return (
        <SuspenseScreen>
          <AdminAuth
            onVerified={handleAdminVerified}
            allowedRoles={["manager"]}
            portalLabel="Manager Portal"
          />
        </SuspenseScreen>
      );
    }

    if (role === "manager") {
      return <SuspenseScreen><ManagerPanel user={user} /></SuspenseScreen>;
    }

    return <AccessDenied requiredRoleLabel="manager" />;
  }

  // ── ADMIN APP (admin.ledgrclasses.com) ───────────────────────────────────
  if (IS_ADMIN_APP) {
    if (user === undefined || roleLoading) return <Spinner text="Loading…" />;

    // Not logged in → admin login screen
    if (!user) {
      return (
        <SuspenseScreen>
          <AdminAuth
            onVerified={handleAdminVerified}
            allowedRoles={Array.from(ADMIN_APP_ROLES)}
            portalLabel="Admin Portal"
          />
        </SuspenseScreen>
      );
    }

    // Logged in and confirmed admin → panel
    if (ADMIN_APP_ROLES.has(role)) return <SuspenseScreen><AdminPanel user={user} /></SuspenseScreen>;

    // Invite-based admin activation can briefly sign the user in before the role handoff
    // completes. Keep the invite-aware auth screen mounted so it can finish promotion.
    if (hasAdminInvite) {
      return (
        <SuspenseScreen>
          <AdminAuth
            onVerified={handleAdminVerified}
            currentUser={user}
            allowedRoles={Array.from(ADMIN_APP_ROLES)}
            portalLabel="Admin Portal"
          />
        </SuspenseScreen>
      );
    }

    // Signed in but role not admin — show denied
    return <AccessDenied />;
  }

  // ── TEACHER APP (teacher.ledgrclasses.com) ───────────────────────────────
  if (user === undefined || (user && roleLoading)) return <Spinner text="Loading…" />;
  if (!user) return <Auth />;
  if (IS_NATIVE_SHELL) return <NativeRoleShell user={user} role={role} />;
  return <SuspenseScreen><ClassTracker user={user} /></SuspenseScreen>;
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <FatalAppScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

function RuntimeErrorBridge({ children }) {
  const [runtimeError, setRuntimeError] = useState(null);

  useEffect(() => {
    const handleError = (event) => {
      setRuntimeError(event?.error || new Error(event?.message || "Unexpected runtime error"));
    };

    const handleRejection = (event) => {
      const reason = event?.reason;
      setRuntimeError(reason instanceof Error ? reason : new Error(String(reason || "Unhandled promise rejection")));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (runtimeError) {
    return <FatalAppScreen error={runtimeError} />;
  }

  return children;
}

function FatalAppScreen({ error }) {
  const message = error?.message || String(error || "Unknown error");
  const surfaceLabel = IS_MANAGER_APP ? "manager panel" : IS_ADMIN_APP ? "admin panel" : (IS_NATIVE_SHELL ? "app" : "teacher panel");
  const chunkFailure = isDynamicImportFailure(error);

  // Pull the raw pre-React captured error (has filename/line/col)
  let rawCapture = null;
  try {
    const stored = sessionStorage.getItem(window.__CT_RAW_ERROR_KEY || "ct_last_raw_error");
    if (stored) rawCapture = JSON.parse(stored);
  } catch (_) {}

  // Build the full debug text shown on screen
  const debugLines = [];
  debugLines.push(`message:  ${message}`);
  if (error?.stack && error.stack !== message) {
    debugLines.push(`\nstack:\n${error.stack}`);
  }
  if (rawCapture) {
    debugLines.push(`\n── raw capture ──`);
    if (rawCapture.filename) debugLines.push(`file:     ${rawCapture.filename}`);
    if (rawCapture.lineno)   debugLines.push(`line:     ${rawCapture.lineno}:${rawCapture.colno}`);
    if (rawCapture.stack)    debugLines.push(`stack:\n${rawCapture.stack}`);
    if (rawCapture.message && rawCapture.message !== message)
                             debugLines.push(`raw msg:  ${rawCapture.message}`);
  }
  debugLines.push(`\n── device ──`);
  debugLines.push(`ua:       ${navigator.userAgent}`);
  debugLines.push(`url:      ${window.location.href}`);
  debugLines.push(`time:     ${new Date().toISOString()}`);

  const debugText = debugLines.join("\n");

  function copyDebug() {
    navigator.clipboard?.writeText(debugText).catch(() => {});
  }

  return (
    <div style={{ minHeight:"100vh", background:"#F5F7FA", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Inter',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:460, background:"#FFFFFF", border:"1px solid #DCE3EA", borderRadius:24, boxShadow:"0 16px 40px rgba(16,24,40,0.12)", padding:"28px 24px" }}>
        <div style={{ width:56, height:56, borderRadius:18, background:"#FEF3F2", color:"#B42318", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:16 }}>
          !
        </div>
        <div style={{ fontSize:24, fontWeight:800, color:"#101828", marginBottom:8, fontFamily:"'Poppins',sans-serif" }}>Something went wrong</div>
        <div style={{ fontSize:14, lineHeight:1.7, color:"#475467", marginBottom:18 }}>
          {chunkFailure
            ? `The ${surfaceLabel} updated in the background and this screen is holding an older file reference. Refresh once to load the latest version.`
            : `The app hit a runtime error before the ${surfaceLabel} could finish loading.`}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:"#667085", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>
          Error Details
        </div>
        <pre style={{ margin:0, whiteSpace:"pre-wrap", wordBreak:"break-word", background:"#F8FAFC", border:"1px solid #DCE3EA", borderRadius:14, padding:"14px 15px", color:"#101828", fontSize:13, lineHeight:1.55, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", maxHeight:260, overflowY:"auto" }}>
          {debugText}
        </pre>
        {/* Copy button — teacher can paste this into WhatsApp/Telegram for you */}
        <button
          type="button"
          onClick={copyDebug}
          style={{ marginTop:10, width:"100%", border:"1px solid #DCE3EA", borderRadius:14, background:"#F8FAFC", color:"#344054", padding:"10px 18px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
          📋 Copy error info
        </button>
        <button
          type="button"
          onClick={() => chunkFailure ? forceChunkRefresh() : window.location.reload()}
          style={{ marginTop:8, width:"100%", border:"none", borderRadius:14, background:"#16324F", color:"#fff", padding:"13px 18px", fontSize:15, fontWeight:700, cursor:"pointer" }}>
          {chunkFailure ? "Refresh app" : "Reload"}
        </button>
      </div>
    </div>
  );
}

function AccessDenied({ requiredRoleLabel = "admin" }) {
  const nativeApp = isNativeApp();
  const teacherAppUrl = getTeacherAppUrl();
  const adminAppUrl = getAdminAppUrl();
  return (
    <div style={{minHeight:"100vh",background:"#152B22",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:16}}>🚫</div>
        <h2 style={{color:"#fff",fontFamily:"'Syne',sans-serif",fontSize:22,marginBottom:8}}>Access Denied</h2>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,marginBottom:24,lineHeight:1.6}}>
          Your account does not have {requiredRoleLabel} access.<br/>Contact the Manager to request the correct role.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          {!nativeApp && (
            <a href={requiredRoleLabel === "manager" ? adminAppUrl : teacherAppUrl}
              style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"9px 18px",fontSize:13,textDecoration:"none"}}>
              ← {requiredRoleLabel === "manager" ? "Admin app" : "Teacher app"}
            </a>
          )}
          <button onClick={logout}
            style={{background:"#C93030",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,cursor:"pointer"}}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function NativeRoleShell({ user, role }) {
  const hasAdminAccess = ADMIN_APP_ROLES.has(role);
  const [view, setView] = useState(hasAdminAccess ? "admin" : "teacher");

  useEffect(() => {
    if (!hasAdminAccess) setView("teacher");
  }, [hasAdminAccess]);

  const isAdminView = hasAdminAccess && view === "admin";

  return (
    <>
      <SuspenseScreen>
        {isAdminView ? <AdminPanel user={user} /> : <ClassTracker user={user} />}
      </SuspenseScreen>
      {hasAdminAccess && (
        <button
          type="button"
          onClick={() => setView(current => current === "admin" ? "teacher" : "admin")}
          style={{
            position:"fixed",
            right:16,
            bottom:20,
            zIndex:10000,
            border:"none",
            borderRadius:999,
            background:"#0F172A",
            color:"#fff",
            padding:"12px 16px",
            fontSize:13,
            fontWeight:700,
            boxShadow:"0 14px 34px rgba(15,23,42,0.28)",
            cursor:"pointer",
            WebkitTapHighlightColor:"transparent"
          }}>
          {isAdminView ? "Open teacher view" : "Open admin view"}
        </button>
      )}
    </>
  );
}

function SuspenseScreen({ children }) {
  return <Suspense fallback={<Spinner text="Loading screen…" />}>{children}</Suspense>;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <RuntimeErrorBridge>
        <App />
      </RuntimeErrorBridge>
    </AppErrorBoundary>
  </StrictMode>
);
