import { useState } from "react";
import { signupWithEmail, loginWithEmail, setUserProfile, setSuperAdminExists, getUserProfile } from "./firebase";
import { inp, friendlyError } from "./shared.jsx";

export default function Setup() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError("All fields are required."); return;
    }
    setLoading(true); setError("");
    try {
      let user;
      try {
        user = await signupWithEmail(name.trim(), email.trim(), password);
      } catch (e) {
        // Might already exist — try logging in
        if (e.code === "auth/email-already-in-use") {
          user = await loginWithEmail(email.trim(), password);
        } else throw e;
      }
      await setUserProfile(user.uid, {
        name: name.trim(), email: email.trim(),
        role: "superadmin", institutionId: null,
      });
      await setSuperAdminExists();
      // Auth state change in main.jsx will re-render automatically
    } catch (e) {
      setError(friendlyError(e.code));
    } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:420}}>

        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44,marginBottom:10}}>🔧</div>
          <h1 style={{margin:0,fontSize:26,fontWeight:600,color:"#1A1A1A"}}>First-Time Setup</h1>
          <p style={{margin:"8px 0 0",color:"#888",fontSize:14}}>Create the Super Administrator account.<br/>This screen will never appear again.</p>
        </div>

        <div style={{background:"#fff",borderRadius:18,padding:"26px 22px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)",border:"1.5px solid #EFEFEF"}}>
          <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:13,color:"#92400E"}}>
            ⚠ This account will have full access to all institutions and data.
          </div>

          <label style={{fontSize:11,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>FULL NAME</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Rajesh Kumar" style={inp}/>

          <label style={{fontSize:11,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>EMAIL ADDRESS</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@example.com" style={inp}/>

          <label style={{fontSize:11,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>PASSWORD</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="At least 6 characters"
            style={{...inp, marginBottom: error?8:16}}
            onKeyDown={e=>e.key==="Enter"&&handleCreate()}/>

          {error&&<div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:14}}>{error}</div>}

          <button onClick={handleCreate} disabled={loading}
            style={{width:"100%",padding:12,borderRadius:10,border:"none",background:loading?"#D5D5D5":"#1A1A1A",color:"#fff",fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:"monospace",letterSpacing:1}}>
            {loading?"Creating account…":"CREATE SUPER ADMIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
