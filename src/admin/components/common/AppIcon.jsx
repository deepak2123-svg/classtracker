import { APP_ICON_STROKE } from "../../styles/adminTheme.js";

export function AppIcon({ icon, size = 18, color = "currentColor", stroke = APP_ICON_STROKE, style = {} }){
  if(!icon) return null;
  if(typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon)){
    const Icon = icon;
    return <Icon size={size} color={color} stroke={stroke} style={{display:"block",flexShrink:0,...style}} />;
  }
  return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",lineHeight:1,...style}}>{icon}</span>;
}
