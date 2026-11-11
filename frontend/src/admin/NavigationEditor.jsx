import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Plus, Trash2 } from "lucide-react";
import { adminApi } from "./adminApi";
import { PageHeader } from "./ResourcePage";
import { contentService } from "../services/contentService";

const languages = ["sq", "en"];
const emptyTranslations = () => ({ sq: {}, en: {}, bs: {} });
const pageOptions = [
  { label: "Home", url: "/", key: "home" },
  { label: "About", url: "/about", key: "about" },
  { label: "Editions", url: "/editions", key: "editions" },
  { label: "News", url: "/news", key: "news" },
  { label: "Contact", url: "/contact", key: "contact" },
];

function navigationItem(item, index) {
  return {
    id: item?.id || null,
    removed: false,
    payload: {
      values: { key: item?.values?.key || "", url: item?.values?.url || "/", target: item?.values?.target || "_self", parentId: item?.values?.parentId || null, status: item?.values?.status || "Published", publishedAt: item?.values?.publishedAt || null, order: index },
      translations: { ...emptyTranslations(), ...(item?.translations || {}) }, mediaIds: [], editionIds: [], links: [], selections: [], uploadedMediaIds: [],
    },
  };
}

export function NavigationEditor() {
  const [items, setItems] = useState(null); const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function load() {
    setError("");
    try { const result = await adminApi.list("navigation"); setItems(result.items.map(navigationItem)); }
    catch (reason) { setError(reason.message); }
  }
  useEffect(() => { load(); }, []);
  if (!items) return <section className="admin-page"><PageHeader kicker="Website" title="Navigation" description="Loading navigation..." />{error && <div className="admin-alert admin-alert--error">{error}</div>}</section>;
  const visible = items.filter((item) => !item.removed);
  function patch(item, values) { setItems((current) => current.map((entry) => entry === item ? { ...entry, payload: { ...entry.payload, values: { ...entry.payload.values, ...values } } } : entry)); }
  function label(item) { return item.payload.translations?.[language]?.label || ""; }
  function selectedPage(item) { return pageOptions.find((page) => page.url === item.payload.values.url)?.url || "custom"; }
  function choosePage(item, value) {
    if (value === "custom") { patch(item, { url: item.payload.values.url.startsWith("http") ? item.payload.values.url : "https://", key: item.payload.values.key || `link-${visible.indexOf(item) + 1}` }); return; }
    const page = pageOptions.find((entry) => entry.url === value);
    if (page) patch(item, { url: page.url, key: page.key, target: "_self" });
  }
  function setLabel(item, value) { setItems((current) => current.map((entry) => entry === item ? { ...entry, payload: { ...entry.payload, translations: { ...entry.payload.translations, [language]: { ...(entry.payload.translations[language] || {}), label: value } } } } : entry)); }
  function move(item, direction) {
    setItems((current) => { const active = current.filter((entry) => !entry.removed); const from = active.indexOf(item); const to = from + direction; if (to < 0 || to >= active.length) return current; const swap = active[to]; const first = current.indexOf(item); const second = current.indexOf(swap); const next = [...current]; [next[first], next[second]] = [next[second], next[first]]; return next; });
  }
  function remove(item) { if (!item.id) setItems((current) => current.filter((entry) => entry !== item)); else setItems((current) => current.map((entry) => entry === item ? { ...entry, removed: true } : entry)); }
  function add() { setItems((current) => { const index = current.filter((item) => !item.removed).length; const item = navigationItem(null, index); item.payload.values = { ...item.payload.values, key: `link-${index + 1}`, url: "https://", target: "_blank" }; return [...current, item]; }); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      for (const item of items.filter((entry) => entry.removed && entry.id)) await adminApi.remove("navigation", item.id);
      const active = items.filter((entry) => !entry.removed);
      for (let index = 0; index < active.length; index += 1) await adminApi.save("navigation", { ...active[index], payload: { ...active[index].payload, values: { ...active[index].payload.values, order: index } } });
      contentService.refresh();
      setMessage("Navigation saved and published."); await load();
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  const tabs = <div className="admin-language-tabs">{languages.map((code) => <button type="button" className={language === code ? "is-active" : ""} onClick={() => setLanguage(code)} key={code}>{code.toUpperCase()}</button>)}</div>;
  return <section className="admin-page admin-homepage-editor admin-navigation-editor">
    <PageHeader kicker="Website" title="Navigation" description="Edit, arrange and publish the website menu from one workspace." action={<div className="admin-page-actions"><a className="admin-button" href="/" target="_blank" rel="noreferrer">Open website ↗</a><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save navigation"}</button></div>} />
    {error && <div className="admin-alert admin-alert--error">{error}</div>}{message && <div className="admin-alert admin-homepage-editor__success">{message}</div>}
    <div className="admin-homepage-editor__layout"><main><section className="admin-homepage-editor__section"><header className="admin-homepage-editor__section-head"><span>01</span><div><small>Primary menu</small><h2>Menu items</h2><p>The order below is the order shown in the website header.</p></div>{tabs}</header><div className="admin-navigation-editor__list">{visible.map((item, index) => { const page = selectedPage(item); return <article key={item.id || `new-${index}`}><div className="admin-navigation-editor__order"><GripVertical aria-hidden="true" /><strong>{String(index + 1).padStart(2, "0")}</strong></div><div className={`admin-navigation-editor__fields${page === "custom" ? " has-custom-url" : ""}`}><label>Menu label<input value={label(item)} placeholder={language === "sq" ? "Etiketa e menusë" : "Menu label"} onChange={(event) => setLabel(item, event.target.value)} /></label><label>Website page<select value={page} onChange={(event) => choosePage(item, event.target.value)}>{pageOptions.map((option) => <option value={option.url} key={option.url}>{option.label}</option>)}<option value="custom">Custom or external link</option></select></label>{page === "custom" && <label>External URL<input type="url" value={item.payload.values.url} placeholder="https://example.com" onChange={(event) => patch(item, { url: event.target.value })} /></label>}</div><div className="admin-navigation-editor__options"><label><input type="checkbox" checked={item.payload.values.status === "Published"} onChange={(event) => patch(item, { status: event.target.checked ? "Published" : "Draft" })} /><span>Visible</span></label>{page === "custom" && <label><input type="checkbox" checked={item.payload.values.target === "_blank"} onChange={(event) => patch(item, { target: event.target.checked ? "_blank" : "_self" })} /><span><ExternalLink aria-hidden="true" /> New tab</span></label>}</div><div className="admin-navigation-editor__actions"><button type="button" disabled={index === 0} onClick={() => move(item, -1)} aria-label={`Move ${label(item) || item.payload.values.key} up`} title="Move up"><ArrowUp aria-hidden="true" /></button><button type="button" disabled={index === visible.length - 1} onClick={() => move(item, 1)} aria-label={`Move ${label(item) || item.payload.values.key} down`} title="Move down"><ArrowDown aria-hidden="true" /></button><button type="button" className="is-danger" onClick={() => remove(item)} aria-label={`Remove ${label(item) || item.payload.values.key}`} title="Remove item"><Trash2 aria-hidden="true" /></button></div></article>; })}</div><button type="button" className="admin-navigation-editor__add" onClick={add}><Plus aria-hidden="true" /> Add menu item</button></section></main></div>
    <div className="admin-sticky-save"><span className="is-unsaved">Review the menu, then save all changes together.</span><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save navigation"}</button></div>
  </section>;
}
