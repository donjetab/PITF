import { useEffect, useState } from "react";
import { absoluteMediaUrl, adminApi } from "./adminApi";
import { MediaPicker } from "./MediaPicker";
import { PageHeader } from "./ResourcePage";

const languages = ["sq", "en"];
const sectionKeys = ["intro", "statistics", "mission", "team"];
const parseJson = (value, fallback = {}) => { try { return JSON.parse(value || "") ?? fallback; } catch { return fallback; } };
const blocks = (value) => String(value || "").split(/\n\s*\n/).map((entry) => entry.trim()).filter(Boolean);
const emptyTranslations = () => ({ sq: {}, en: {}, bs: {} });

function pagePayload(item, sectionKey, order) {
  const mediaIds = item?.mediaIds || [];
  return {
    values: { pageKey: "about", sectionKey, contentJson: item?.values?.contentJson || "{}", mediaId: item?.values?.mediaId || null, status: item?.values?.status || "Published", publishedAt: item?.values?.publishedAt || null, order },
    translations: { ...emptyTranslations(), ...(item?.translations || {}) }, mediaIds, mediaRoles: item?.values?.mediaRoles || [], editionIds: [], links: [], selections: [], uploadedMediaIds: [],
  };
}

function localized(payload, language) {
  return { ...parseJson(payload.values.contentJson), ...(payload.translations?.[language] || {}) };
}

function structured(value, fallback = []) {
  if (Array.isArray(value)) return value;
  return parseJson(value, fallback);
}

function identityKey(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\.[^.]+$/, "").replace(/\d+/g, "").replace(/[^a-z]+/g, "");
}

function writeLocalized(setState, key, language, field, value, isStructured = false) {
  setState((current) => {
    const record = current[key];
    if (language === "en") {
      const content = parseJson(record.payload.values.contentJson); content[field] = value;
      return { ...current, [key]: { ...record, payload: { ...record.payload, values: { ...record.payload.values, contentJson: JSON.stringify(content) } } } };
    }
    return { ...current, [key]: { ...record, payload: { ...record.payload, translations: { ...record.payload.translations, [language]: { ...(record.payload.translations[language] || {}), [field]: isStructured ? JSON.stringify(value) : value } } } } };
  });
}

function LanguageTabs({ language, setLanguage }) {
  return <div className="admin-language-tabs">{languages.map((code) => <button type="button" className={language === code ? "is-active" : ""} onClick={() => setLanguage(code)} key={code}>{code.toUpperCase()}</button>)}</div>;
}

function SectionHeading({ number, kicker, title, description, language, setLanguage }) {
  return <header className="admin-homepage-editor__section-head"><span>{number}</span><div><small>{kicker}</small><h2>{title}</h2><p>{description}</p></div><LanguageTabs language={language} setLanguage={setLanguage} /></header>;
}

function MediaSlot({ mediaId, label, onChoose, onClear }) {
  const [media, setMedia] = useState(null);
  useEffect(() => { let active = true; if (!mediaId) { setMedia(null); return undefined; } adminApi.mediaItem(mediaId).then((value) => active && setMedia(value)).catch(() => active && setMedia(null)); return () => { active = false; }; }, [mediaId]);
  const src = media?.largeUrl || media?.mediumUrl || media?.thumbnailUrl || media?.originalUrl;
  return <div className={`admin-homepage-media${src ? " has-media" : ""}`}>{src ? <img src={absoluteMediaUrl(src)} alt="" /> : <div><b>No image selected</b><span>Choose an image from the media library.</span></div>}<footer><span>{label}</span><button type="button" className="admin-button" onClick={onChoose}>{src ? "Replace" : "Choose image"}</button>{mediaId && <button type="button" className="admin-button admin-button--quiet" onClick={onClear}>Remove</button>}</footer></div>;
}

