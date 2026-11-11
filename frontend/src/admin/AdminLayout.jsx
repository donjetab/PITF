import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminAuth } from "./AdminAuth";
import { AdminDialogProvider } from "./AdminDialog";

const groups = [
  { label: "Overview", items: [["Dashboard", "/admin", "⌂"], ["Homepage", "/admin/homepage", "◇"], ["About", "/admin/about", "i"]] },
  { label: "Festival content", items: [["Editions", "/admin/editions", "10"], ["Program & plays", "/admin/program", "▷"], ["Festival days", "/admin/days", "◫"], ["Awards", "/admin/awards", "★"]] },
  { label: "Publishing", items: [["News", "/admin/news", "N"], ["Galleries", "/admin/galleries", "▧"], ["Media Library", "/admin/media", "▣"]] },
  { label: "Website", items: [["Contact", "/admin/contact", "@"], ["Navigation", "/admin/navigation", "≡"], ["Footer", "/admin/footer", "—"], ["Languages", "/admin/languages", "文", true]] },
];

export function AdminLayout() {
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter(([, , , administratorOnly]) => !administratorOnly || auth.isAdministrator) }));
  const allItems = visibleGroups.flatMap((group) => group.items.map((item) => ({ group: group.label, label: item[0], to: item[1] })));
  const results = useMemo(() => query.trim() ? allItems.filter((item) => `${item.group} ${item.label}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 7) : [], [query, auth.isAdministrator]);
  const current = [...allItems].sort((a, b) => b.to.length - a.to.length).find((item) => item.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(item.to));

  useEffect(() => {
    const close = (event) => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); };
    const escape = (event) => { if (event.key === "Escape") { setProfileOpen(false); setQuery(""); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  function logout() { auth.logout(); navigate("/admin/login", { replace: true }); }
  function go(to) { setQuery(""); setDrawerOpen(false); navigate(to); }

  return <AdminDialogProvider><div className="admin-shell">
    <aside className={`admin-sidebar ${drawerOpen ? "is-open" : ""}`}>
      <div className="admin-sidebar__brand"><img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="PITF" /><div><b>PITF</b><small>Editorial studio</small></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu">×</button></div>
      <nav>{visibleGroups.map((group) => <section className="admin-navgroup" key={group.label}><span>{group.label}</span>{group.items.map(([label, to, icon]) => <NavLink end={to === "/admin"} key={to} to={to} onClick={() => setDrawerOpen(false)}><i>{icon}</i>{label}</NavLink>)}</section>)}</nav>
      {auth.isSuperAdmin && <section className="admin-navgroup admin-navgroup--access"><span>Access</span><NavLink to="/admin/users" onClick={() => setDrawerOpen(false)}><i>♙</i>Admin users</NavLink></section>}
      <div className="admin-sidebar__foot"><span>Prishtina International</span><small>Theatre Festival</small></div>
    </aside>
    {drawerOpen && <button className="admin-sidebar__scrim" onClick={() => setDrawerOpen(false)} aria-label="Close menu" />}
    <div className="admin-workspace">
      <header className="admin-topbar">
        <button className="admin-menu" type="button" onClick={() => setDrawerOpen(true)}>☰</button>
        <div className="admin-global-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a section…" aria-label="Find an admin section" />{results.length > 0 && <div>{results.map((item) => <button type="button" onClick={() => go(item.to)} key={item.to}><span>{item.label}</span><small>{item.group}</small><b>→</b></button>)}</div>}</div>
        <a className="admin-site-link" href="/" target="_blank" rel="noreferrer">Open website <span>↗</span></a>
        <div className="admin-profile-menu" ref={profileRef}>
          <button className="admin-profile" type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}><span>{(auth.user?.displayName || auth.user?.email || "P").slice(0, 2).toUpperCase()}</span><div><strong>{auth.user?.displayName || auth.user?.email}</strong><small>{auth.user?.roles?.join(", ")}</small></div><b className={profileOpen ? "is-open" : ""}>⌄</b></button>
          {profileOpen && <div className="admin-profile-dropdown"><div><strong>Signed in</strong><small>{auth.user?.email}</small></div><button type="button" onClick={logout}><span>Log out</span><b>→</b></button></div>}
        </div>
      </header>
      <div className="admin-breadcrumb"><span>Admin</span><b>/</b>{current?.group && current.group !== "Overview" && <><span>{current.group}</span><b>/</b></>}<strong>{current?.label || "Workspace"}</strong></div>
      <main className="admin-main"><Outlet /></main>
    </div>
  </div></AdminDialogProvider>;
}
