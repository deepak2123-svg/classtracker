import { useEffect, useState } from "react";
import { IconBrandGoogle, IconBook2, IconLock, IconUsers } from "@tabler/icons-react";
import { loginWithEmail, loginWithGoogle, signupWithEmail } from "../firebase";
import { friendlyError } from "../shared.jsx";
import { captureParentInvite } from "./parentInvite.js";

const C = {
  ink:"#102A23", muted:"#637B73", faint:"#94A69F", green:"#147A54",
  greenDark:"#0D5C40", mint:"#EAF7F1", border:"#DDE9E3", surface:"#FFFFFF",
  bg:"#F3F8F5", danger:"#B42318", dangerBg:"#FEF3F2",
};

const fieldStyle = {
  width:"100%", boxSizing:"border-box", height:50, borderRadius:14,
  border:`1.5px solid ${C.border}`, background:"#FBFDFC", color:C.ink,
  padding:"0 14px", fontSize:16, outline:"none", fontFamily:"Inter, sans-serif",
};

export default function ParentAuth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasInvite, setHasInvite] = useState(false);

  useEffect(() => setHasInvite(!!captureParentInvite()), []);

  const run = async action => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(friendlyError(cause?.code) || cause?.message || "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    run(() => mode === "signup"
      ? signupWithEmail(name.trim(), email.trim(), password)
      : loginWithEmail(email.trim(), password));
  };

  return (
    <main style={{minHeight:"100svh",background:`radial-gradient(circle at top right, #DDF4E8 0, transparent 34%), ${C.bg}`,fontFamily:"Inter, sans-serif",color:C.ink,padding:"22px 16px",boxSizing:"border-box"}}>
      <div style={{width:"100%",maxWidth:430,margin:"0 auto"}}>
        <header style={{padding:"22px 4px 20px"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:9,color:C.greenDark,fontWeight:900,fontSize:14,letterSpacing:0.2}}>
            <span style={{width:36,height:36,borderRadius:12,background:C.green,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#FFF"}}>
              <IconBook2 size={20} stroke={2.4}/>
            </span>
            LEDGR FOR PARENTS
          </div>
          <h1 style={{fontFamily:"Poppins, sans-serif",fontSize:34,lineHeight:1.08,letterSpacing:-1.2,margin:"24px 0 10px",fontWeight:800}}>
            Know what was taught today.
          </h1>
          <p style={{fontSize:15.5,lineHeight:1.65,color:C.muted,margin:0,maxWidth:390}}>
            One clear, read-only class timeline across every subject and teacher.
          </p>
        </header>

        {hasInvite&&(
          <div style={{display:"flex",gap:11,alignItems:"center",background:C.mint,border:"1px solid #CBE8D9",borderRadius:16,padding:"12px 14px",marginBottom:14}}>
            <IconUsers size={21} color={C.green} stroke={2}/>
            <div>
              <div style={{fontWeight:800,fontSize:13.5}}>Your class invitation is ready</div>
              <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>Sign in to connect your child’s section.</div>
            </div>
          </div>
        )}

        <section style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:24,padding:"18px",boxShadow:"0 18px 48px rgba(16,42,35,0.09)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:C.bg,borderRadius:13,padding:4,marginBottom:18}}>
            {[
              {key:"login",label:"Log in"},
              {key:"signup",label:"Create account"},
            ].map(item=>(
              <button key={item.key} type="button" onClick={()=>{setMode(item.key);setError("");}} style={{height:38,border:"none",borderRadius:10,background:mode===item.key?"#FFF":"transparent",color:mode===item.key?C.ink:C.muted,fontWeight:800,fontSize:13,cursor:"pointer",boxShadow:mode===item.key?"0 2px 8px rgba(16,42,35,0.08)":"none"}}>
                {item.label}
              </button>
            ))}
          </div>

          <button type="button" disabled={busy} onClick={()=>run(loginWithGoogle)} style={{width:"100%",height:50,borderRadius:14,border:`1.5px solid ${C.border}`,background:"#FFF",color:C.ink,fontWeight:750,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:9,cursor:busy?"wait":"pointer"}}>
            <IconBrandGoogle size={20} color="#4285F4"/>
            Continue with Google
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,margin:"17px 0",color:C.faint,fontSize:12}}>
            <span style={{height:1,background:C.border,flex:1}}/>
            or use email
            <span style={{height:1,background:C.border,flex:1}}/>
          </div>

          <div style={{display:"grid",gap:11}}>
            {mode==="signup"&&<input aria-label="Your name" value={name} onChange={event=>setName(event.target.value)} placeholder="Your name" autoComplete="name" style={fieldStyle}/>}
            <input aria-label="Email address" value={email} onChange={event=>setEmail(event.target.value)} placeholder="Email address" type="email" inputMode="email" autoComplete="email" style={fieldStyle}/>
            <input aria-label="Password" value={password} onChange={event=>setPassword(event.target.value)} onKeyDown={event=>event.key==="Enter"&&submitEmail()} placeholder="Password" type="password" autoComplete={mode==="login"?"current-password":"new-password"} style={fieldStyle}/>
          </div>

          {error&&<div role="alert" style={{background:C.dangerBg,color:C.danger,borderRadius:12,padding:"10px 12px",fontSize:13.5,lineHeight:1.45,marginTop:12}}>{error}</div>}

          <button type="button" disabled={busy} onClick={submitEmail} style={{width:"100%",height:50,border:"none",borderRadius:14,background:busy?"#9AB9AB":C.greenDark,color:"#FFF",fontWeight:850,fontSize:15.5,marginTop:14,cursor:busy?"wait":"pointer"}}>
            {busy?"Please wait…":mode==="login"?"Log in":"Create account"}
          </button>
        </section>

        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:7,color:C.faint,fontSize:12.5,marginTop:18}}>
          <IconLock size={15}/> Class access requires an institute invitation.
        </div>
      </div>
    </main>
  );
}
