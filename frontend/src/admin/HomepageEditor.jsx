import { useEffect, useMemo, useState } from "react";
import { absoluteMediaUrl, adminApi } from "./adminApi";
import { MediaPicker } from "./MediaPicker";
import { PageHeader } from "./ResourcePage";

const languages = ["sq", "en"];
const emptyTranslations = () => ({ sq: {}, en: {}, bs: {} });
const parseJson = (value) => { try { return JSON.parse(value || "{}"); } catch { return {}; } };
const lines = (value) => String(value || "").split("\n").map((item) => item.trim()).filter(Boolean);
const blocks = (value) => String(value || "").split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
const pagePayload = (item, sectionKey, order) => ({
  values: { pageKey: "home", sectionKey, contentJson: item?.values?.contentJson || "{}", mediaId: item?.values?.mediaId || null, status: item?.values?.status || "Published", publishedAt: item?.values?.publishedAt || null, order },
  translations: { ...emptyTranslations(), ...(item?.translations || {}) }, mediaIds: item?.mediaIds || [], editionIds: [], links: [], selections: [], uploadedMediaIds: [],
});
const sectionPayload = (item, key, order) => ({
  values: { key, isVisible: item?.values?.isVisible ?? true, order: item?.values?.order ?? order, selectionMode: item?.values?.selectionMode || "automatic", selectedEditionId: item?.values?.selectedEditionId || null, itemLimit: item?.values?.itemLimit ?? null, configurationJson: item?.values?.configurationJson || "{}", status: item?.values?.status || "Published", publishedAt: item?.values?.publishedAt || null },
  translations: { ...emptyTranslations(), ...(item?.translations || {}) }, mediaIds: [], editionIds: [], links: [], selections: item?.selections || [], uploadedMediaIds: [],
});

function LanguageTabs({ language, setLanguage }) {
  return <div className="admin-language-tabs" aria-label="Content language">{languages.map((code) => <button type="button" className={language === code ? "is-active" : ""} onClick={() => setLanguage(code)} key={code}>{code.toUpperCase()}</button>)}</div>;
}

function SectionHeading({ number, kicker, title, description, language, setLanguage, translated = true }) {
  return <header className="admin-homepage-editor__section-head"><span>{number}</span><div><small>{kicker}</small><h2>{title}</h2><p>{description}</p></div>{translated && <LanguageTabs language={language} setLanguage={setLanguage} />}</header>;
}

function MediaSlot({ mediaId, label, onChoose, onClear }) {
  const [media, setMedia] = useState(null);
  useEffect(() => { let active = true; if (!mediaId) { setMedia(null); return undefined; } adminApi.mediaItem(mediaId).then((value) => active && setMedia(value)).catch(() => active && setMedia(null)); return () => { active = false; }; }, [mediaId]);
  const src = media?.largeUrl || media?.mediumUrl || media?.thumbnailUrl || media?.originalUrl;
  return <div className={`admin-homepage-media${src ? " has-media" : ""}`}>{src ? <img src={absoluteMediaUrl(src)} alt="" /> : <div><b>No image selected</b><span>Choose an image from the media library.</span></div>}<footer><span>{label}</span><button type="button" className="admin-button" onClick={onChoose}>{src ? "Replace" : "Choose image"}</button>{mediaId && <button type="button" className="admin-button admin-button--quiet" onClick={onClear}>Remove</button>}</footer></div>;
}

function localizedContent(payload, language) {
  const base = parseJson(payload.values.contentJson);
  return { ...base, ...(payload.translations?.[language] || {}) };
}

function writeLocalized(setter, language, field, value, isStructured = false) {
  setter((current) => {
    if (language === "en") {
      const json = parseJson(current.values.contentJson); json[field] = isStructured ? value : value;
      return { ...current, values: { ...current.values, contentJson: JSON.stringify(json) } };
    }
    return { ...current, translations: { ...current.translations, [language]: { ...(current.translations[language] || {}), [field]: isStructured ? JSON.stringify(value) : value } } };
  });
}

