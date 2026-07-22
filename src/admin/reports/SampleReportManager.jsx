import React, { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { IconDownload, IconExternalLink, IconFileText, IconTrash, IconUpload } from "@tabler/icons-react";
import { auth, db, storage } from "../../firebase";
import { AppIcon } from "../components/common/AppIcon.jsx";
import { G } from "../styles/adminTheme.js";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function SampleReportManager({ compact = false }) {
  const [reports, setReports] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => onSnapshot(
    query(collection(db, "sampleReports"), orderBy("createdAt", "desc")),
    snapshot => setReports(snapshot.docs.map(item => ({ id:item.id, ...item.data() }))),
    () => setError("Could not load the published sample reports."),
  ), []);

  const validate = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("Add a title for this sample report.");
    if (cleanTitle.length > 120) throw new Error("Keep the title within 120 characters.");
    if (!file || file.size <= 0) throw new Error("Choose a non-empty PDF file.");
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) throw new Error("Only PDF files can be published.");
    if (file.size > MAX_PDF_BYTES) throw new Error("The PDF must be 20 MB or smaller.");
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...signature) !== "%PDF-") throw new Error("This file is not a valid PDF.");
    return cleanTitle;
  };

  const publish = async event => {
    event.preventDefault();
    if (busy) return;
    setError(""); setNotice("");
    let cleanTitle;
    try { cleanTitle = await validate(); } catch (validationError) { setError(validationError.message); return; }
    const user = auth.currentUser;
    if (!user) { setError("Sign in again before publishing a sample."); return; }
    const reportRef = doc(collection(db, "sampleReports"));
    const storagePath = `sampleReports/${reportRef.id}.pdf`;
    const storageRef = ref(storage, storagePath);
    setBusy(true);
    try {
      await uploadBytes(storageRef, file, { contentType:"application/pdf", customMetadata:{ originalName:file.name } });
      const downloadUrl = await getDownloadURL(storageRef);
      try {
        await setDoc(reportRef, { title:cleanTitle, storagePath, downloadUrl, createdAt:serverTimestamp(), createdBy:user.uid });
      } catch (metadataError) {
        await deleteObject(storageRef).catch(() => {});
        throw metadataError;
      }
      setTitle(""); setFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Sample report published on ledgrclasses.com.");
    } catch (uploadError) {
      setError(uploadError?.message || "Could not publish the sample report.");
    } finally { setBusy(false); }
  };

  const remove = async report => {
    if (busy || !window.confirm(`Delete “${report.title}” from the public website?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await deleteObject(ref(storage, report.storagePath));
      await deleteDoc(doc(db, "sampleReports", report.id));
      setNotice("Sample report deleted.");
    } catch (deleteError) {
      setError(deleteError?.message || "Could not delete the sample report.");
    } finally { setBusy(false); }
  };

  const buttonStyle = {minHeight:38,borderRadius:11,border:`1px solid ${G.border}`,background:"#FFFFFF",color:G.text,fontSize:12,fontWeight:800,padding:"0 12px",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,textDecoration:"none",cursor:"pointer"};
  return (
    <section style={{marginTop:compact ? 10 : 16,background:"#FFFFFF",border:`1px solid ${G.border}`,borderRadius:compact ? 16 : 20,padding:compact ? 13 : 16,boxShadow:compact ? "none" : "0 12px 30px rgba(15,23,42,0.06)"}} aria-labelledby="sample-report-manager-title">
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{width:38,height:38,borderRadius:12,background:"#EEF4FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><AppIcon icon={IconFileText} size={18} color={G.blue}/></div>
        <div><div style={{fontSize:11,color:G.textL,fontFamily:G.mono,letterSpacing:1,textTransform:"uppercase"}}>Website samples</div><h3 id="sample-report-manager-title" style={{fontSize:17,fontWeight:850,color:G.text,margin:"4px 0 0"}}>Publish a sample Ledgr Report</h3><p style={{fontSize:12.5,color:G.textM,lineHeight:1.5,margin:"5px 0 0"}}>PDFs publish immediately and are visible to everyone on ledgrclasses.com.</p></div>
      </div>
      <form onSubmit={publish} style={{display:"grid",gridTemplateColumns:compact ? "1fr" : "minmax(180px,1fr) minmax(220px,1fr) auto",gap:9,marginTop:14}}>
        <input aria-label="Sample report title" value={title} onChange={event=>setTitle(event.target.value)} disabled={busy} maxLength={120} placeholder="Sample title" style={{minHeight:42,border:`1px solid ${G.border}`,borderRadius:11,padding:"0 12px",font: "inherit"}} />
        <input ref={fileInputRef} aria-label="Sample report PDF" type="file" accept="application/pdf,.pdf" onChange={event=>setFile(event.target.files?.[0] || null)} disabled={busy} style={{minHeight:42,border:`1px solid ${G.border}`,borderRadius:11,padding:"8px",fontSize:12,color:G.textM}} />
        <button type="submit" disabled={busy} style={{...buttonStyle,background:G.navy,color:"#FFFFFF",borderColor:G.navy,opacity:busy?0.65:1}}><AppIcon icon={IconUpload} size={15} color="#FFFFFF"/>{busy ? "Publishing…" : "Publish PDF"}</button>
      </form>
      {error&&<div role="alert" style={{fontSize:12,color:G.red,marginTop:9}}>{error}</div>}
      {notice&&<div role="status" style={{fontSize:12,color:"#15803D",marginTop:9}}>{notice}</div>}
      <div style={{display:"grid",gap:8,marginTop:reports.length ? 14 : 10}}>
        {reports.length ? reports.map(report => <div key={report.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,borderTop:`1px solid ${G.border}`,paddingTop:9}}><div style={{fontSize:13,fontWeight:750,color:G.text,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{report.title}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}><a href={report.downloadUrl} target="_blank" rel="noreferrer" style={buttonStyle}><AppIcon icon={IconExternalLink} size={14} color={G.text}/>Open</a><a href={report.downloadUrl} download style={buttonStyle}><AppIcon icon={IconDownload} size={14} color={G.text}/>Download</a><button type="button" onClick={()=>remove(report)} disabled={busy} style={{...buttonStyle,color:G.red}}><AppIcon icon={IconTrash} size={14} color={G.red}/>Delete</button></div></div>) : <div style={{fontSize:12,color:G.textL}}>No public samples yet.</div>}
      </div>
    </section>
  );
}
