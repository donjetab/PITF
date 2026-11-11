import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuth";
import { BrandMark } from "../components/BrandMark";

export function AdminLogin() {
  const auth = useAdminAuth(); const navigate = useNavigate(); const location = useLocation();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to="/admin" replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await auth.login(email, password); navigate(location.state?.from || "/admin", { replace: true }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="admin-login">
    <section className="admin-login__panel">
      <BrandMark />
      <div><span className="admin-kicker">Content management</span><h1>PITF Admin</h1><p>Sign in to manage festival content, editions, news and media.</p></div>
      <form onSubmit={submit} className="admin-form">
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="admin-alert admin-alert--error">{error}</div>}
        <button className="admin-button admin-button--primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <a className="admin-login__back" href="/">← Back to public website</a>
    </section>
  </main>;
}