export function HomepageEditor() {
  const [state, setState] = useState(null); const [language, setLanguage] = useState("en"); const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const [pagesResult, homepageResult, sponsorsResult, editionsResult] = await Promise.all([adminApi.list("pages"), adminApi.list("homepage"), adminApi.list("sponsors"), adminApi.list("editions")]);
      const pages = pagesResult.items.filter((item) => item.values?.pageKey === "home"); const sections = homepageResult.items;
      const heroItem = pages.find((item) => item.values?.sectionKey === "hero"); const aboutItem = pages.find((item) => item.values?.sectionKey === "about");
      const featuredItem = sections.find((item) => item.values?.key === "featured-edition"); const editionsItem = sections.find((item) => item.values?.key === "editions"); const sponsorsItem = sections.find((item) => item.values?.key === "sponsors");
      setState({
        hero: { id: heroItem?.id || null, payload: pagePayload(heroItem, "hero", 1) }, about: { id: aboutItem?.id || null, payload: pagePayload(aboutItem, "about", 2) },
        featured: { id: featuredItem?.id || null, payload: sectionPayload(featuredItem, "featured-edition", 2) }, editionsSection: { id: editionsItem?.id || null, payload: sectionPayload(editionsItem, "editions", 5) }, sponsorsSection: { id: sponsorsItem?.id || null, payload: sectionPayload(sponsorsItem, "sponsors", 7) },
        sponsors: sponsorsResult.items.map((item) => ({ id: item.id, removed: false, payload: { values: { ...item.values }, translations: { ...emptyTranslations(), ...(item.translations || {}) }, editionIds: item.editionIds || [], mediaIds: [], links: [], selections: [], uploadedMediaIds: [] } })), editions: editionsResult.items,
      });
    } catch (reason) { setError(reason.message); }
  }
  useEffect(() => { load(); }, []);
  const hero = state ? localizedContent(state.hero.payload, language) : {}; const about = state ? localizedContent(state.about.payload, language) : {};
  const sponsorConfig = state ? parseJson(state.sponsorsSection.payload.values.configurationJson) : {}; const editionsConfig = state ? parseJson(state.editionsSection.payload.values.configurationJson) : {};
  const visibleSponsors = useMemo(() => state?.sponsors.filter((item) => !item.removed) || [], [state]);
  function updateRecord(key, updater) { setState((current) => ({ ...current, [key]: { ...current[key], payload: typeof updater === "function" ? updater(current[key].payload) : updater } })); }
  function updateSectionConfig(key, field, value) { updateRecord(key, (payload) => ({ ...payload, values: { ...payload.values, configurationJson: JSON.stringify({ ...parseJson(payload.values.configurationJson), [field]: value }) } })); }
  function updateSponsor(index, field, value) { setState((current) => ({ ...current, sponsors: current.sponsors.map((item, itemIndex) => itemIndex === index ? { ...item, payload: { ...item.payload, values: { ...item.payload.values, [field]: value } } } : item) })); }
  function addSponsor() { setState((current) => ({ ...current, sponsors: [...current.sponsors, { id: null, removed: false, payload: { values: { name: "", logoMediaId: null, url: "", category: "", status: "Published", order: visibleSponsors.length }, translations: emptyTranslations(), editionIds: [], mediaIds: [], links: [], selections: [], uploadedMediaIds: [] } }] })); }
  function removeSponsor(index) { setState((current) => ({ ...current, sponsors: current.sponsors.map((item, itemIndex) => itemIndex === index ? { ...item, removed: true } : item) })); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      for (const key of ["hero", "about"]) await adminApi.save("pages", state[key]);
      for (const key of ["featured", "editionsSection", "sponsorsSection"]) await adminApi.save("homepage", state[key]);
      for (const sponsor of state.sponsors) {
        if (sponsor.removed) { if (sponsor.id) await adminApi.remove("sponsors", sponsor.id); continue; }
        if (!sponsor.payload.values.name.trim()) throw new Error("Every sponsor needs a name.");
        await adminApi.save("sponsors", sponsor);
      }
      setMessage("Homepage changes saved and published."); await load();
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  function chooseMedia(target, sponsorIndex = null) { setPicker({ target, sponsorIndex }); }
  function applyMedia(ids, uploadedIds = []) {
    const id = ids[0] || null;
    if (picker.sponsorIndex != null) setState((current) => ({ ...current, sponsors: current.sponsors.map((item, index) => index === picker.sponsorIndex ? { ...item, payload: { ...item.payload, values: { ...item.payload.values, logoMediaId: id }, uploadedMediaIds: [...new Set([...(item.payload.uploadedMediaIds || []), ...uploadedIds])] } } : item) }));
    else updateRecord(picker.target, (payload) => ({ ...payload, values: { ...payload.values, mediaId: id }, uploadedMediaIds: [...new Set([...(payload.uploadedMediaIds || []), ...uploadedIds])] }));
    setPicker(null);
  }
  if (!state) return <section className="admin-page"><PageHeader kicker="Content" title="Homepage" description="Loading homepage content…" />{error && <div className="admin-alert admin-alert--error">{error}</div>}</section>;
  const setHero = (updater) => updateRecord("hero", updater); const setAbout = (updater) => updateRecord("about", updater);
  return <section className="admin-page admin-homepage-editor">
    <PageHeader kicker="Website content" title="Homepage" description="Edit the public homepage in one continuous workspace. Changes are published when you save." action={<div className="admin-page-actions"><a className="admin-button" href="/" target="_blank" rel="noreferrer">Open website ↗</a><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save homepage"}</button></div>} />
    {error && <div className="admin-alert admin-alert--error">{error}</div>}{message && <div className="admin-alert admin-homepage-editor__success">{message}</div>}
    <div className="admin-homepage-editor__layout"><main>
      <section className="admin-homepage-editor__section"><SectionHeading number="01" kicker="Opening section" title="Hero" description="Update the main image, headline and introductory text." language={language} setLanguage={setLanguage} /><div className="admin-homepage-editor__split"><MediaSlot mediaId={state.hero.payload.values.mediaId} label="Hero background" onChoose={() => chooseMedia("hero")} onClear={() => updateRecord("hero", (payload) => ({ ...payload, values: { ...payload.values, mediaId: null } }))} /><div className="admin-homepage-fields"><label>Headline <textarea rows="4" value={Array.isArray(hero.titleParts) ? hero.titleParts.join("\n") : hero.titleParts || ""} onChange={(event) => writeLocalized(setHero, language, "titleParts", lines(event.target.value), true)} /><small>Put each headline line on a new line.</small></label><label>Description <textarea rows="4" value={hero.description || ""} onChange={(event) => writeLocalized(setHero, language, "description", event.target.value)} /></label><div className="admin-homepage-fields__row"><label>Button label <input value={hero.ctaText || ""} onChange={(event) => writeLocalized(setHero, language, "ctaText", event.target.value)} /></label><label>Button link <input value={hero.ctaUrl || ""} onChange={(event) => writeLocalized(setHero, language, "ctaUrl", event.target.value)} /></label></div></div></div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="02" kicker="Introduction" title="About PITF" description="Edit the short festival introduction shown on the homepage." language={language} setLanguage={setLanguage} /><div className="admin-homepage-editor__split"><MediaSlot mediaId={state.about.payload.values.mediaId} label="About image" onChoose={() => chooseMedia("about")} onClear={() => updateRecord("about", (payload) => ({ ...payload, values: { ...payload.values, mediaId: null } }))} /><div className="admin-homepage-fields"><label>Eyebrow <input value={about.kicker || ""} onChange={(event) => writeLocalized(setAbout, language, "kicker", event.target.value)} /></label><label>Title <textarea rows="3" value={about.title || ""} onChange={(event) => writeLocalized(setAbout, language, "title", event.target.value)} /></label><label>About text <textarea rows="9" value={Array.isArray(about.paragraphs) ? about.paragraphs.join("\n\n") : about.paragraphs || ""} onChange={(event) => writeLocalized(setAbout, language, "paragraphs", blocks(event.target.value), true)} /><small>Leave a blank line between paragraphs.</small></label></div></div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="03" kicker="Edition content" title="Featured edition" description="Choose which edition is highlighted. Its image and details come from the Editions area." translated={false} /><div className="admin-homepage-fields admin-homepage-fields--compact"><label>Edition <select value={state.featured.payload.values.selectedEditionId || ""} onChange={(event) => updateRecord("featured", (payload) => ({ ...payload, values: { ...payload.values, selectedEditionId: event.target.value || null, selectionMode: event.target.value ? "manual" : "automatic" } }))}><option value="">Newest published edition (automatic)</option>{state.editions.map((item) => <option value={item.id} key={item.id}>Edition {item.values.number} · {item.values.year}</option>)}</select></label><label className="admin-check"><input type="checkbox" checked={state.featured.payload.values.isVisible} onChange={(event) => updateRecord("featured", (payload) => ({ ...payload, values: { ...payload.values, isVisible: event.target.checked } }))} /><span><b>Show featured edition</b></span></label></div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="04" kicker="Edition archive" title="All editions" description="Control the editions carousel shown further down the homepage." translated={false} /><div className="admin-homepage-fields admin-homepage-fields--compact"><label>Section title <input value={editionsConfig.title || ""} placeholder="All PITF editions" onChange={(event) => updateSectionConfig("editionsSection", "title", event.target.value)} /></label><label className="admin-check"><input type="checkbox" checked={state.editionsSection.payload.values.isVisible} onChange={(event) => updateRecord("editionsSection", (payload) => ({ ...payload, values: { ...payload.values, isVisible: event.target.checked } }))} /><span><b>Show all editions</b></span></label></div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="05" kicker="Festival supporters" title="Sponsors & partners" description="Add the section text and manage the moving sponsor logos in the same place." translated={false} /><div className="admin-homepage-fields admin-homepage-fields--sponsor-copy"><label>Eyebrow <input value={sponsorConfig.kicker || ""} placeholder="Sponsors" onChange={(event) => updateSectionConfig("sponsorsSection", "kicker", event.target.value)} /></label><label>Title <input value={sponsorConfig.title || ""} placeholder="Together for the art" onChange={(event) => updateSectionConfig("sponsorsSection", "title", event.target.value)} /></label><label className="admin-field--wide">Supporting text <textarea rows="4" value={sponsorConfig.text || ""} onChange={(event) => updateSectionConfig("sponsorsSection", "text", event.target.value)} /></label></div><div className="admin-sponsor-editor"><header><div><b>Sponsor logos</b><span>Logos move automatically on the public homepage.</span></div><button type="button" className="admin-button" onClick={addSponsor}>＋ Add sponsor</button></header>{visibleSponsors.length === 0 && <div className="admin-homepage-editor__empty">No sponsors yet. Add the first sponsor logo.</div>}{state.sponsors.map((sponsor, index) => sponsor.removed ? null : <div className="admin-sponsor-row" key={sponsor.id || `new-${index}`}><MediaSlot mediaId={sponsor.payload.values.logoMediaId} label="Logo" onChoose={() => chooseMedia("sponsor", index)} onClear={() => updateSponsor(index, "logoMediaId", null)} /><div className="admin-homepage-fields"><label>Sponsor name <input required value={sponsor.payload.values.name || ""} onChange={(event) => updateSponsor(index, "name", event.target.value)} /></label><label>Website link <input type="url" value={sponsor.payload.values.url || ""} placeholder="https:// (optional)" onChange={(event) => updateSponsor(index, "url", event.target.value)} /></label></div><button type="button" className="admin-sponsor-row__remove" onClick={() => removeSponsor(index)} aria-label={`Remove ${sponsor.payload.values.name || "sponsor"}`}>×</button></div>)}</div><label className="admin-check admin-homepage-editor__visibility"><input type="checkbox" checked={state.sponsorsSection.payload.values.isVisible} onChange={(event) => updateRecord("sponsorsSection", (payload) => ({ ...payload, values: { ...payload.values, isVisible: event.target.checked } }))} /><span><b>Show sponsors on the homepage</b></span></label></section>
    </main></div>
    <div className="admin-sticky-save"><span className="is-unsaved">Review the page, then save all changes together.</span><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save homepage"}</button></div>
    {picker && <MediaPicker open uploadContext={{ source: picker.sponsorIndex != null ? "sponsors" : "pages", category: picker.sponsorIndex != null ? "sponsor-branding" : "other" }} initial={[picker.sponsorIndex != null ? state.sponsors[picker.sponsorIndex]?.payload.values.logoMediaId : state[picker.target]?.payload.values.mediaId]} onClose={() => setPicker(null)} onSelect={applyMedia} />}
  </section>;
}
