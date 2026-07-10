import { IconSend } from "@tabler/icons-react";
import { AppIcon } from "../components/common/AppIcon.jsx";
import { G } from "../styles/adminTheme.js";

export function FeedbackInboxModal({
  threads,
  selectedUid,
  messages,
  reply,
  busy,
  onSelect,
  onReplyChange,
  onSend,
  onToggleResolved,
  onClose,
}){
  const selected = threads.find(item=>item.id===selectedUid) || null;
  const fmt = value => value
    ? new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(value))
    : "";
  return (
    <div className="feedback-inbox-overlay" style={{position:"fixed",inset:0,zIndex:750,background:"rgba(5,12,27,0.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(5px)"}}>
      <style>{`
        @media (max-width: 700px) {
          .feedback-inbox-overlay { padding: 0 !important; align-items: stretch !important; justify-content: stretch !important; }
          .feedback-inbox-panel { width: 100% !important; height: 100dvh !important; max-height: 100dvh !important; border-radius: 0 !important; border: 0 !important; }
          .feedback-inbox-grid { grid-template-columns: 1fr !important; grid-template-rows: minmax(150px, 34%) minmax(0, 66%); }
          .feedback-thread-list { border-right: 0 !important; border-bottom: 1px solid ${G.border}; }
        }
      `}</style>
      <div className="feedback-inbox-panel" style={{width:"min(980px,100%)",height:"min(720px,calc(100vh - 32px))",background:G.surface,borderRadius:20,border:`1px solid ${G.border}`,boxShadow:"0 28px 80px rgba(0,0,0,0.34)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"16px 18px",borderBottom:`1px solid ${G.border}`}}>
          <div>
            <div style={{fontFamily:G.display,fontSize:20,fontWeight:800,color:G.text}}>Teacher feedback</div>
            <div style={{fontSize:12.5,color:G.textM,marginTop:3}}>Issues, feedback, and replies in one conversation per teacher.</div>
          </div>
          <button onClick={onClose} aria-label="Close feedback inbox" style={{width:38,height:38,borderRadius:12,border:`1px solid ${G.border}`,background:G.bg,color:G.text,fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div className="feedback-inbox-grid" style={{display:"grid",gridTemplateColumns:"minmax(240px,34%) minmax(0,1fr)",flex:1,minHeight:0}}>
          <div className="feedback-thread-list" style={{borderRight:`1px solid ${G.border}`,overflowY:"auto",background:G.bg,padding:10}}>
            {threads.length===0&&(
              <div style={{padding:"38px 18px",textAlign:"center",color:G.textM,fontSize:13,lineHeight:1.6}}>No teacher feedback has arrived yet.</div>
            )}
            {threads.map(thread=>{
              const active=thread.id===selectedUid;
              const unread=Number(thread.unreadByAdmin||0);
              return (
                <button key={thread.id} onClick={()=>onSelect(thread.id)} style={{width:"100%",border:active?`1px solid ${G.blueV}`:`1px solid ${G.border}`,background:active?G.blueL:G.surface,borderRadius:14,padding:"12px 13px",marginBottom:8,textAlign:"left",cursor:"pointer",fontFamily:G.sans}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontWeight:800,fontSize:13.5,color:G.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{thread.teacherName||"Teacher"}</div>
                    {unread>0&&<span style={{minWidth:22,height:22,borderRadius:999,background:G.blue,color:"#fff",fontSize:10.5,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 6px"}}>{unread>9?"9+":unread}</span>}
                  </div>
                  <div style={{fontSize:11.5,color:G.textM,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{thread.teacherEmail||thread.institutes?.join(", ")||"Teacher account"}</div>
                  <div style={{fontSize:12,color:G.textS,marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{thread.lastMessage||"Conversation started"}</div>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:8,fontSize:10.5,color:G.textL}}>
                    <span>{fmt(thread.updatedAt)}</span>
                    <span style={{fontWeight:700,color:thread.status==="resolved"?"#15803D":G.amber}}>{thread.status==="resolved"?"Resolved":"Open"}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",flexDirection:"column",minWidth:0,minHeight:0}}>
            {!selected?(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:30,textAlign:"center",color:G.textM}}>
                Select a teacher conversation.
              </div>
            ):(
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"13px 16px",borderBottom:`1px solid ${G.border}`}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,color:G.text,fontSize:14.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.teacherName||"Teacher"}</div>
                    <div style={{fontSize:11.5,color:G.textM,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.institutes?.join(", ")||selected.teacherEmail||""}</div>
                  </div>
                  <button disabled={busy} onClick={()=>onToggleResolved(selected)} style={{border:`1px solid ${selected.status==="resolved"?"#86EFAC":G.border}`,background:selected.status==="resolved"?"#F0FDF4":G.bg,color:selected.status==="resolved"?"#15803D":G.textS,borderRadius:10,padding:"7px 10px",fontSize:11.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                    {selected.status==="resolved"?"Reopen":"Mark resolved"}
                  </button>
                </div>
                <div style={{flex:1,overflowY:"auto",padding:16,background:"#F8FAFC"}}>
                  {messages.length===0&&<div style={{textAlign:"center",color:G.textM,fontSize:13,padding:30}}>Loading conversation…</div>}
                  {messages.map(message=>{
                    const admin=message.senderRole==="admin";
                    return (
                      <div key={message.id} style={{display:"flex",justifyContent:admin?"flex-end":"flex-start",marginBottom:10}}>
                        <div style={{maxWidth:"78%",background:admin?G.navy:"#FFFFFF",color:admin?"#FFFFFF":G.text,border:admin?"none":`1px solid ${G.border}`,borderRadius:admin?"17px 17px 5px 17px":"17px 17px 17px 5px",padding:"10px 12px"}}>
                          <div style={{fontSize:10.5,fontWeight:700,opacity:0.68,marginBottom:4}}>{admin?"You":message.senderName||selected.teacherName||"Teacher"}</div>
                          <div style={{fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body}</div>
                          <div style={{fontSize:10,opacity:0.58,marginTop:6}}>{fmt(message.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={event=>{event.preventDefault();onSend();}} style={{padding:13,borderTop:`1px solid ${G.border}`,background:G.surface}}>
                  <textarea value={reply} onChange={event=>onReplyChange(event.target.value.slice(0,2000))} rows={3} placeholder="Reply to this teacher…" style={{width:"100%",resize:"none",border:`1px solid ${G.borderM}`,borderRadius:12,padding:"10px 12px",fontFamily:G.sans,fontSize:13,color:G.text,outline:"none",boxSizing:"border-box"}}/>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:8}}>
                    <span style={{fontSize:10.5,color:G.textL}}>{reply.length}/2000</span>
                    <button type="submit" disabled={busy||!reply.trim()} style={{display:"inline-flex",alignItems:"center",gap:7,border:0,borderRadius:10,padding:"9px 14px",background:busy||!reply.trim()?G.borderM:G.blue,color:"#fff",fontWeight:800,fontSize:12.5,cursor:busy?"wait":"pointer"}}>
                      <AppIcon icon={IconSend} size={15} color="#fff"/>{busy?"Sending…":"Send reply"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