function MediaCollection({ ids, label, onChoose, onRemove }) {
  const [media, setMedia] = useState([]);
  useEffect(() => { let active = true; Promise.all(ids.map((id) => adminApi.mediaItem(id).catch(() => null))).then((items) => { if (active) setMedia(items.filter(Boolean)); }); return () => { active = false; }; }, [ids]);
  return <div className="admin-about-editor__media-collection"><header><div><b>{label}</b><span>{ids.length} selected</span></div><button type="button" className="admin-button" onClick={onChoose}>Choose / reorder images</button></header>{media.length ? <div>{media.map((item) => <figure key={item.id}><img src={absoluteMediaUrl(item.mediumUrl || item.thumbnailUrl || item.originalUrl)} alt="" /><button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.originalFilename || "image"} from About gallery`} title="Remove image">×</button></figure>)}</div> : <p>No images selected yet.</p>}</div>;
}

function TeamMemberPhoto({ mediaId, name, onChoose, onClear }) {
  const [media, setMedia] = useState(null);
  useEffect(() => { let active = true; if (!mediaId) { setMedia(null); return undefined; } adminApi.mediaItem(mediaId).then((value) => active && setMedia(value)).catch(() => active && setMedia(null)); return () => { active = false; }; }, [mediaId]);
  const src = media?.mediumUrl || media?.thumbnailUrl || media?.originalUrl;
  return <div className="admin-about-editor__portrait"><button type="button" onClick={onChoose} aria-label={`Choose photograph for ${name || "team member"}`}>{src ? <img src={absoluteMediaUrl(src)} alt="" /> : <span>Add photo</span>}</button><div><button type="button" onClick={onChoose}>{src ? "Replace" : "Choose"}</button>{mediaId && <button type="button" className="is-danger" onClick={onClear}>Remove</button>}</div></div>;
}

export function AboutEditor() {
  const [state, setState] = useState(null); const [language, setLanguage] = useState("en"); const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const result = await adminApi.list("pages"); const rows = result.items.filter((item) => item.values?.pageKey === "about");
      const records = Object.fromEntries(sectionKeys.map((key, index) => { const item = rows.find((entry) => entry.values?.sectionKey === key); return [key, { id: item?.id || null, payload: pagePayload(item, key, index + 1) }]; }));
      const teamPayload = records.team.payload; const people = structured(parseJson(teamPayload.values.contentJson).people);
      const media = await Promise.all(teamPayload.mediaIds.map((id) => adminApi.mediaItem(id).catch(() => null)));
      const matchedIds = people.map((person) => { const personKey = identityKey(person.name); const match = media.find((item) => item && [item.originalFilename, item.alt, item.caption].some((value) => { const key = identityKey(value); return key && (key.includes(personKey) || personKey.includes(key)); })); return match?.id; }).filter(Boolean);
      if (matchedIds.length) {
        const matched = new Set(matchedIds); const galleryIds = teamPayload.mediaIds.filter((id) => !matched.has(id));
        records.team.payload = { ...teamPayload, mediaIds: [...matchedIds, ...galleryIds], mediaRoles: [...matchedIds.map(() => "team"), ...galleryIds.map(() => "gallery")] };
      }
      setState(records);
    } catch (reason) { setError(reason.message); }
  }
  useEffect(() => { load(); }, []);
  if (!state) return <section className="admin-page"><PageHeader kicker="Content" title="About page" description="Loading About page content…" />{error && <div className="admin-alert admin-alert--error">{error}</div>}</section>;

  const intro = localized(state.intro.payload, language); const statistics = localized(state.statistics.payload, language); const mission = localized(state.mission.payload, language); const team = localized(state.team.payload, language);
  const statisticItems = structured(statistics.items); const people = structured(team.people);
  const teamIds = state.team.payload.mediaIds.filter((_, index) => state.team.payload.mediaRoles[index] === "team");
  const galleryIds = state.team.payload.mediaIds.filter((_, index) => state.team.payload.mediaRoles[index] !== "team");
  const write = (key, field, value, isStructured = false) => writeLocalized(setState, key, language, field, value, isStructured);
  const patchArray = (key, field, values, index, property, value) => write(key, field, values.map((entry, position) => position === index ? { ...entry, [property]: value } : entry), true);
  const setPrimaryMedia = (key, mediaId, uploadedIds = []) => setState((current) => ({ ...current, [key]: { ...current[key], payload: { ...current[key].payload, values: { ...current[key].payload.values, mediaId }, uploadedMediaIds: [...new Set([...(current[key].payload.uploadedMediaIds || []), ...uploadedIds])] } } }));
  function setTeamMedia(role, ids, uploadedIds = []) {
    setState((current) => { const payload = current.team.payload; const keep = payload.mediaIds.filter((_, index) => (payload.mediaRoles[index] === "team") !== (role === "team")); const combined = role === "team" ? [...ids, ...keep] : [...keep, ...ids]; const roles = role === "team" ? [...ids.map(() => "team"), ...keep.map(() => "gallery")] : [...keep.map(() => "team"), ...ids.map(() => "gallery")]; return { ...current, team: { ...current.team, payload: { ...payload, mediaIds: combined, mediaRoles: roles, uploadedMediaIds: [...new Set([...(payload.uploadedMediaIds || []), ...uploadedIds])] } } }; });
  }
  function setTeamMemberPhoto(index, mediaId, uploadedIds = []) {
    const next = [...teamIds];
    if (mediaId) next[index] = mediaId; else next.splice(index, 1);
    setTeamMedia("team", next.filter(Boolean), uploadedIds);
  }
  function removePerson(index) {
    write("team", "people", people.filter((_, position) => position !== index), true);
    const nextPhotos = teamIds.filter((_, position) => position !== index);
    setTeamMedia("team", nextPhotos);
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { for (const key of sectionKeys) await adminApi.save("pages", state[key]); setMessage("About page changes saved and published."); await load(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  function applyMedia(ids, uploadedIds = []) { if (picker.type === "primary") setPrimaryMedia(picker.key, ids[0] || null, uploadedIds); else if (picker.type === "person") setTeamMemberPhoto(picker.index, ids[0] || null, uploadedIds); else setTeamMedia(picker.role, ids, uploadedIds); setPicker(null); }

  return <section className="admin-page admin-homepage-editor admin-about-editor">
    <PageHeader kicker="Website content" title="About page" description="Edit every About page section in one continuous workspace. Changes are published together when you save." action={<div className="admin-page-actions"><a className="admin-button" href="/about" target="_blank" rel="noreferrer">Open About page ↗</a><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save About page"}</button></div>} />
    {error && <div className="admin-alert admin-alert--error">{error}</div>}{message && <div className="admin-alert admin-homepage-editor__success">{message}</div>}
    <div className="admin-homepage-editor__layout"><main>
      <section className="admin-homepage-editor__section"><SectionHeading number="01" kicker="Opening section" title="Introduction" description="Edit the About page headline, opening story and stage image." language={language} setLanguage={setLanguage} /><div className="admin-homepage-editor__split"><MediaSlot mediaId={state.intro.payload.values.mediaId} label="Introduction image" onChoose={() => setPicker({ type: "primary", key: "intro" })} onClear={() => setPrimaryMedia("intro", null)} /><div className="admin-homepage-fields"><label>Eyebrow<input value={intro.eyebrow || ""} onChange={(event) => write("intro", "eyebrow", event.target.value)} /></label><label>Title<textarea rows="3" value={intro.title || ""} onChange={(event) => write("intro", "title", event.target.value)} /></label><label>Introduction text<textarea rows="9" value={structured(intro.paragraphs).join("\n\n")} onChange={(event) => write("intro", "paragraphs", blocks(event.target.value), true)} /><small>Leave a blank line between paragraphs.</small></label></div></div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="02" kicker="Festival figures" title="PITF in numbers" description="Manage the figures and supporting text shown in the statistics section." language={language} setLanguage={setLanguage} /><div className="admin-about-editor__repeater">{statisticItems.map((item, index) => <article key={index}><span>{String(index + 1).padStart(2, "0")}</span><div className="admin-homepage-fields"><div className="admin-homepage-fields__row"><label>Value<input type="number" value={item.value ?? ""} onChange={(event) => patchArray("statistics", "items", statisticItems, index, "value", Number(event.target.value))} /></label><label>Suffix<input value={item.suffix || ""} placeholder="e.g. +" onChange={(event) => patchArray("statistics", "items", statisticItems, index, "suffix", event.target.value)} /></label></div><label>Label<input value={item.label || ""} onChange={(event) => patchArray("statistics", "items", statisticItems, index, "label", event.target.value)} /></label><label>Description<textarea rows="3" value={item.text || ""} onChange={(event) => patchArray("statistics", "items", statisticItems, index, "text", event.target.value)} /></label></div></article>)}</div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="03" kicker="Festival purpose" title="Mission" description="Edit the festival mission statement and its supporting photograph." language={language} setLanguage={setLanguage} /><div className="admin-homepage-editor__split"><MediaSlot mediaId={state.mission.payload.values.mediaId} label="Mission image" onChoose={() => setPicker({ type: "primary", key: "mission" })} onClear={() => setPrimaryMedia("mission", null)} /><div className="admin-homepage-fields"><label>Eyebrow<input value={mission.eyebrow || ""} onChange={(event) => write("mission", "eyebrow", event.target.value)} /></label><label>Title<textarea rows="3" value={mission.title || ""} onChange={(event) => write("mission", "title", event.target.value)} /></label><label>Mission text<textarea rows="9" value={mission.text || ""} onChange={(event) => write("mission", "text", event.target.value)} /></label></div></div></section>
      <section className="admin-homepage-editor__section"><SectionHeading number="04" kicker="Festival people" title="Team & gallery" description="Edit the team introduction, people and closing About page gallery." language={language} setLanguage={setLanguage} /><div className="admin-homepage-fields admin-about-editor__team-copy"><label>Section title<input value={team.title || ""} onChange={(event) => write("team", "title", event.target.value)} /></label><label>Introduction<textarea rows="4" value={team.intro || ""} onChange={(event) => write("team", "intro", event.target.value)} /></label></div><div className="admin-about-editor__repeater admin-about-editor__people"><header><div><b>Team members</b><span>Edit each member and photograph together.</span></div><button type="button" className="admin-button" onClick={() => write("team", "people", [...people, { name: "", role: "" }], true)}>＋ Add person</button></header>{people.map((person, index) => <article key={index}><span>{String(index + 1).padStart(2, "0")}</span><TeamMemberPhoto mediaId={teamIds[index]} name={person.name} onChoose={() => setPicker({ type: "person", index })} onClear={() => setTeamMemberPhoto(index, null)} /><div className="admin-homepage-fields admin-homepage-fields__row"><label>Name<input value={person.name || ""} onChange={(event) => patchArray("team", "people", people, index, "name", event.target.value)} /></label><label>Role<input value={person.role || ""} onChange={(event) => patchArray("team", "people", people, index, "role", event.target.value)} /></label></div><button type="button" className="admin-about-editor__remove" onClick={() => removePerson(index)}>Remove</button></article>)}</div><div className="admin-about-editor__collections admin-about-editor__collections--gallery"><MediaCollection ids={galleryIds} label="About gallery" onChoose={() => setPicker({ type: "collection", role: "gallery" })} onRemove={(id) => setTeamMedia("gallery", galleryIds.filter((entry) => entry !== id))} /></div></section>
    </main></div>
    <div className="admin-sticky-save"><span className="is-unsaved">Review the page, then save all changes together.</span><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save About page"}</button></div>
    {picker && <MediaPicker open multiple={picker.type === "collection"} uploadContext={{ source: "pages", category: "other" }} initial={picker.type === "primary" ? [state[picker.key].payload.values.mediaId] : picker.type === "person" ? [teamIds[picker.index]] : galleryIds} onClose={() => setPicker(null)} onSelect={applyMedia} />}
  </section>;
}
