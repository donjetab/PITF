import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { adminApi } from "./adminApi";
import { PageHeader } from "./ResourcePage";
import { contentService } from "../services/contentService";

const languages = ["sq", "en"];
const pageOptions = [
  { label: "Home", url: "/" }, { label: "About", url: "/about" }, { label: "Editions", url: "/editions" },
  { label: "News", url: "/news" }, { label: "Contact", url: "/contact" },
];
const sectionKey = (language) => language === "en" ? "footer.sections" : `footer.sections.${language}`;
const copyrightKey = (language) => language === "en" ? "footer.copyright" : `footer.copyright.${language}`;
const blankItem = () => ({ label: "", url: "", target: "_self" });
const blankSection = () => ({ title: "", items: [] });
const parseSections = (value) => { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.slice(0, 3) : []; } catch { return []; } };

function emptySetting(key, value, valueType = "text") {
  return { id: null, payload: { values: { key, value, valueType, group: "footer", isCritical: false }, translations: { sq: {}, en: {}, bs: {} }, mediaIds: [], editionIds: [], links: [], selections: [], uploadedMediaIds: [] } };
}

function defaultSections(language, navigation, settings) {
  const labels = language === "sq" ? ["Festivali", "Na kontaktoni", "Na ndiqni"] : ["Festival", "Contact us", "Follow us"];
  const navItems = navigation.map((item) => ({ label: item.translations?.[language]?.label || item.translations?.en?.label || item.values.key, url: item.values.url, target: item.values.target || "_self" }));
  return [
    { title: labels[0], items: navItems },
    { title: labels[1], items: [{ label: language === "sq" ? "Faqja e kontaktit" : "Contact page", url: "/contact", target: "_self" }, { label: settings["contact.location"]?.values?.value || "Prishtina, Kosovo", url: "", target: "_self" }] },
    { title: labels[2], items: ["instagram", "facebook", "tiktok"].map((name) => ({ label: name[0].toUpperCase() + name.slice(1), url: settings[`social.${name}`]?.values?.value || "#", target: "_blank" })) },
  ];
}

