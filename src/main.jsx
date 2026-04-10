import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { onAuth, getUserRole, promoteToAdmin, logout } from "./firebase";
import { Spinner } from "./shared.jsx";
import Auth from "./Auth";
import ClassTracker from "./ClassTracker";
import AdminAuth from "./AdminAuth";
import AdminPanel from "./AdminPanel";

// ── Detect which app we are ───────────────────────────────────────────────────
// VITE_APP_MODE is set per-deployment in Vercel environment variables:
//   classtracker.vercel.app  → VITE_APP_MODE = "teacher"  (or not set)
//   ctadmin.vercel.app       → VITE_APP_MODE = "admin"
const IS_ADMIN_APP = import.meta.env.VITE_APP_MODE === "admin";

function App() {
  const [user,        setUser]        = useState(undefined); // undefined = loading
  const [role,        setRole]        = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => onAuth(async (u) => {
    setUser(u);
    if (u) {
      setRoleLoading(true);
      if (IS_ADMIN_APP) {
        // Anyone who signs in on the admin URL is automatically made admin
        await promoteToAdmin(u.uid, "self-signup");
        setRole("admin");
      } else {
        const r = await getUserRole(u.uid);
        setRole(r);
      }
      setRoleLoading(false);
    } else {
      setRole(null);
    }
  }), []);

  // ── ADMIN APP (ctadmin.vercel.app) ────────────────────────────────────────
  if (IS_ADMIN_APP) {
    if (user === undefined || roleLoading) return <Spinner text="Loading…" />;

    // Not logged in → admin login screen
    if (!user) return <AdminAuth onVerified={setUser} />;

    // Admin verified → panel (everyone on this URL is admin)
    if (role === "admin") return <AdminPanel user={user} />;

    return <Spinner text="Verifying access…" />;
  }

  // ── TEACHER APP (classtracker.vercel.app) ─────────────────────────────────
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
          <a href="https://classtracker.vercel.app"
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
