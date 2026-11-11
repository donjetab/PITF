import { AlertTriangle, CircleHelp, Info } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const AdminDialogContext = createContext(null);

export function AdminDialogProvider({ children }) {
  const [request, setRequest] = useState(null);
  const inputRef = useRef(null);
  const open = useCallback((options) => new Promise((resolve) => setRequest({ tone: "default", confirmLabel: options.kind === "notice" ? "OK" : "Continue", cancelLabel: "Cancel", ...options, value: options.initialValue || "", resolve })), []);
  const dialog = useMemo(() => ({
    confirm: (options) => open({ ...options, kind: "confirm" }),
    notice: (options) => open({ ...options, kind: "notice" }),
    prompt: (options) => open({ ...options, kind: "prompt" }),
  }), [open]);
  const settle = useCallback((value) => {
    if (!request) return;
    request.resolve(value);
    setRequest(null);
  }, [request]);

  useEffect(() => {
    if (!request) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") settle(request.kind === "confirm" ? false : request.kind === "prompt" ? null : undefined);
    };
    document.addEventListener("keydown", onKeyDown);
    if (request.kind === "prompt") window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, settle]);

  const Icon = request?.tone === "danger" ? AlertTriangle : request?.kind === "confirm" ? CircleHelp : Info;
  const dismissValue = request?.kind === "confirm" ? false : request?.kind === "prompt" ? null : undefined;
  return <AdminDialogContext.Provider value={dialog}>
    {children}
    {request && <div className="admin-modal admin-system-dialog-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) settle(dismissValue); }}>
      <form className={`admin-modal__panel admin-system-dialog is-${request.tone}`} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" aria-describedby="admin-dialog-message" onSubmit={(event) => { event.preventDefault(); settle(request.kind === "prompt" ? request.value : true); }}>
        <header><span className="admin-system-dialog__icon" aria-hidden="true"><Icon size={20} /></span><div><span className="admin-kicker">{request.tone === "danger" ? "Please confirm" : request.kind === "prompt" ? "Information required" : "Notice"}</span><h2 id="admin-dialog-title">{request.title}</h2></div><button type="button" className="admin-iconbutton" onClick={() => settle(dismissValue)} aria-label="Close dialog">×</button></header>
        <div className="admin-editor__body">{request.message && <p id="admin-dialog-message" className="admin-system-dialog__message">{request.message}</p>}{request.kind === "prompt" && <label className="admin-system-dialog__field">{request.label || "Value"}<input ref={inputRef} type={request.inputType || "text"} value={request.value} placeholder={request.placeholder || ""} minLength={request.minLength} required={request.required !== false} onChange={(event) => setRequest((current) => ({ ...current, value: event.target.value }))} /></label>}</div>
        <footer>{request.kind !== "notice" && <button type="button" className="admin-button" onClick={() => settle(dismissValue)}>{request.cancelLabel}</button>}<button type="submit" className={`admin-button ${request.tone === "danger" ? "admin-button--danger" : "admin-button--primary"}`}>{request.kind === "notice" ? request.confirmLabel || "OK" : request.confirmLabel}</button></footer>
      </form>
    </div>}
  </AdminDialogContext.Provider>;
}

export function useAdminDialog() {
  const context = useContext(AdminDialogContext);
  if (!context) throw new Error("useAdminDialog must be used inside AdminDialogProvider");
  return context;
}
