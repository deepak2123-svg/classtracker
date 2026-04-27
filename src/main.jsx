import { StrictMode, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { onAuth, getUserRole, logout } from "./firebase";
import { Spinner } from "./shared.jsx";
import Auth from "./Auth";
import ClassTracker from "./ClassTracker";
import AdminAuth from "./AdminAuth";
import AdminPanel from "./AdminPanel";

// VITE_APP_MODE = "admin" on ctadmin.vercel.app, unset on teacherct.vercel.app
const IS_ADMIN_APP = import.meta.env.VITE_APP_MODE === "admin";
const HAS_ADMIN_INVITE = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("invite");

function App() {
  const [user,        setUser]        = useState(undefined); // undefined = loading
  const [role,        setRole]        = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

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
    if (!user) return <AdminAuth onVerified={handleAdminVerified} />;

    // Logged in and confirmed admin → panel
    if (role === "admin") return <AdminPanel user={user} />;

    // Invite-based admin activation can briefly sign the user in before the role handoff
    // completes. Keep the invite-aware auth screen mounted so it can finish promotion.
    if (HAS_ADMIN_INVITE) return <AdminAuth onVerified={handleAdminVerified} currentUser={user} />;

    // Signed in but role not admin — show denied
    return <AccessDenied />;
  }

  // ── TEACHER APP (teacherct.vercel.app) ───────────────────────────────────
  if (user === undefined || (user && roleLoading)) return <Spinner text="Loading…" />;
  if (!user) return <Auth />;
  return <ClassTracker user={user} />;
}

function AccessDenied() {
  return (
    <div style={{minHeight:"100vh",background:"#152B22",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:16}}>🚫</div>
        <h2 style={{color:"#fff",fontFamily:"'Syne',sans-serif",fontSize:22,marginBottom:8}}>Access Denied</h2>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,marginBottom:24,lineHeight:1.6}}>
          Your account does not have admin privileges.<br/>Contact the super admin to request access.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <a href="https://teacherct.vercel.app/"
            style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"9px 18px",fontSize:13,textDecoration:"none"}}>
            ← Teacher app
          </a>
          <button onClick={logout}
            style={{background:"#C93030",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,cursor:"pointer"}}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode><App /></StrictMode>
);
