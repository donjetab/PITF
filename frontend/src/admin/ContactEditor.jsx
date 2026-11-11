import { useEffect, useState } from "react";
import { AtSign, Mail, Music2, Users } from "lucide-react";
import { absoluteMediaUrl, adminApi } from "./adminApi";
import { MediaPicker } from "./MediaPicker";
import { PageHeader } from "./ResourcePage";

const languages = ["sq", "en"];
const defaults = {
  title: "Contact us",
  eyebrow: "PITF welcomes your message",
  intro: "Questions about the festival, programme, partnerships or press? Reach our team directly.",
  location: "Find us",
  message: "Send a message",
  name: "Your name",
  email: "Email address",
  subject: "Subject",
  body: "How can we help?",
  send: "Compose email",
  direct: "Contact PITF directly",
  write: "Email our team",
  emailAddress: "pitf@aab-edu.net",
  instagramLabel: "Instagram",
  instagramHandle: "@prishtinaitf",
  instagramUrl: "https://www.instagram.com/prishtinaitf/",
  facebookLabel: "Facebook",
  facebookName: "Prishtina International Theatre Festival",
  facebookUrl: "https://www.facebook.com/search/top?q=Prishtina%20International%20Theater%20Festival",
  tiktokLabel: "TikTok",
  tiktokHandle: "@prishtinaitf",
  tiktokUrl: "https://www.tiktok.com/@prishtinaitf",
};

const parseJson = (value) => { try { return JSON.parse(value || "{}") || {}; } catch { return {}; } };

function payloadFor(item) {
  return {
    values: { pageKey: "contact", sectionKey: "main", contentJson: item?.values?.contentJson || JSON.stringify(defaults), mediaId: item?.values?.mediaId || null, status: item?.values?.status || "Published", publishedAt: item?.values?.publishedAt || null, order: 1 },
    translations: { sq: {}, en: {}, bs: {}, ...(item?.translations || {}) }, mediaIds: item?.mediaIds || [], mediaRoles: item?.values?.mediaRoles || [], editionIds: [], links: [], selections: [], uploadedMediaIds: [],
  };
}

function localized(payload, language) {
  return { ...defaults, ...parseJson(payload.values.contentJson), ...(language === "en" ? {} : payload.translations?.[language] || {}) };
}

function MediaSlot({ mediaId, onChoose, onClear }) {
  const [media, setMedia] = useState(null);
  useEffect(() => { let active = true; if (!mediaId) { setMedia(null); return undefined; } adminApi.mediaItem(mediaId).then((value) => active && setMedia(value)).catch(() => active && setMedia(null)); return () => { active = false; }; }, [mediaId]);
  const src = media?.largeUrl || media?.mediumUrl || media?.thumbnailUrl || media?.originalUrl;
  return <div className={`admin-homepage-media${src ? " has-media" : ""}`}>{src ? <img src={absoluteMediaUrl(src)} alt="" /> : <div><b>No image selected</b><span>Choose the background used behind the Contact heading.</span></div>}<footer><span>Contact hero background</span><button type="button" className="admin-button" onClick={onChoose}>{src ? "Replace" : "Choose image"}</button>{mediaId && <button type="button" className="admin-button admin-button--quiet" onClick={onClear}>Remove</button>}</footer></div>;
}

function ContactCardFields({ icon: Icon, title, children }) {
  return <article className="admin-contact-editor__card"><header><span><Icon aria-hidden="true" /></span><div><small>Contact channel</small><h3>{title}</h3></div></header><div className="admin-homepage-fields">{children}</div></article>;
}

