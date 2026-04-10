import { useState } from "react";
import { loginWithGoogle, loginWithEmail, getUserRole, logout } from "./firebase";
import { friendlyError } from "./shared.jsx";

const G = {
  forest:"#152B22", forestS:"#1E3D2F",
  green:"#1B8A4C",  greenV:"#34D077", greenL:"#E8F8EF",
  surface:"#FFFFFF", border:"#E6EAE8",
  text:"#0E1F18",   textM:"#5C7268",  textL:"#94ADA5",
  red:"#C93030",    redL:"#FDF1F1",
  mono:"'JetBrains Mono',monospace",
  sans:"'Plus Jakarta Sans',sans-serif",
  display:"'Syne',sans-serif",
};

export default function AdminAuth({ onVerified }) {
  const [mode, setMode]     = useState("choose"); // choose | email
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function verify(user) {
    setLoading(true);
    setError("");
    try {
      const role = await getUserRole(user.uid);
      if (role === "admin") {
        onVerified(user);
      } else {
        await logout();
        setError("This account does not have admin access. Please contact the super admin.");
        setMode("choose");
      }
    } catch {
      setError("Could not verify access. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(""); setLoading(true);
    try {
      const user = await loginWithGoogle();
      await verify(user);
    } catch (e) {
      setError(friendlyError(e.code));
      setLoading(false);
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await loginWithEmail(email, pass);
      await verify(user);
    } catch (e) {
      setError(friendlyError(e.code));
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:G.forest,fontFamily:G.sans,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>

      {/* Subtle background pattern */}
      <div style={{position:"absolute",inset:0,opacity:0.03,backgroundImage:"radial-gradient(circle, #fff 1px, transparent 1px)",backgroundSize:"28px 28px",pointerEvents:"none"}}/>

      {/* Lock badge */}
      <div style={{marginBottom:32,textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:20,background:"rgba(52,208,119,0.12)",border:"1px solid rgba(52,208,119,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🔐</div>
        <div style={{fontSize:11,fontFamily:G.mono,letterSpacing:3,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:6}}>ClassLog</div>
        <h1 style={{fontSize:26,fontWeight:700,color:"#fff",fontFamily:G.display,letterSpacing:-0.5,margin:0}}>Admin Portal</h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginTop:8,fontFamily:G.sans}}>Restricted access — authorised personnel only</p>
      </div>

      {/* Card */}
      <div style={{width:"100%",maxWidth:400,background:"rgba(255,255,255,0.06)",borderRadius:20,padding:"28px 26px",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>

        {mode === "choose" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={handleGoogle} disabled={loading}
              style={{width:"100%",padding:"13px",background:"#fff",color:G.text,border:"none",borderRadius:11,fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.6:1,transition:"opacity 0.15s"}}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
            <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",fontFamily:G.mono}}>or</span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
            </div>
            <button onClick={()=>setMode("email")} disabled={loading}
              style={{width:"100%",padding:"13px",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:11,fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:500,opacity:loading?0.6:1}}>
              Sign in with Email
            </button>
          </div>
        )}

        {mode === "email" && (
          <form onSubmit={handleEmail} style={{display:"flex",flexDirection:"column",gap:10}}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Admin email" required autoFocus
              style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.09)",color:"#fff",fontSize:14,fontFamily:G.sans,outline:"none"}}/>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="Password" required
              style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.09)",color:"#fff",fontSize:14,fontFamily:G.sans,outline:"none"}}/>
            <button type="submit" disabled={loading||!email||!pass}
              style={{width:"100%",padding:"13px",background:loading?"rgba(52,208,119,0.3)":G.greenV,color:G.forest,border:"none",borderRadius:11,fontSize:14,cursor:loading||!email||!pass?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:700,opacity:!email||!pass?0.5:1,transition:"all 0.15s"}}>
              {loading?"Verifying…":"Sign In"}
            </button>
            <button type="button" onClick={()=>{setMode("choose");setError("");}}
              style={{background:"none",border:"none",color:"rgba(255,255,255,0.35)",fontSize:12,cursor:"pointer",fontFamily:G.mono,padding:"4px"}}>
              ← Back
            </button>
          </form>
        )}

        {error&&(
          <div style={{marginTop:14,background:"rgba(201,48,48,0.12)",border:"1px solid rgba(201,48,48,0.25)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#FCA5A5",fontFamily:G.sans,lineHeight:1.5}}>
            ⚠ {error}
          </div>
        )}

        {loading&&!error&&(
          <div style={{marginTop:14,textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.3)",fontFamily:G.mono}}>
            Verifying admin access…
          </div>
        )}
      </div>

      {/* Back to teacher app link */}
      <a href="/" style={{marginTop:24,fontSize:12,color:"rgba(255,255,255,0.2)",fontFamily:G.mono,textDecoration:"none",transition:"color 0.12s"}}
        onMouseEnter={e=>e.target.style.color="rgba(255,255,255,0.5)"}
        onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.2)"}>
        ← Teacher app
      </a>
    </div>
  );
}
