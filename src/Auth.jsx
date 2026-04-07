import { useState, useEffect } from "react";
import { loginWithGoogle, signupWithEmail, loginWithEmail, getInvite, consumeInvite, setUserProfile } from "./firebase";
import { inp, friendlyError } from "./shared.jsx";

export default function AuthScreen() {
  const [mode, setMode]         = useState("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [invite, setInvite]     = useState(null); // invite metadata if token in URL

  // Check for invite token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    if (!token) return;
    getInvite(token).then(inv => {
      if (inv && !inv.used && new Date(inv.expiresAt) > new Date()) {
        setInvite({ token, ...inv });
        setMode("signup"); // push to signup when arriving via invite
      }
    });
  }, []);

  const clearErr = () => setError("");

  const handleGoogle = async () => {
    setLoading(true); clearErr();
    try {
      const user = await loginWithGoogle();
      if (invite) {
        await consumeInvite(invite.token, user.uid, user.displayName||"", user.email||"");
        window.history.replaceState({}, "", "/");
      }
    } catch(e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true); clearErr();
    try {
      let user;
      if (mode === "signup") {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        user = await signupWithEmail(name.trim(), email.trim(), password);
        if (invite) {
          await consumeInvite(invite.token, user.uid, name.trim(), email.trim());
          window.history.replaceState({}, "", "/");
        }
      } else {
        user = await loginWithEmail(email.trim(), password);
        // If logging in via invite link, still consume it
        if (invite) {
          await consumeInvite(invite.token, user.uid, user.displayName||name.trim(), email.trim());
          window.history.replaceState({}, "", "/");
        }
      }
    } catch(e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>

        {/* Invite banner */}
        {invite && (
          <div style={{background:"#D1FAE5",borderRadius:12,padding:"12px 16px",marginBottom:20,border:"1.5px solid #6BCB77"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#065F46"}}>🎉 You've been invited!</div>
            <div style={{fontSize:13,color:"#065F46",marginTop:3}}>Join <strong>{invite.institutionName}</strong> as a teacher. Create an account or log in to accept.</div>
          </div>
        )}

        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44,marginBottom:8}}>📚</div>
          <h1 style={{margin:0,fontSize:28,fontWeight:400,color:"#1A1A1A",letterSpacing:-0.5}}>Class Tracker</h1>
          <p style={{margin:"6px 0 0",color:"#888",fontSize:14}}>Your academic planner</p>
        </div>

        <div style={{background:"#fff",borderRadius:20,padding:"26px 22px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)",border:"1.5px solid #EFEFEF"}}>
          {/* Tabs */}
          <div style={{display:"flex",background:"#F5F5F5",borderRadius:10,padding:3,marginBottom:20}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);clearErr();}}
                style={{flex:1,padding:"8px 0",border:"none",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"monospace",letterSpacing:0.5,transition:"all 0.15s",
                  background:mode===m?"#fff":"transparent", color:mode===m?"#1A1A1A":"#aaa",
                  fontWeight:mode===m?600:400, boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.10)":"none"}}>
                {m==="login"?"LOG IN":"SIGN UP"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading}
            style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #E5E5E5",background:"#fff",fontSize:14,cursor:"pointer",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:14,color:"#1A1A1A"}}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{flex:1,height:1,background:"#EFEFEF"}}/><span style={{fontSize:11,color:"#bbb",fontFamily:"monospace"}}>or</span><div style={{flex:1,height:1,background:"#EFEFEF"}}/>
          </div>

          {mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={inp} autoComplete="name"/>}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" style={inp} autoComplete="email"/>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"
            style={{...inp,marginBottom:error?8:14}} autoComplete={mode==="signup"?"new-password":"current-password"}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>

          {error&&<div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:12}}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{width:"100%",padding:12,borderRadius:10,border:"none",background:loading?"#D5D5D5":"#1A1A1A",color:"#fff",fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:"monospace",letterSpacing:1}}>
            {loading?"Please wait…":mode==="signup"?"CREATE ACCOUNT":"LOG IN"}
          </button>
        </div>
        <p style={{textAlign:"center",marginTop:14,fontSize:12,color:"#aaa"}}>Your data is saved securely to your account.</p>
      </div>
    </div>
  );
}
