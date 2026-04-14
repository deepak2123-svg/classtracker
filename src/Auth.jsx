import { useState } from "react";
import { loginWithGoogle, signupWithEmail, loginWithEmail } from "./firebase";
import { friendlyError } from "./shared.jsx";

const G = {
  forest:"#152B22", green:"#1B8A4C", greenV:"#34D077", greenL:"#E8F8EF",
  bg:"#F7F8F6", surface:"#FFFFFF", border:"#E6EAE8",
  text:"#0E1F18", textM:"#5C7268", textL:"#94ADA5",
  red:"#C93030", redL:"#FDF1F1",
  sans:"'Inter',sans-serif", display:"'Poppins',sans-serif",
  mono:"'JetBrains Mono',monospace",
};

const inp = {
  width:"100%", padding:"12px 14px", borderRadius:10,
  border:`1.5px solid ${G.border}`, fontSize:17,
  fontFamily:G.sans, outline:"none",
  background:G.surface, color:G.text, marginBottom:12,
  transition:"border-color 0.15s, box-shadow 0.15s",
  WebkitAppearance:"none",
};

export default function Auth() {
  const [tab, setTab]     = useState("login");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const go = async (fn) => {
    setLoading(true); setError("");
    try { await fn(); }
    catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  };

  const handleGoogle = () => go(loginWithGoogle);
  const handleSubmit = () => {
    if (!email.trim() || !pass) { setError("Email and password are required."); return; }
    if (tab === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    go(() => tab === "signup"
      ? signupWithEmail(name.trim(), email.trim(), pass)
      : loginWithEmail(email.trim(), pass)
    );
  };

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:G.sans,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px 14px"}}>
      <div style={{width:"100%",maxWidth:420}}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,borderRadius:16,background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px",boxShadow:`0 4px 16px rgba(27,138,76,0.3)`}}>🎓</div>
          <h1 style={{margin:0,fontSize:26,fontWeight:700,color:G.text,fontFamily:G.display,letterSpacing:-0.5}}>ClassLog</h1>
          <p style={{margin:"5px 0 0",color:G.textL,fontSize:15}}>Your academic planner</p>
        </div>

        {/* Card */}
        <div style={{background:G.surface,borderRadius:18,padding:"22px 16px",boxShadow:"0 4px 24px rgba(14,31,24,0.08)",border:`1px solid ${G.border}`}}>

          {/* Tabs */}
          <div style={{display:"flex",background:G.bg,borderRadius:10,padding:3,marginBottom:22}}>
            {["login","signup"].map(t=>(
              <button key={t} onClick={()=>{setTab(t);setError("");}}
                style={{flex:1,padding:"9px 0",border:"none",borderRadius:8,fontSize:14,fontFamily:G.mono,letterSpacing:1,cursor:"pointer",transition:"all 0.15s",
                  background:tab===t?G.surface:"transparent",
                  color:tab===t?G.text:G.textL,
                  fontWeight:tab===t?600:400,
                  boxShadow:tab===t?"0 1px 4px rgba(14,31,24,0.08)":"none"}}>
                {t==="login"?"LOG IN":"SIGN UP"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading}
            style={{width:"100%",padding:"12px 0",border:`1.5px solid ${G.border}`,borderRadius:10,background:G.surface,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9,marginBottom:18,fontFamily:G.sans,color:G.textM,fontWeight:500,transition:"border-color 0.15s",minHeight:48}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <div style={{flex:1,height:1,background:G.border}}/>
            <span style={{fontSize:13,color:G.textL,fontFamily:G.mono}}>or</span>
            <div style={{flex:1,height:1,background:G.border}}/>
          </div>

          {tab==="signup"&&(
            <>
              <label style={{fontSize:13,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,display:"block",marginBottom:5,textTransform:"uppercase"}}>Your name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ramsingh Yadav" style={inp}/>
            </>
          )}

          <label style={{fontSize:13,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,display:"block",marginBottom:5,textTransform:"uppercase"}}>Email address</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="your@email.com" style={inp}/>

          <label style={{fontSize:13,color:G.textL,fontFamily:G.mono,letterSpacing:0.5,display:"block",marginBottom:5,textTransform:"uppercase"}}>Password</label>
          <input value={pass} onChange={e=>setPass(e.target.value)} type="password" autoComplete={tab==="login"?"current-password":"new-password"} placeholder="Password"
            style={{...inp,marginBottom:error?10:18}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>

          {error&&<div style={{background:G.redL,color:G.red,borderRadius:9,padding:"9px 12px",fontSize:15,marginBottom:16,fontFamily:G.sans}}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:loading?"#B0C4B8":G.forest,color:"#fff",fontSize:16,cursor:loading?"not-allowed":"pointer",fontFamily:G.sans,fontWeight:600,letterSpacing:0.2,transition:"background 0.15s",minHeight:48}}>
            {loading?"Please wait…":tab==="login"?"Log In":"Create Account"}
          </button>
        </div>

        <p style={{textAlign:"center",fontSize:14,color:G.textL,marginTop:16,fontFamily:G.sans}}>Your data is saved securely to your account.</p>
      </div>
    </div>
  );
}
