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

export const TAG_STYLES = {
  note:      { bg:"#E8EDFF", text:"#3730A3", label:"📝 Note" },
  todo:      { bg:"#FEF3C7", text:"#92400E", label:"✅ To-Do" },
  important: { bg:"#FEE2E2", text:"#991B1B", label:"🔥 Important" },
  resource:  { bg:"#D1FAE5", text:"#065F46", label:"🔗 Resource" },
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
export function formatPeriod(s,e) { return s?(e?`${fmt(s)} – ${fmt(e)}`:fmt(s)):""; }
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
    <div style={{minHeight:"100vh",background:"#F7F8F6",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #E5E5E5",borderTopColor:"#1B8A4C",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{color:"#aaa",fontSize:15,fontFamily:"'Inter',sans-serif"}}>{text}</div>
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
