export const COLORS = [
  { bg:"#2563EB", light:"#EAF1FF", text:"#1E40AF" },
  { bg:"#0F766E", light:"#E8F8F6", text:"#115E59" },
  { bg:"#C2410C", light:"#FFF4E8", text:"#9A3412" },
  { bg:"#475569", light:"#EEF2F7", text:"#334155" },
  { bg:"#0369A1", light:"#E8F7FF", text:"#075985" },
  { bg:"#B42318", light:"#FEF3F2", text:"#912018" },
  { bg:"#1D4ED8", light:"#EAF1FF", text:"#1D4ED8" },
  { bg:"#334155", light:"#EFF4F8", text:"#334155" },
];

export const SECTION_TONES = [
  { bg:"#1D4ED8", light:"#E8F0FF", surface:"#DCE9FF", pill:"#F8FBFF", border:"#AFCBFF", ink:"#1E3A8A", text:"#FFFFFF" },
  { bg:"#2563EB", light:"#EAF2FF", surface:"#DFEBFF", pill:"#F8FBFF", border:"#BED4FF", ink:"#1D4ED8", text:"#FFFFFF" },
  { bg:"#0F766E", light:"#E7F7F3", surface:"#D7F0EA", pill:"#F6FCFA", border:"#A7DED1", ink:"#115E59", text:"#FFFFFF" },
  { bg:"#0891B2", light:"#E7F7FC", surface:"#D9F0F7", pill:"#F7FCFE", border:"#A9DAE8", ink:"#0E7490", text:"#FFFFFF" },
  { bg:"#15803D", light:"#ECFDF3", surface:"#DCF7E7", pill:"#F7FEFA", border:"#B7E6C8", ink:"#166534", text:"#FFFFFF" },
  { bg:"#0F6B78", light:"#E6F4F6", surface:"#D8ECEF", pill:"#F6FCFD", border:"#B0D8DE", ink:"#155E75", text:"#FFFFFF" },
  { bg:"#1E40AF", light:"#E7EEFF", surface:"#D9E5FF", pill:"#F7FAFF", border:"#AFC3F1", ink:"#1E3A8A", text:"#FFFFFF" },
  { bg:"#047857", light:"#E8FBF3", surface:"#D8F4E8", pill:"#F6FCF9", border:"#AFE2CA", ink:"#065F46", text:"#FFFFFF" },
];

function normaliseSectionToneKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function hashToneKey(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

export function getSectionTone(name) {
  const key = normaliseSectionToneKey(name);
  if (!key) return SECTION_TONES[0];
  return SECTION_TONES[hashToneKey(key) % SECTION_TONES.length];
}

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
  fontFamily:"'Inter',sans-serif", outline:"none",
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

export function LedgrLogoMark({ size=44, animated=false, background="#DCE6F2", ink="#1A2A52", style={} }) {
  const moons = [
    [240, 60], [367, 113], [420, 240], [367, 367],
    [240, 420], [113, 367], [60, 240], [113, 113],
  ];
  return (
    <svg
      className={animated ? "ledgr-logo-scene" : undefined}
      viewBox="0 0 480 480"
      width={size}
      height={size}
      aria-hidden="true"
      style={{display:"block",...style}}>
      <rect width="480" height="480" rx="96" fill={background}/>
      <defs>
        <clipPath id="ledgrMoonClip"><circle r="16"/></clipPath>
      </defs>
      <g className={animated ? "ledgr-logo-wheel" : undefined} style={{transformOrigin:"240px 240px"}}>
        {moons.map(([x, y], index) => (
          <g key={`${x}-${y}`} className={animated ? `ledgr-logo-moon ledgr-logo-moon-${index}` : undefined} transform={`translate(${x},${y})`}>
            <circle className={animated ? "ledgr-logo-glow" : undefined} r="16" fill={ink} opacity={animated ? 0 : 0.12}/>
            <circle r="16" fill={ink}/>
            <g clipPath="url(#ledgrMoonClip)" className={animated ? "ledgr-logo-mask" : undefined}>
              <circle r="16" fill={background}/>
            </g>
            <circle r="16" fill="none" stroke={ink} strokeWidth="2"/>
          </g>
        ))}
      </g>
      <text
        x="240"
        y="258"
        textAnchor="middle"
        fontFamily="'Sacramento', cursive"
        fontSize="64"
        fill={ink}>
        ledgr
      </text>
    </svg>
  );
}

export function LedgrLogoLockup({ admin=false, markSize=40, color="#10204A", subColor="#667085", animated=false, style={} }) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:12,minWidth:0,...style}}>
      <LedgrLogoMark size={markSize} animated={animated} />
      <div style={{display:"flex",alignItems:"baseline",gap:8,minWidth:0}}>
        <span style={{fontFamily:"'Sacramento', cursive",fontSize:Math.max(30, markSize * 0.96),lineHeight:0.92,color,fontWeight:400,whiteSpace:"nowrap"}}>
          ledgr
        </span>
        {admin && (
          <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2.2,textTransform:"uppercase",color:subColor,whiteSpace:"nowrap"}}>
            Admin
          </span>
        )}
      </div>
    </div>
  );
}

