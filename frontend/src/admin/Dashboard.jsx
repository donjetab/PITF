import { useEffect, useState } from "react";
import { adminApi } from "./adminApi";
import { PageHeader, StatusBadge } from "./ResourcePage";

const cards = [["Editions", "editions", "/admin/editions"], ["News articles", "news", "/admin/news"], ["Managed media", "media", "/admin/media"], ["Program items", "program", "/admin/program"], ["Festival days", "days", "/admin/days"], ["Galleries", "galleries", "/admin/galleries"], ["Sponsors", "sponsors", "/admin/sponsors"]];
export function Dashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { adminApi.dashboard().then(setData).catch((e) => setError(e.message)); }, []);
  return <section className="admin-page"><PageHeader kicker="Overview" title="Dashboard" description="A live view of the PITF content and media foundation." action={<a className="admin-button admin-button--primary" href="/admin/news">＋ Create news</a>} />
    {error && <div className="admin-alert admin-alert--error">{error}</div>}
    <div className="admin-statgrid">{cards.map(([label, key, link]) => <a href={link} key={key}><span>{label}</span><b>{data?.[key] ?? "—"}</b><small>Manage →</small></a>)}</div>
    <div className="admin-dashboard-grid"><section className="admin-card"><header className="admin-card__head"><div><h2>Recent news</h2><p>Latest articles across all editions.</p></div><a href="/admin/news">View all</a></header><div className="admin-recent">{data?.recentNews?.map((item) => <a href="/admin/news" key={item.id}><div><b>{item.slug}</b><small>{item.date}</small></div><StatusBadge status={item.status} /></a>) || <div className="admin-empty">Loading…</div>}</div></section><section className="admin-card admin-quick"><header className="admin-card__head"><div><h2>Quick actions</h2><p>Common editorial workflows.</p></div></header><a href="/admin/homepage">Configure homepage <span>→</span></a><a href="/admin/media">Upload media <span>→</span></a><a href="/admin/editions">Manage current edition <span>→</span></a><a href="/admin/settings">Update contact details <span>→</span></a><div className="admin-callout"><div><b>{data?.drafts ?? "—"} draft items</b><p>Review before publishing.</p></div></div></section></div>
  </section>;
}
