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
      <div style={{position:"relative",width:132,height:96,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{position:"absolute",bottom:2,width:108,height:14,borderRadius:999,background:"rgba(15,23,42,0.1)",filter:"blur(7px)"}}/>
        <svg className="book-loader-shell" viewBox="0 0 180 120" aria-hidden="true" style={{width:132,height:96,overflow:"visible"}}>
          <path className="book-loader-base book-loader-base-left" d="M90 90 C68 83 39 84 14 94 L18 100 C42 91 66 92 89 101 Z"/>
          <path className="book-loader-base book-loader-base-right" d="M90 90 C112 83 141 84 166 94 L162 100 C138 91 114 92 91 101 Z"/>
          <path className="book-loader-stack" d="M92 84 C116 78 143 79 167 88"/>
          <path className="book-loader-stack" d="M93 88 C118 82 144 83 166 91"/>
          <path className="book-loader-stack book-loader-stack-left" d="M88 84 C64 78 37 79 13 88"/>
          <path className="book-loader-stack book-loader-stack-left" d="M87 88 C62 82 36 83 14 91"/>
          <g className="book-loader-leaf book-loader-leaf-a">
            <path d="M89 88 C92 65 101 41 118 21 C110 23 102 28 95 35 C86 45 82 61 82 84 Z"/>
          </g>
          <g className="book-loader-leaf book-loader-leaf-b">
            <path d="M89 88 C93 61 104 35 128 12 C117 16 107 22 98 32 C88 44 83 60 82 85 Z"/>
          </g>
          <g className="book-loader-leaf book-loader-leaf-c">
            <path d="M89 88 C94 58 110 31 139 10 C126 13 114 20 103 30 C91 42 84 60 82 85 Z"/>
          </g>
          <g className="book-loader-leaf book-loader-leaf-d">
            <path d="M89 88 C95 55 114 28 149 12 C136 13 123 19 110 30 C96 42 86 60 82 85 Z"/>
          </g>
          <path className="book-loader-spine" d="M84 87 C85 98 87 108 90 114 C93 108 95 98 96 87"/>
          <path className="book-loader-crease" d="M90 88 C89 95 89 102 90 110"/>
        </svg>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
        <div style={{fontSize:14,fontWeight:800,letterSpacing:1.1,textTransform:"uppercase",color:"#2563EB",fontFamily:"'Inter',sans-serif"}}>Loading Ledgr</div>
        <div style={{color:"#64748B",fontSize:15,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>{text}</div>
      </div>
      <style>{`
        .book-loader-shell{
          overflow:visible;
          animation:book-shell-float 2.3s ease-in-out infinite;
        }
        .book-loader-base{
          fill:#FFFFFF;
          stroke:#CBD5E1;
          stroke-width:1.8;
          filter:drop-shadow(0 10px 18px rgba(37,99,235,0.08));
        }
        .book-loader-base-left{
          fill:#F8FAFC;
        }
        .book-loader-base-right{
          fill:#EFF6FF;
        }
        .book-loader-stack{
          fill:none;
          stroke:rgba(148,163,184,0.65);
          stroke-width:1.7;
          stroke-linecap:round;
        }
        .book-loader-stack-left{
          stroke:rgba(148,163,184,0.52);
        }
        .book-loader-leaf{
          fill:#FFFFFF;
          stroke:#DBEAFE;
          stroke-width:1.25;
          transform-box:view-box;
          transform-origin:90px 88px;
          filter:drop-shadow(0 8px 12px rgba(37,99,235,0.12));
          will-change:transform, opacity;
          opacity:0;
        }
        .book-loader-leaf path{
          fill:rgba(255,255,255,0.96);
        }
        .book-loader-leaf-a{ animation:book-side-page-turn 1.8s cubic-bezier(.2,.75,.25,1) infinite; }
        .book-loader-leaf-b{ animation:book-side-page-turn 1.8s cubic-bezier(.2,.75,.25,1) infinite 0.18s; }
        .book-loader-leaf-c{ animation:book-side-page-turn 1.8s cubic-bezier(.2,.75,.25,1) infinite 0.36s; }
        .book-loader-leaf-d{ animation:book-side-page-turn 1.8s cubic-bezier(.2,.75,.25,1) infinite 0.54s; }
        .book-loader-spine{
          fill:none;
          stroke:#2563EB;
          stroke-width:3.4;
          stroke-linecap:round;
          opacity:0.92;
        }
        .book-loader-crease{
          fill:none;
          stroke:rgba(37,99,235,0.28);
          stroke-width:1.8;
          stroke-linecap:round;
        }
        @keyframes book-shell-float{
          0%, 100% { transform:translateY(0px); }
          50% { transform:translateY(-2px); }
        }
        @keyframes book-side-page-turn{
          0%{
            transform:rotate(18deg) translateY(2px) scale(0.9);
            opacity:0;
          }
          12%{
            opacity:0.94;
          }
          36%{
            transform:rotate(4deg) translateY(-1px) scale(0.97);
            opacity:1;
          }
          62%{
            transform:rotate(-20deg) translateY(-4px) scale(1.03);
            opacity:0.96;
          }
          82%{
            transform:rotate(-36deg) translateY(-6px) scale(1.05);
            opacity:0.52;
          }
          100%{
            transform:rotate(-48deg) translateY(-7px) scale(1.02);
            opacity:0;
          }
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
