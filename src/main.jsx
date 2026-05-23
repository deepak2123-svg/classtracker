import { StrictMode, Suspense, lazy, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { onAuth, getUserRole, logout } from "./firebase";
import { Spinner } from "./shared.jsx";
import Auth from "./Auth";
const ClassTracker = lazy(() => import("./ClassTracker"));
const AdminAuth = lazy(() => import("./AdminAuth"));
const AdminPanel = lazy(() => import("./AdminPanel"));
import { getAppMode, getTeacherAppUrl, isNativeApp } from "./platform";

// Web keeps the existing split build. Native uses one shared shell.
const APP_MODE = getAppMode();
const IS_ADMIN_APP = APP_MODE === "admin";
const IS_NATIVE_SHELL = APP_MODE === "native";
const ADMIN_INVITE_STORAGE_KEY = "ct_admin_invite_token";

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
  const handleAdminVerified = async (u) => {
    adminVerifiedRef.current = true;
    setUser(u);
    setRole("admin");
    setRoleLoading(false);
  };

  // ── ADMIN APP (ctadmin.vercel.app) ────────────────────────────────────────
  if (IS_ADMIN_APP) {
    if (user === undefined || roleLoading) return <Spinner text="Loading…" />;

    // Not logged in → admin login screen
    if (!user) return <SuspenseScreen><AdminAuth onVerified={handleAdminVerified} /></SuspenseScreen>;

    // Logged in and confirmed admin → panel
    if (role === "admin") return <SuspenseScreen><AdminPanel user={user} /></SuspenseScreen>;

    // Invite-based admin activation can briefly sign the user in before the role handoff
    // completes. Keep the invite-aware auth screen mounted so it can finish promotion.
    if (hasAdminInvite) return <SuspenseScreen><AdminAuth onVerified={handleAdminVerified} currentUser={user} /></SuspenseScreen>;

    // Signed in but role not admin — show denied
    return <AccessDenied />;
  }

  // ── TEACHER APP (teacherct.vercel.app) ───────────────────────────────────
  if (user === undefined || (user && roleLoading)) return <Spinner text="Loading…" />;
  if (!user) return <Auth />;
  if (IS_NATIVE_SHELL) return <NativeRoleShell user={user} role={role} />;
  return <SuspenseScreen><ClassTracker user={user} /></SuspenseScreen>;
}

function AccessDenied() {
  const nativeApp = isNativeApp();
  const teacherAppUrl = getTeacherAppUrl();
  return (
    <div style={{minHeight:"100vh",background:"#152B22",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:16}}>🚫</div>
        <h2 style={{color:"#fff",fontFamily:"'Syne',sans-serif",fontSize:22,marginBottom:8}}>Access Denied</h2>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,marginBottom:24,lineHeight:1.6}}>
          Your account does not have admin privileges.<br/>Contact the super admin to request access.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          {!nativeApp && (
            <a href={teacherAppUrl}
              style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"9px 18px",fontSize:13,textDecoration:"none"}}>
              ← Teacher app
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
  const [view, setView] = useState(role === "admin" ? "admin" : "teacher");

  useEffect(() => {
    if (role !== "admin") setView("teacher");
  }, [role]);

  const isAdminView = role === "admin" && view === "admin";

  return (
    <>
      <SuspenseScreen>
        {isAdminView ? <AdminPanel user={user} /> : <ClassTracker user={user} />}
      </SuspenseScreen>
      {role === "admin" && (
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
  <StrictMode><App /></StrictMode>
);
