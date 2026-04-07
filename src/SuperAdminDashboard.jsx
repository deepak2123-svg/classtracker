import { useState, useEffect } from "react";
import { getAllInstitutions, createInstitution, getUserProfileByEmail, transferSuperAdmin, logout } from "./firebase";
import { inp, Spinner, Avatar } from "./shared.jsx";

export default function SuperAdminDashboard({ user, profile }) {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState("home"); // home | createInst | transferAdmin
  const [creating, setCreating]         = useState(false);

  // Create institution form
  const [instName, setInstName]       = useState("");
  const [adminEmail, setAdminEmail]   = useState("");
  const [adminName, setAdminName]     = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Transfer form
  const [transferEmail, setTransferEmail] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferDone, setTransferDone] = useState(false);

  useEffect(() => {
    getAllInstitutions().then(list => { setInstitutions(list); setLoading(false); });
  }, []);

  const handleCreateInstitution = async () => {
    if (!instName.trim() || !adminEmail.trim() || !adminName.trim()) {
      setCreateError("All fields are required."); return;
    }
    setCreateLoading(true); setCreateError("");
    try {
      // Check if admin email already has an account
      const existing = await getUserProfileByEmail(adminEmail.trim());
      const uid   = existing?.uid || null;
      const name  = existing?.name || adminName.trim();
      const email = adminEmail.trim();

      if (!uid) {
        setCreateError("No account found with that email. Ask the admin to sign up first, then assign them here.");
        setCreateLoading(false); return;
      }

      await createInstitution(instName.trim(), uid, name, email, user.uid);
      const updated = await getAllInstitutions();
      setInstitutions(updated);
      setInstName(""); setAdminEmail(""); setAdminName("");
      setView("home");
    } catch(e) {
      setCreateError("Failed to create institution. Please try again.");
    } finally { setCreateLoading(false); }
  };

  const handleTransfer = async () => {
    if (!transferEmail.trim()) { setTransferError("Enter an email address."); return; }
    setTransferLoading(true); setTransferError("");
    try {
      const target = await getUserProfileByEmail(transferEmail.trim());
      if (!target) { setTransferError("No account found with that email."); setTransferLoading(false); return; }
      if (target.uid === user.uid) { setTransferError("That's your own account."); setTransferLoading(false); return; }
      await transferSuperAdmin(user.uid, target.uid, target.name, target.email);
      setTransferDone(true);
      setTimeout(() => logout(), 2000);
    } catch(e) {
      setTransferError("Transfer failed. Please try again.");
    } finally { setTransferLoading(false); }
  };

  if (loading) return <Spinner text="Loading institutions…"/>;

  const BG = "#1A1A1A";

  // ── TRANSFER DONE ────────────────────────────────────────────────────────
  if (transferDone) return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:44,marginBottom:12}}>✅</div>
        <div style={{fontSize:18,fontWeight:600,color:"#1A1A1A"}}>Super Admin transferred.</div>
        <div style={{fontSize:14,color:"#888",marginTop:6}}>You will be signed out shortly.</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",fontFamily:"Georgia,serif"}}>
      {/* Header */}
      <div style={{background:BG,padding:"20px 20px 18px"}}>
        <div style={{maxWidth:700,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:4,color:"#888",textTransform:"uppercase",marginBottom:4}}>Super Administrator</div>
            <h1 style={{margin:0,fontSize:24,fontWeight:600,color:"#fff",letterSpacing:-0.3}}>All Institutions</h1>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Avatar user={user}/>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:"#ddd"}}>{profile?.name||user.displayName}</div>
              <button onClick={logout} style={{background:"none",border:"none",fontSize:11,color:"#888",cursor:"pointer",fontFamily:"monospace",padding:0}}>Sign out</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"24px 20px"}}>

        {/* View: home */}
        {view==="home"&&(
          <>
            {/* Stats row */}
            <div style={{display:"flex",gap:12,marginBottom:24}}>
              {[
                { label:"Institutions", value:institutions.length, icon:"🏫" },
                { label:"Total Admins",  value:institutions.length, icon:"👤" },
              ].map(s=>(
                <div key={s.label} style={{flex:1,background:"#fff",borderRadius:12,padding:"14px 18px",border:"1.5px solid #EFEFEF",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24}}>{s.icon}</span>
                  <div>
                    <div style={{fontSize:22,fontWeight:700,color:"#1A1A1A"}}>{s.value}</div>
                    <div style={{fontSize:12,color:"#aaa",fontFamily:"monospace"}}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Institution list */}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {institutions.length===0&&(
                <div style={{textAlign:"center",padding:"50px 20px",color:"#bbb",background:"#fff",borderRadius:14,border:"1.5px dashed #E5E5E5"}}>
                  <div style={{fontSize:36,marginBottom:10}}>🏫</div>
                  <div style={{fontSize:14}}>No institutions yet. Create one below.</div>
                </div>
              )}
              {institutions.map((inst,i)=>(
                <div key={inst.id} style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1.5px solid #EFEFEF",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:40,height:40,borderRadius:10,background:["#FF6B6B","#4ECDC4","#FFD93D","#6BCB77","#845EC2","#FF9671","#0089BA","#F9A8D4"][i%8],display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏫</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:15,color:"#1A1A1A"}}>{inst.name}</div>
                      <div style={{fontSize:12,color:"#888",marginTop:2}}>👤 Admin: {inst.adminName} · {inst.adminEmail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={()=>setView("createInst")}
                style={{background:BG,color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontSize:13,cursor:"pointer",fontFamily:"monospace",letterSpacing:0.5}}>
                + New Institution
              </button>
              <button onClick={()=>setView("transfer")}
                style={{background:"#fff",color:"#666",border:"1.5px solid #E5E5E5",borderRadius:10,padding:"11px 20px",fontSize:13,cursor:"pointer",fontFamily:"monospace",letterSpacing:0.5}}>
                Transfer Super Admin
              </button>
            </div>
          </>
        )}

        {/* View: create institution */}
        {view==="createInst"&&(
          <div style={{background:"#fff",borderRadius:16,padding:"22px 20px",border:"1.5px solid #EFEFEF"}}>
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",fontSize:13,color:"#aaa",cursor:"pointer",fontFamily:"monospace",marginBottom:14,padding:0}}>← Back</button>
            <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:"#1A1A1A"}}>New Institution</h2>
            <p style={{margin:"0 0 20px",fontSize:13,color:"#888"}}>The assigned admin must already have an account in the system.</p>

            <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>INSTITUTION NAME</label>
            <input value={instName} onChange={e=>setInstName(e.target.value)} placeholder="e.g. Delhi Public School" style={inp}/>

            <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4,marginTop:4}}>ADMIN'S EMAIL</label>
            <input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} type="email" placeholder="admin@school.com" style={inp}/>

            <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4,marginTop:4}}>ADMIN'S NAME (for display)</label>
            <input value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="e.g. Priya Sharma" style={inp}/>

            {createError&&<div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:12}}>{createError}</div>}

            <button onClick={handleCreateInstitution} disabled={createLoading}
              style={{background:createLoading?"#D5D5D5":BG,color:"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontSize:13,cursor:createLoading?"not-allowed":"pointer",fontFamily:"monospace",letterSpacing:1}}>
              {createLoading?"Creating…":"CREATE INSTITUTION"}
            </button>
          </div>
        )}

        {/* View: transfer super admin */}
        {view==="transfer"&&(
          <div style={{background:"#fff",borderRadius:16,padding:"22px 20px",border:"1.5px solid #EFEFEF"}}>
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",fontSize:13,color:"#aaa",cursor:"pointer",fontFamily:"monospace",marginBottom:14,padding:0}}>← Back</button>
            <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:"#1A1A1A"}}>Transfer Super Admin</h2>
            <p style={{margin:"0 0 20px",fontSize:13,color:"#888"}}>The new super admin must already have an account. You will be signed out after transfer.</p>

            <div style={{background:"#FEE2E2",borderRadius:10,padding:"10px 14px",marginBottom:18,fontSize:13,color:"#991B1B"}}>
              ⚠ This action cannot be undone without the new super admin's cooperation.
            </div>

            <label style={{fontSize:10,color:"#aaa",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>NEW SUPER ADMIN EMAIL</label>
            <input value={transferEmail} onChange={e=>setTransferEmail(e.target.value)} type="email" placeholder="new-admin@example.com" style={inp}/>

            {transferError&&<div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:12}}>{transferError}</div>}

            <button onClick={handleTransfer} disabled={transferLoading}
              style={{background:transferLoading?"#D5D5D5":"#DC2626",color:"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontSize:13,cursor:transferLoading?"not-allowed":"pointer",fontFamily:"monospace",letterSpacing:1}}>
              {transferLoading?"Transferring…":"TRANSFER & SIGN OUT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