export function ContactEditor() {
  const [record, setRecord] = useState(null); const [language, setLanguage] = useState("en"); const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function load() {
    setError("");
    try { const result = await adminApi.list("pages"); const item = result.items.find((entry) => entry.values?.pageKey === "contact" && entry.values?.sectionKey === "main"); setRecord({ id: item?.id || null, payload: payloadFor(item) }); }
    catch (reason) { setError(reason.message); }
  }
  useEffect(() => { load(); }, []);
  if (!record) return <section className="admin-page"><PageHeader kicker="Website content" title="Contact page" description="Loading Contact page content..." />{error && <div className="admin-alert admin-alert--error">{error}</div>}</section>;
  const content = localized(record.payload, language);
  function write(field, value) {
    setRecord((current) => {
      if (language === "en") { const next = parseJson(current.payload.values.contentJson); next[field] = value; return { ...current, payload: { ...current.payload, values: { ...current.payload.values, contentJson: JSON.stringify(next) } } }; }
      return { ...current, payload: { ...current.payload, translations: { ...current.payload.translations, [language]: { ...(current.payload.translations[language] || {}), [field]: value } } } };
    });
  }
  function setMedia(mediaId, uploadedMediaIds = []) { setRecord((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, mediaId }, uploadedMediaIds: [...new Set([...(current.payload.uploadedMediaIds || []), ...uploadedMediaIds])] } })); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { await adminApi.save("pages", record); setMessage("Contact page changes saved and published."); await load(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  const languageTabs = <div className="admin-language-tabs">{languages.map((code) => <button type="button" className={language === code ? "is-active" : ""} onClick={() => setLanguage(code)} key={code}>{code.toUpperCase()}</button>)}</div>;
  return <section className="admin-page admin-homepage-editor admin-contact-editor">
    <PageHeader kicker="Website content" title="Contact page" description="Edit the Contact page in one continuous workspace. Contact details and social URLs remain under Site settings." action={<div className="admin-page-actions"><a className="admin-button" href="/contact" target="_blank" rel="noreferrer">Open Contact page ↗</a><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Contact page"}</button></div>} />
    {error && <div className="admin-alert admin-alert--error">{error}</div>}{message && <div className="admin-alert admin-homepage-editor__success">{message}</div>}
    <div className="admin-homepage-editor__layout"><main>
      <section className="admin-homepage-editor__section"><header className="admin-homepage-editor__section-head"><span>01</span><div><small>Opening section</small><h2>Hero</h2><p>Edit the headline, introduction and background image.</p></div>{languageTabs}</header><div className="admin-homepage-editor__split"><MediaSlot mediaId={record.payload.values.mediaId} onChoose={() => setPicker(true)} onClear={() => setMedia(null)} /><div className="admin-homepage-fields"><label>Eyebrow<input value={content.eyebrow || ""} onChange={(event) => write("eyebrow", event.target.value)} /></label><label>Title<input value={content.title || ""} onChange={(event) => write("title", event.target.value)} /></label><label>Introduction<textarea rows="6" value={content.intro || ""} onChange={(event) => write("intro", event.target.value)} /></label></div></div></section>
      <section className="admin-homepage-editor__section"><header className="admin-homepage-editor__section-head"><span>02</span><div><small>Direct channels</small><h2>Contact cards</h2><p>Edit every card label, displayed value and destination.</p></div>{languageTabs}</header><div className="admin-homepage-fields admin-contact-editor__heading"><label>Section heading<input value={content.direct || ""} onChange={(event) => write("direct", event.target.value)} /></label></div><div className="admin-contact-editor__cards"><ContactCardFields icon={Mail} title="Email"><label>Card label<input value={content.write || ""} onChange={(event) => write("write", event.target.value)} /></label><label>Email address<input type="email" value={content.emailAddress || ""} onChange={(event) => write("emailAddress", event.target.value)} /></label></ContactCardFields><ContactCardFields icon={AtSign} title="Instagram"><label>Card label<input value={content.instagramLabel || ""} onChange={(event) => write("instagramLabel", event.target.value)} /></label><label>Display name<input value={content.instagramHandle || ""} onChange={(event) => write("instagramHandle", event.target.value)} /></label><label>Profile URL<input type="url" value={content.instagramUrl || ""} onChange={(event) => write("instagramUrl", event.target.value)} /></label></ContactCardFields><ContactCardFields icon={Users} title="Facebook"><label>Card label<input value={content.facebookLabel || ""} onChange={(event) => write("facebookLabel", event.target.value)} /></label><label>Display name<input value={content.facebookName || ""} onChange={(event) => write("facebookName", event.target.value)} /></label><label>Page URL<input type="url" value={content.facebookUrl || ""} onChange={(event) => write("facebookUrl", event.target.value)} /></label></ContactCardFields><ContactCardFields icon={Music2} title="TikTok"><label>Card label<input value={content.tiktokLabel || ""} onChange={(event) => write("tiktokLabel", event.target.value)} /></label><label>Display name<input value={content.tiktokHandle || ""} onChange={(event) => write("tiktokHandle", event.target.value)} /></label><label>Profile URL<input type="url" value={content.tiktokUrl || ""} onChange={(event) => write("tiktokUrl", event.target.value)} /></label></ContactCardFields></div></section>
    </main></div>
    <div className="admin-sticky-save"><span className="is-unsaved">Review the page, then save all changes together.</span><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Contact page"}</button></div>
    {picker && <MediaPicker open initial={[record.payload.values.mediaId].filter(Boolean)} uploadContext={{ source: "pages", category: "other" }} onClose={() => setPicker(false)} onSelect={(ids, uploadedIds) => { setMedia(ids[0] || null, uploadedIds); setPicker(false); }} />}
  </section>;
}
