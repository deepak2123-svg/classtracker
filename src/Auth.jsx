import { useState } from "react";
import { loginWithGoogle, signupWithEmail, loginWithEmail } from "./firebase";
import { inp, friendlyError } from "./shared.jsx";

export default function Auth() {
  const [tab, setTab]         = useState("login");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const go = async (fn) => {
    setLoading(true); setError("");
    try { await fn(); }
    catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  };

  const handleGoogle = () => go(loginWithGoogle);
  const handleSubmit = () => {
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    if (tab === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    go(() => tab === "signup"
      ? signupWithEmail(name.trim(), email.trim(), password)
      : loginWithEmail(email.trim(), password)
    );
  };

  return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:420}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44,marginBottom:8}}>📚</div>
          <h1 style={{margin:0,fontSize:28,fontWeight:400,color:"#1A1A1A",letterSpacing:-0.5}}>Class Tracker</h1>
          <p style={{margin:"6px 0 0",color:"#aaa",fontSize:13}}>Your academic planner</p>
        </div>

        {/* Card */}
        <div style={{background:"#fff",borderRadius:18,padding:"24px 22px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)",border:"1.5px solid #EFEFEF"}}>

          {/* Tab toggle */}
          <div style={{display:"flex",background:"#F5F5F5",borderRadius:10,padding:3,marginBottom:20}}>
            {["login","signup"].map(t=>(
              <button key={t} onClick={()=>{setTab(t);setError("");}}
                style={{flex:1,padding:"8px 0",border:"none",borderRadius:8,fontSize:12,fontFamily:"monospace",letterSpacing:1,cursor:"pointer",
                  background:tab===t?"#fff":"transparent",color:tab===t?"#1A1A1A":"#999",
                  fontWeight:tab===t?600:400,boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.10)":"none",transition:"all 0.15s"}}>
                {t==="login"?"LOG IN":"SIGN UP"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading}
            style={{width:"100%",padding:"11px 0",border:"1.5px solid #E5E5E5",borderRadius:10,background:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9,marginBottom:16,fontFamily:"Georgia,serif",color:"#333"}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{flex:1,height:1,background:"#F0F0F0"}}/>
            <span style={{fontSize:11,color:"#ccc",fontFamily:"monospace"}}>or</span>
            <div style={{flex:1,height:1,background:"#F0F0F0"}}/>
          </div>

          {tab==="signup"&&(
            <>
              <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>YOUR NAME</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={inp}/>
            </>
          )}

          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>EMAIL ADDRESS</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email address" style={inp}/>

          <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>PASSWORD</label>
          <input value={password} onChange={e=>setPass(e.target.value)} type="password" placeholder="Password"
            style={{...inp, marginBottom: error?8:16}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>

          {error&&<div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:14}}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{width:"100%",padding:12,borderRadius:10,border:"none",background:loading?"#D5D5D5":"#1A1A1A",color:"#fff",fontSize:13,cursor:loading?"not-allowed":"pointer",fontFamily:"monospace",letterSpacing:1}}>
            {loading?"Please wait…": tab==="login"?"LOG IN":"CREATE ACCOUNT"}
          </button>
        </div>

        <p style={{textAlign:"center",fontSize:11,color:"#ccc",marginTop:16}}>Your data is saved securely to your account.</p>
      </div>
    </div>
  );
}