export function FooterEditor() {
  const [records, setRecords] = useState(null); const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const [settingResult, navigationResult] = await Promise.all([adminApi.list("settings"), adminApi.list("navigation")]);
      const settings = Object.fromEntries(settingResult.items.map((item) => [item.values.key, item])); const next = {};
      languages.forEach((code) => {
        const sectionsKey = sectionKey(code); const copyright = copyrightKey(code);
        const sectionsItem = settings[sectionsKey]; const copyrightItem = settings[copyright];
        next[sectionsKey] = sectionsItem ? { id: sectionsItem.id, payload: { values: { ...sectionsItem.values }, translations: sectionsItem.translations || {}, mediaIds: [], editionIds: [], links: [], selections: [], uploadedMediaIds: [] } } : emptySetting(sectionsKey, JSON.stringify(defaultSections(code, navigationResult.items, settings)), "json");
        next[copyright] = copyrightItem ? { id: copyrightItem.id, payload: { values: { ...copyrightItem.values }, translations: copyrightItem.translations || {}, mediaIds: [], editionIds: [], links: [], selections: [], uploadedMediaIds: [] } } : emptySetting(copyright, code === "sq" ? "© 2026 Prishtina International Theatre Festival. Të gjitha të drejtat e rezervuara." : "© 2026 Prishtina International Theatre Festival. All rights reserved.");
      });
      setRecords(next);
    } catch (reason) { setError(reason.message); }
  }
  useEffect(() => { load(); }, []);
  const sections = records ? [...parseSections(records[sectionKey(language)].payload.values.value), blankSection(), blankSection(), blankSection()].slice(0, 3) : [];
  function writeSections(next) { const key = sectionKey(language); setRecords((current) => ({ ...current, [key]: { ...current[key], payload: { ...current[key].payload, values: { ...current[key].payload.values, value: JSON.stringify(next) } } } })); }
  function updateSection(index, patch) { writeSections(sections.map((section, position) => position === index ? { ...section, ...patch } : section)); }
  function updateItem(sectionIndex, itemIndex, patch) { updateSection(sectionIndex, { items: sections[sectionIndex].items.map((item, position) => position === itemIndex ? { ...item, ...patch } : item) }); }
  function addItem(sectionIndex) { updateSection(sectionIndex, { items: [...sections[sectionIndex].items, blankItem()] }); }
  function removeItem(sectionIndex, itemIndex) { updateSection(sectionIndex, { items: sections[sectionIndex].items.filter((_, position) => position !== itemIndex) }); }
  function moveItem(sectionIndex, itemIndex, direction) { const items = [...sections[sectionIndex].items]; const to = itemIndex + direction; if (to < 0 || to >= items.length) return; [items[itemIndex], items[to]] = [items[to], items[itemIndex]]; updateSection(sectionIndex, { items }); }
  function setCopyright(value) { const key = copyrightKey(language); setRecords((current) => ({ ...current, [key]: { ...current[key], payload: { ...current[key].payload, values: { ...current[key].payload.values, value } } } })); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { for (const record of Object.values(records)) await adminApi.save("settings", record); contentService.refresh(); setMessage("Footer changes saved."); await load(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  if (!records) return <section className="admin-page"><PageHeader kicker="Website" title="Footer" description="Loading footer content..." />{error && <div className="admin-alert admin-alert--error">{error}</div>}</section>;
  const tabs = <div className="admin-language-tabs" aria-label="Content language">{languages.map((code) => <button type="button" className={language === code ? "is-active" : ""} onClick={() => setLanguage(code)} key={code}>{code.toUpperCase()}</button>)}</div>;
  return <section className="admin-page admin-homepage-editor admin-footer-editor">
    <PageHeader kicker="Website content" title="Footer" description="Choose exactly what appears in each footer column." action={<div className="admin-page-actions"><a className="admin-button" href="/" target="_blank" rel="noreferrer">Open website ↗</a><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save footer"}</button></div>} />
    {error && <div className="admin-alert admin-alert--error">{error}</div>}{message && <div className="admin-alert admin-homepage-editor__success">{message}</div>}
    <div className="admin-homepage-editor__layout"><main><section className="admin-homepage-editor__section"><header className="admin-homepage-editor__section-head"><span>01</span><div><small>Footer navigation</small><h2>Footer columns</h2><p>Edit the title, content and order of all three columns.</p></div>{tabs}</header>
      <div className="admin-footer-editor__columns">{sections.map((section, sectionIndex) => <article className="admin-footer-editor__column" key={sectionIndex}><label>Column {sectionIndex + 1} heading<input value={section.title || ""} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} /></label><div className="admin-footer-editor__items">{(section.items || []).map((item, itemIndex) => { const page = pageOptions.some((option) => option.url === item.url) ? item.url : item.url ? "custom" : "text"; return <div className="admin-footer-editor__item" key={itemIndex}><div className="admin-footer-editor__item-fields"><label>Label<input value={item.label || ""} onChange={(event) => updateItem(sectionIndex, itemIndex, { label: event.target.value })} /></label><label>Destination<select value={page} onChange={(event) => { const value = event.target.value; updateItem(sectionIndex, itemIndex, { url: value === "text" ? "" : value === "custom" ? "https://" : value, target: value === "custom" ? "_blank" : "_self" }); }}>{pageOptions.map((option) => <option value={option.url} key={option.url}>{option.label}</option>)}<option value="custom">Custom or external link</option><option value="text">Plain text</option></select></label>{page === "custom" && <label className="is-wide">URL<input value={item.url || ""} onChange={(event) => updateItem(sectionIndex, itemIndex, { url: event.target.value })} /></label>}</div><div className="admin-footer-editor__item-actions">{page === "custom" && <button type="button" className={item.target === "_blank" ? "is-active" : ""} onClick={() => updateItem(sectionIndex, itemIndex, { target: item.target === "_blank" ? "_self" : "_blank" })} title="Open in new tab"><ExternalLink aria-hidden="true" /></button>}<button type="button" disabled={itemIndex === 0} onClick={() => moveItem(sectionIndex, itemIndex, -1)} title="Move up"><ArrowUp aria-hidden="true" /></button><button type="button" disabled={itemIndex === section.items.length - 1} onClick={() => moveItem(sectionIndex, itemIndex, 1)} title="Move down"><ArrowDown aria-hidden="true" /></button><button type="button" className="is-danger" onClick={() => removeItem(sectionIndex, itemIndex)} title="Remove"><Trash2 aria-hidden="true" /></button></div></div>; })}</div><button type="button" className="admin-footer-editor__add" onClick={() => addItem(sectionIndex)}><Plus aria-hidden="true" /> Add item</button></article>)}</div>
    </section><section className="admin-homepage-editor__section"><header className="admin-homepage-editor__section-head"><span>02</span><div><small>Legal</small><h2>Copyright</h2></div>{tabs}</header><div className="admin-homepage-fields"><label>Copyright line<textarea rows="3" value={records[copyrightKey(language)].payload.values.value || ""} onChange={(event) => setCopyright(event.target.value)} /></label></div></section></main></div>
    <div className="admin-sticky-save"><span className="is-unsaved">Review the footer, then save all changes together.</span><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save footer"}</button></div>
  </section>;
}
