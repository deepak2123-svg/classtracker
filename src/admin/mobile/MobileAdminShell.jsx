import React from "react";
import { AppIcon } from "../components/common/AppIcon.jsx";
import { G } from "../styles/adminTheme.js";

export const ADMIN_MOBILE_BOTTOM_SPACE = "calc(96px + env(safe-area-inset-bottom, 0px))";

export const adminMobileShellStyle = {
  minHeight: "100svh",
  width: "100%",
  overflowX: "hidden",
  background: "#F4F7FB",
  fontFamily: G.sans,
  paddingBottom: ADMIN_MOBILE_BOTTOM_SPACE,
};

export const adminMobileContentStyle = {
  padding: "10px 12px 18px",
};

export function AdminMobileMotionStyles() {
  return (
    <style>{`
      .admin-mobile-touch{
        -webkit-tap-highlight-color: transparent;
        transition: transform 120ms cubic-bezier(.22,.8,.24,1), box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease;
        will-change: transform, opacity;
      }
      .admin-mobile-touch:active{
        transform: translateY(1px) scale(0.989);
      }
      .admin-mobile-card-press:active{
        transform: translateY(1px) scale(0.993);
      }
    `}</style>
  );
}

export function AdminMobileTopBar({
  title,
  subtitle,
  eyebrow = "Ledgr Admin",
  action = null,
  secondaryAction = null,
}) {
  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 80,
      padding: "10px 12px 9px",
      background: "rgba(244,247,251,0.96)",
      borderBottom: `1px solid ${G.border}`,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        minWidth: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: G.blueV,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 19,
            fontWeight: 900,
            fontFamily: G.display,
            flexShrink: 0,
          }}>
            L
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 10.5,
              fontWeight: 900,
              color: G.textL,
              fontFamily: G.mono,
              letterSpacing: 1,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {eyebrow}
            </div>
            <div style={{
              fontSize: 19,
              fontWeight: 900,
              color: G.text,
              fontFamily: G.display,
              lineHeight: 1.05,
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {title}
            </div>
            {subtitle&&(
              <div style={{
                fontSize: 11.5,
                color: G.textM,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {secondaryAction&&<AdminMobileHeaderButton {...secondaryAction} />}
          {action&&<AdminMobileHeaderButton {...action} />}
        </div>
      </div>
    </header>
  );
}

function AdminMobileHeaderButton({ label, icon, onClick, tone = "light", title = label }) {
  const dark = tone === "dark";
  return (
    <button
      type="button"
      className="admin-mobile-touch"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        minWidth: 38,
        height: 38,
        borderRadius: 13,
        border: dark ? "1px solid transparent" : `1px solid ${G.border}`,
        background: dark ? G.navy : "#FFFFFF",
        color: dark ? "#FFFFFF" : G.text,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: label ? "0 10px" : 0,
        fontSize: 12,
        fontWeight: 850,
        fontFamily: G.sans,
        cursor: "pointer",
        boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
      }}>
      {icon&&<AppIcon icon={icon} size={16} color={dark ? "#FFFFFF" : G.textS} />}
      {label&&<span>{label}</span>}
    </button>
  );
}

export function AdminMobileBottomNav({ items, activeKey, reduceEffects = false }) {
  return (
    <nav style={{
      position: "fixed",
      left: 10,
      right: 10,
      bottom: "max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px))",
      zIndex: 150,
      pointerEvents: "none",
    }}>
      <div style={{
        background: "#071225",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: "7px 8px",
        boxShadow: reduceEffects ? "none" : "0 18px 36px rgba(7,18,37,0.22)",
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: 5,
        pointerEvents: "auto",
      }}>
        {items.map(item => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className="admin-mobile-touch"
              onClick={item.onClick}
              style={{
                minHeight: 52,
                borderRadius: 17,
                border: "none",
                background: active ? "#FFFFFF" : "transparent",
                color: active ? G.blue : "#93A4BA",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "0 4px",
                cursor: "pointer",
                fontFamily: G.sans,
                fontSize: 10.8,
                fontWeight: active ? 900 : 800,
              }}>
              {item.icon&&<AppIcon icon={item.icon} size={19} color={active ? G.blue : "#93A4BA"} />}
              <span style={{ lineHeight: 1.05, whiteSpace: "normal", textAlign: "center" }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminMobileCard({ children, style = {}, onClick = null }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick || undefined}
      className={onClick ? "admin-mobile-touch admin-mobile-card-press" : undefined}
      style={{
        width: "100%",
        textAlign: "left",
        background: "#FFFFFF",
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        padding: 13,
        boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
        fontFamily: G.sans,
        color: G.text,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}>
      {children}
    </Component>
  );
}

export function AdminMobileEmptyState({
  title,
  body,
  action = null,
  icon = null,
}) {
  return (
    <AdminMobileCard style={{
      minHeight: 150,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "22px 16px",
      boxShadow: "none",
    }}>
      <div style={{ maxWidth: 280 }}>
        {icon&&(
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "#EEF4FF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}>
            <AppIcon icon={icon} size={19} color={G.blue} />
          </div>
        )}
        <div style={{
          fontSize: 17,
          fontWeight: 950,
          color: G.text,
          fontFamily: G.display,
          lineHeight: 1.12,
        }}>
          {title}
        </div>
        {body&&(
          <div style={{
            fontSize: 12.5,
            color: G.textM,
            lineHeight: 1.5,
            marginTop: 7,
          }}>
            {body}
          </div>
        )}
        {action&&(
          <div style={{ marginTop: 13 }}>
            {action}
          </div>
        )}
      </div>
    </AdminMobileCard>
  );
}

export function AdminMobileFilterChips({ items, activeKey, onChange }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      padding: "2px 1px",
    }}>
      {items.map(item => {
        const active = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className="admin-mobile-touch"
            onClick={() => onChange?.(item.key)}
            style={{
              minHeight: 34,
              borderRadius: 999,
              border: `1px solid ${active ? G.navy : G.border}`,
              background: active ? G.navy : "#FFFFFF",
              color: active ? "#FFFFFF" : G.textM,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 900,
              fontFamily: G.sans,
              whiteSpace: "nowrap",
              cursor: "pointer",
              flex: "0 0 auto",
            }}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminMobileMetricGrid({ items, columns = 2 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 9,
    }}>
      {items.map(item => (
        <AdminMobileCard key={item.label} style={{ padding: "10px 11px", borderRadius: 14, boxShadow: "none" }}>
          <div style={{
            fontSize: 10,
            color: item.color || G.textL,
            fontFamily: G.mono,
            fontWeight: 900,
            letterSpacing: 0.65,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {item.label}
          </div>
          <div style={{
            fontSize: 23,
            fontWeight: 950,
            color: G.text,
            fontFamily: G.display,
            lineHeight: 1,
            marginTop: 8,
          }}>
            {item.value}
          </div>
          {item.hint&&(
            <div style={{ fontSize: 11.5, color: G.textM, lineHeight: 1.35, marginTop: 6 }}>
              {item.hint}
            </div>
          )}
        </AdminMobileCard>
      ))}
    </div>
  );
}

export function AdminMobileActionSheet({
  open,
  title,
  subtitle = "",
  actions = [],
  onClose,
}) {
  if(!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        background: "rgba(7,18,37,0.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px",
        boxSizing: "border-box",
      }}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={event => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#FFFFFF",
          border: `1px solid ${G.border}`,
          borderRadius: 22,
          boxShadow: "0 24px 64px rgba(7,18,37,0.24)",
          padding: "15px 14px max(14px, env(safe-area-inset-bottom, 0px))",
        }}>
        <div style={{ padding: "0 3px 11px" }}>
          <div style={{
            fontSize: 18,
            fontWeight: 950,
            color: G.text,
            fontFamily: G.display,
            lineHeight: 1.1,
          }}>
            {title}
          </div>
          {subtitle&&(
            <div style={{
              fontSize: 12.5,
              color: G.textM,
              lineHeight: 1.45,
              marginTop: 5,
            }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {actions.filter(Boolean).map(action => {
            const danger = action.tone === "danger";
            return (
              <button
                key={action.key || action.label}
                type="button"
                className="admin-mobile-touch"
                disabled={action.disabled}
                onClick={() => {
                  onClose?.();
                  action.onClick?.();
                }}
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  border: `1px solid ${danger ? "#FECACA" : G.border}`,
                  background: danger ? "#FFF1F2" : "#F8FAFC",
                  color: danger ? G.red : G.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 12px",
                  textAlign: "left",
                  fontSize: 13.5,
                  fontWeight: 900,
                  fontFamily: G.sans,
                  cursor: action.disabled ? "not-allowed" : "pointer",
                  opacity: action.disabled ? 0.58 : 1,
                }}>
                {action.icon&&<AppIcon icon={action.icon} size={17} color={danger ? G.red : G.textS} />}
                <span style={{ flex: 1, minWidth: 0 }}>{action.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="admin-mobile-touch"
            onClick={onClose}
            style={{
              minHeight: 46,
              borderRadius: 14,
              border: `1px solid ${G.border}`,
              background: "#FFFFFF",
              color: G.textM,
              fontSize: 13,
              fontWeight: 900,
              fontFamily: G.sans,
              cursor: "pointer",
            }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminMobileToolGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          className="admin-mobile-touch admin-mobile-card-press"
          onClick={item.onClick}
          style={{
            minHeight: 104,
            background: "#FFFFFF",
            border: `1px solid ${G.border}`,
            borderRadius: 16,
            padding: "12px 12px 11px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 10px 22px rgba(15,23,42,0.05)",
            fontFamily: G.sans,
          }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: item.tone === "danger" ? "#FFF1F2" : "#EEF4FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <AppIcon icon={item.icon} size={17} color={item.tone === "danger" ? G.red : G.blue} />
          </div>
          <div style={{ minWidth: 0, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: G.text, lineHeight: 1.15 }}>
                {item.title}
              </span>
              {item.count!=null&&(
                <span style={{
                  background: "#F8FAFC",
                  border: `1px solid ${G.border}`,
                  borderRadius: 999,
                  padding: "3px 7px",
                  fontSize: 10,
                  fontWeight: 900,
                  color: G.textL,
                  fontFamily: G.mono,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  {item.count}
                </span>
              )}
            </div>
            {item.subtitle&&(
              <div style={{ fontSize: 11.5, color: G.textM, lineHeight: 1.4, marginTop: 5 }}>
                {item.subtitle}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