export function Spinner({ text="Loading…" }) {
  return (
    <div style={{minHeight:"100vh",background:"#DCE6F2",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"24px 16px"}}>
      <LedgrLogoMark size={232} animated />
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
        <div style={{fontFamily:"'Sacramento', cursive",fontSize:48,lineHeight:0.95,color:"#1A2A52"}}>ledgr</div>
        <div style={{color:"#1A2A52",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",textAlign:"center",opacity:0.78}}>{text}</div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sacramento&display=swap');
        .ledgr-logo-scene{
          opacity:0;
          animation:ledgr-logo-fade-in 1.2s ease-out forwards;
        }
        .ledgr-logo-wheel{
          animation:ledgr-logo-spin 24s linear infinite;
        }
        .ledgr-logo-glow{
          transform-origin:center;
          animation:ledgr-logo-glow 7s ease-in-out infinite;
        }
        .ledgr-logo-mask circle{
          transform-origin:center;
          animation:ledgr-logo-fill 7s ease-in-out infinite;
        }
        .ledgr-logo-moon-0 .ledgr-logo-mask circle, .ledgr-logo-moon-0 .ledgr-logo-glow { animation-delay:0s; }
        .ledgr-logo-moon-1 .ledgr-logo-mask circle, .ledgr-logo-moon-1 .ledgr-logo-glow { animation-delay:0.875s; }
        .ledgr-logo-moon-2 .ledgr-logo-mask circle, .ledgr-logo-moon-2 .ledgr-logo-glow { animation-delay:1.75s; }
        .ledgr-logo-moon-3 .ledgr-logo-mask circle, .ledgr-logo-moon-3 .ledgr-logo-glow { animation-delay:2.625s; }
        .ledgr-logo-moon-4 .ledgr-logo-mask circle, .ledgr-logo-moon-4 .ledgr-logo-glow { animation-delay:3.5s; }
        .ledgr-logo-moon-5 .ledgr-logo-mask circle, .ledgr-logo-moon-5 .ledgr-logo-glow { animation-delay:4.375s; }
        .ledgr-logo-moon-6 .ledgr-logo-mask circle, .ledgr-logo-moon-6 .ledgr-logo-glow { animation-delay:5.25s; }
        .ledgr-logo-moon-7 .ledgr-logo-mask circle, .ledgr-logo-moon-7 .ledgr-logo-glow { animation-delay:6.125s; }
        @keyframes ledgr-logo-fill{
          0%{ transform:translateX(-32px); }
          50%{ transform:translateX(0); }
          100%{ transform:translateX(32px); }
        }
        @keyframes ledgr-logo-glow{
          0%{ opacity:0; transform:scale(1); }
          50%{ opacity:0.22; transform:scale(1.6); }
          100%{ opacity:0; transform:scale(1); }
        }
        @keyframes ledgr-logo-spin{
          from{ transform:rotate(0deg); }
          to{ transform:rotate(360deg); }
        }
        @keyframes ledgr-logo-fade-in{
          from{ opacity:0; transform:scale(0.96); }
          to{ opacity:1; transform:scale(1); }
        }
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
