import { G } from "../../styles/adminTheme.js";

export function AdminToastBanner({ message }) {
  if(!message) return null;
  return (
    <div style={{position:"fixed",right:18,bottom:18,zIndex:760,background:"#0F1E3D",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"12px 16px",boxShadow:"0 18px 48px rgba(15,23,42,0.28)",fontSize:14,fontWeight:700,fontFamily:G.sans,maxWidth:320}}>
      {message}
    </div>
  );
}
