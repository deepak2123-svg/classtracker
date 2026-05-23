export const COLORS = [
  { bg:"#FF6B6B", light:"#FFE5E5", text:"#8B0000" },
  { bg:"#4ECDC4", light:"#E0F7F6", text:"#00574B" },
  { bg:"#FFD93D", light:"#FFF8DC", text:"#7A5C00" },
  { bg:"#6BCB77", light:"#E4F7E6", text:"#1A5C27" },
  { bg:"#845EC2", light:"#EFE6FF", text:"#3D007A" },
  { bg:"#FF9671", light:"#FFF0E8", text:"#7A3000" },
  { bg:"#0089BA", light:"#E0F2FA", text:"#004A6E" },
  { bg:"#F9A8D4", light:"#FDE8F5", text:"#7C1A50" },
];

export const STATUS_STYLES = {
  started:    { bg:"#DBEAFE", text:"#1D4ED8", label:"🔵 Started",     dot:"#3B82F6" },
  inprogress: { bg:"#FEF3C7", text:"#B45309", label:"🟡 In Progress", dot:"#F59E0B" },
  completed:  { bg:"#D1FAE5", text:"#065F46", label:"🟢 Completed",   dot:"#10B981" },
  doubts:     { bg:"#FFEDD5", text:"#9A3412", label:"🟠 Doubts",      dot:"#F97316" },
};

export const TAG_STYLES = {
  note:      { bg:"#E8EDFF", text:"#3730A3", label:"📝 Note" },
  important: { bg:"#FEE2E2", text:"#991B1B", label:"🔥 Important" },
};

export const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const MONTHS = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"];

export const inp = {
  width:"100%", padding:"11px 14px", borderRadius:10,
  border:"1.5px solid #E5E5E5", fontSize:17,
  fontFamily:"Georgia,serif", outline:"none",
  background:"#fff", boxSizing:"border-box", marginBottom:10,
};

export function fmt(t) {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}
export function formatPeriod(s,e) {
  try{
    if(!s||typeof s!=="string")return "";
    return e&&typeof e==="string"?`${fmt(s)} – ${fmt(e)}`:fmt(s);
  }catch(err){return s||"";}
}
export function toDateKey(y,m,d){ return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
export function todayKey(){ const n=new Date(); return toDateKey(n.getFullYear(),n.getMonth(),n.getDate()); }
export function formatDateLabel(dk){
  if(!dk) return "";
  const [y,m,d]=dk.split("-").map(Number);
  if(dk===todayKey()) return "Today";
  return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
}

export function Spinner({ text="Loading…" }) {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg, #F8FAFC 0%, #EEF4FF 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:"24px 16px"}}>
      <div style={{position:"relative",width:116,height:84,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{position:"absolute",bottom:0,width:92,height:12,borderRadius:999,background:"rgba(15,23,42,0.08)",filter:"blur(5px)"}}/>
        <div className="book-loader-shell" style={{position:"relative",width:96,height:68,perspective:"1200px"}}>
          <div className="book-loader-cover book-loader-cover-left"/>
          <div className="book-loader-cover book-loader-cover-right"/>
          <div className="book-loader-page book-loader-page-a"/>
          <div className="book-loader-page book-loader-page-b"/>
          <div className="book-loader-page book-loader-page-c"/>
          <div className="book-loader-spine"/>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
        <div style={{fontSize:14,fontWeight:800,letterSpacing:1.1,textTransform:"uppercase",color:"#2563EB",fontFamily:"'Inter',sans-serif"}}>Loading ClassTracker</div>
        <div style={{color:"#64748B",fontSize:15,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>{text}</div>
      </div>
      <style>{`
        .book-loader-shell{
          transform-style:preserve-3d;
        }
        .book-loader-cover,
        .book-loader-page,
        .book-loader-spine{
          position:absolute;
          inset:0;
          border-radius:16px;
        }
        .book-loader-cover-left{
          background:linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
          box-shadow:0 18px 32px rgba(15,23,42,0.18);
          transform:translateZ(0);
        }
        .book-loader-cover-right{
          background:linear-gradient(180deg, #2563EB 0%, #3B82F6 100%);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.18);
          transform-origin:left center;
          animation:book-cover-turn 1.6s ease-in-out infinite;
        }
        .book-loader-page{
          inset:5px 6px 5px 42px;
          border-radius:12px;
          background:linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%);
          transform-origin:left center;
          box-shadow:0 4px 10px rgba(37,99,235,0.08);
        }
        .book-loader-page-a{ animation:book-page-turn 1.6s ease-in-out infinite 0.12s; }
        .book-loader-page-b{ animation:book-page-turn 1.6s ease-in-out infinite 0.26s; }
        .book-loader-page-c{ animation:book-page-turn 1.6s ease-in-out infinite 0.4s; }
        .book-loader-spine{
          width:10px;
          left:37px;
          right:auto;
          border-radius:8px;
          background:linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%);
          box-shadow:inset -1px 0 0 rgba(255,255,255,0.16);
        }
        @keyframes book-cover-turn{
          0%, 18% { transform:rotateY(0deg); }
          48%, 72% { transform:rotateY(-152deg); }
          100% { transform:rotateY(0deg); }
        }
        @keyframes book-page-turn{
          0%, 22% { transform:rotateY(0deg); opacity:0.96; }
          48% { transform:rotateY(-168deg); opacity:0.88; }
          75% { transform:rotateY(-176deg); opacity:0.32; }
          100% { transform:rotateY(0deg); opacity:0.96; }
        }
      `}</style>
    </div>
  );
}

export function Avatar({ user, size=36 }) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
      {user.photoURL
        ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
        : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,background:"#4ECDC4",color:"#fff",fontWeight:600}}>
            {(user.displayName||user.email||"?")[0].toUpperCase()}
          </div>
      }
    </div>
  );
}

export function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":   "That email is already registered.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/user-not-found":         "No account found with that email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
    "auth/popup-closed-by-user":   "Google sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/native-google-client-id-missing":
      "Google sign-in is missing the Android web client ID configuration.",
    "auth/native-google-token-missing":
      "Google sign-in did not return an ID token. Check the Android OAuth setup.",
    "SIGN_IN_CANCELED":
      "Google sign-in was cancelled.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ── Ripple effect ─────────────────────────────────────────────────────────────
export function ripple(e, dark = false) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left - size / 2;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top - size / 2;
  const wave = document.createElement("span");
  wave.className = "ripple-wave" + (dark ? " dark" : "");
  wave.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  el.appendChild(wave);
  wave.addEventListener("animationend", () => wave.remove());
}
