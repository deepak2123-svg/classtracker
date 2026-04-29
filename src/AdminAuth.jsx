import { useState, useEffect, useRef } from "react";
import { loginWithGoogle, loginWithEmail, signupWithEmail, useInviteToken, db, saveProfileName } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { friendlyError } from "./shared.jsx";

const G = {
  navy:"#1A2F5A", blueV:"#3B82F6", blueL:"#DBEAFE",
  blue:"#1D4ED8", bg:"#F7F8FC", border:"#E2E8F0",
  text:"#0E1F18", textM:"#4B5563", textL:"#6B7280",
  red:"#C93030", sans:"'Inter',sans-serif",
  display:"'Poppins',sans-serif", mono:"'JetBrains Mono',monospace",
};

const ADMIN_INVITE_STORAGE_KEY = "ct_admin_invite_token";

function readInviteToken() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite") || window.sessionStorage.getItem(ADMIN_INVITE_STORAGE_KEY) || null;
  if (token) {
    window.sessionStorage.setItem(ADMIN_INVITE_STORAGE_KEY, token);
  }
  return token;
}

function clearInviteToken() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(ADMIN_INVITE_STORAGE_KEY); } catch {}
}

// ── Name setup screen — shown after first admin login ─────────────────────────
function NameSetup({ user, onDone }) {
  const [name, setName] = useState(user.displayName || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await saveProfileName(user.uid, name.trim());
    setSaving(false);
    onDone();
  }

  return (
    <div style={{minHeight:"100svh",width:"100%",background:G.navy,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <div style={{width:"100%",maxWidth:400,background:"rgba(255,255,255,0.06)",borderRadius:20,padding:"28px 20px",border:"1px solid rgba(255,255,255,0.1)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:36,marginBottom:12}}>👑</div>
          <h2 style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:G.display,margin:0}}>Welcome, Admin!</h2>
          <p style={{fontSize:15,color:"rgba(255,255,255,0.55)",marginTop:8,lineHeight:1.5}}>
            What should we call you? Your name will appear on the admin panel.
          </p>
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Your full name"
          autoFocus
          style={{width:"100%",padding:"13px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.09)",color:"#fff",fontSize:16,fontFamily:G.sans,outline:"none",boxSizing:"border-box",marginBottom:12}}
        />
        <button onClick={handleSave} disabled={!name.trim() || saving}
          style={{width:"100%",padding:"13px",background:name.trim()?G.blueV:"rgba(255,255,255,0.1)",color:name.trim()?"#fff":"rgba(255,255,255,0.3)",border:"none",borderRadius:10,fontSize:16,fontFamily:G.sans,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed"}}>
          {saving ? "Saving…" : "Get started →"}
        </button>
      </div>
    </div>
  );
}

export default function AdminAuth({ onVerified, currentUser = null }) {
  const [mode,    setMode]    = useState("choose");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null); // waiting for name setup
  const inviteProcessingRef = useRef(false);
  const inviteResolvedKeyRef = useRef("");

  const [inviteToken] = useState(() => readInviteToken());

  const hasInvite = !!inviteToken;

  function finishVerified(user) {
    clearInviteToken();
    onVerified(user);
  }

  async function afterLogin(user) {
    try {
      // 1. Already admin?
      const snap = await getDoc(doc(db, "roles", user.uid));
      const isAdmin = snap.exists() && snap.data().role === "admin";

      if (isAdmin) {
        window.history.replaceState({}, "", window.location.pathname);
        // Check if they have a saved name — if not, show name setup
        const dataSnap = await getDoc(doc(db, "users", user.uid, "appdata", "main")).catch(() => null);
        const hasName = dataSnap?.exists() && dataSnap.data()?.profile?.name;
        if (!hasName && !user.displayName) {
          setPendingUser(user);
          return;
        }
        // Save displayName if we have it but Firestore doesn't
        if (!hasName && user.displayName) {
          await saveProfileName(user.uid, user.displayName);
        }
        finishVerified(user);
        return;
      }

      // 2. Try invite token
      if (inviteToken) {
        try {
          await useInviteToken(inviteToken, user.uid);
          window.history.replaceState({}, "", window.location.pathname);
          // New admin — always ask for name
          setPendingUser(user);
          return;
        } catch (e) {
          setError(e.message || "Invite link is invalid or expired.");
          return;
        }
      }

      setError("You don't have admin access. Ask an admin to promote you or share an invite link.");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }

  useEffect(() => {
    const inviteKey = currentUser && inviteToken ? `${currentUser.uid}:${inviteToken}` : "";
    if (!currentUser || !inviteToken || pendingUser || loading || inviteProcessingRef.current || inviteResolvedKeyRef.current === inviteKey) return;
    inviteProcessingRef.current = true;
    inviteResolvedKeyRef.current = inviteKey;
    setError("");
    setLoading(true);

    afterLogin(currentUser).finally(() => {
      inviteProcessingRef.current = false;
      setLoading(false);
    });
  }, [currentUser, inviteToken, pendingUser, loading]);

  async function handleGoogle() {
    setError(""); setLoading(true);
    try { const u = await loginWithGoogle(); await afterLogin(u); }
    catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      let u;
      try { u = await loginWithEmail(email, pass); }
      catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          u = await signupWithEmail(email.split("@")[0], email, pass);
        } else throw err;
      }
      await afterLogin(u);
    }
    catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  }

  // Show name setup screen before handing off to the admin panel
  if (pendingUser) {
    return <NameSetup user={pendingUser} onDone={() => finishVerified(pendingUser)} />;
  }

  const inp = {
    width:"100%", padding:"12px 14px", borderRadius:10,
    border:"1px solid rgba(255,255,255,0.15)",
    background:"rgba(255,255,255,0.09)", color:"#fff",
    fontSize:17, fontFamily:G.sans, outline:"none", WebkitAppearance:"none",
  };

  return (
    <div style={{minHeight:"100svh",width:"100%",overflowX:"hidden",background:G.navy,fontFamily:G.sans,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px",position:"relative",overflow:"hidden"}}>

      <div style={{position:"absolute",inset:0,opacity:0.03,backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"28px 28px",pointerEvents:"none"}}/>

      <div style={{marginBottom:32,textAlign:"center"}}>
        <div style={{width:60,height:60,borderRadius:18,background:G.blueV,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(59,130,246,0.4)"}}>🔐</div>
        <div style={{fontSize:12,fontFamily:G.mono,letterSpacing:3,color:"rgba(255,255,255,0.65)",textTransform:"uppercase",marginBottom:5}}>ClassLog</div>
        <h1 style={{fontSize:24,fontWeight:700,color:"#fff",fontFamily:G.display,letterSpacing:-0.4,margin:0}}>Admin Portal</h1>
        <p style={{fontSize:15,color:"rgba(255,255,255,0.7)",marginTop:6}}>
          {hasInvite ? "You've been invited — sign in to activate access" : "Sign in to your admin account"}
        </p>
      </div>

      <div style={{width:"100%",maxWidth:400,background:"rgba(255,255,255,0.06)",borderRadius:20,padding:"22px 16px",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>

        {hasInvite && (
          <div style={{background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:10,padding:"9px 14px",marginBottom:18,fontSize:14,color:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:17}}>🔗</span>
            <span>Invite link detected — sign in to become admin</span>
          </div>
        )}

        {mode === "choose" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={handleGoogle} disabled={loading}
              style={{width:"100%",padding:"13px",background:"#fff",color:G.text,border:"none",borderRadius:11,fontSize:16,cursor:loading?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,minHeight:48,opacity:loading?0.7:1}}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <div style={{display:"flex",alignItems:"center",gap:10,margin:"2px 0"}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/><span style={{fontSize:13,color:"rgba(255,255,255,0.25)",fontFamily:G.mono}}>or</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
            </div>
            <button onClick={()=>setMode("email")} disabled={loading}
              style={{width:"100%",padding:"13px",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:11,fontSize:16,cursor:"pointer",fontFamily:G.sans,fontWeight:500,minHeight:48}}>
              Sign in with Email
            </button>
          </div>
        )}

        {mode === "email" && (
          <form onSubmit={handleEmail} style={{display:"flex",flexDirection:"column",gap:10}}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required autoFocus style={inp}/>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" required style={{...inp,marginBottom:4}}/>
            <button type="submit" disabled={loading||!email||!pass}
              style={{width:"100%",padding:"13px",background:G.blueV,color:"#fff",border:"none",borderRadius:11,fontSize:16,cursor:"pointer",fontFamily:G.sans,fontWeight:700,minHeight:48,opacity:(!email||!pass||loading)?0.5:1}}>
              {loading ? "Signing in…" : hasInvite ? "Sign In & Activate Access" : "Sign In"}
            </button>
            <button type="button" onClick={()=>{setMode("choose");setError("");}}
              style={{background:"none",border:"none",color:"rgba(255,255,255,0.65)",fontSize:14,cursor:"pointer",fontFamily:G.mono}}>
              ← Back
            </button>
          </form>
        )}

        {error && (
          <div style={{marginTop:14,background:"rgba(201,48,48,0.12)",border:"1px solid rgba(201,48,48,0.25)",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#FCA5A5",lineHeight:1.5}}>
            ⚠ {error}
          </div>
        )}
      </div>

      <a href="https://teacherct.vercel.app/"
        style={{marginTop:24,fontSize:14,color:"rgba(255,255,255,0.2)",fontFamily:G.mono,textDecoration:"none"}}
        onMouseEnter={e=>e.target.style.color="rgba(255,255,255,0.5)"}
        onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.2)"}>
        ← Teacher app
      </a>
    </div>
  );
}
