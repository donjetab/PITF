import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { absoluteMediaUrl, adminApi } from "./adminApi";
import { itemLabel, resourceConfig } from "./adminConfig";
import { MediaPicker, MediaThumb } from "./MediaPicker";
import { useAdminAuth } from "./AdminAuth";
import { useAdminDialog } from "./AdminDialog";

function editorUploadContext(resource, model, payload, field) {
  const values = payload.values || {};
  const year = resource === "editions" ? Number(values.year) || null : resource === "news" ? Number(String(values.date || "").slice(0, 4)) || null : null;
  const category = field === "conferenceMediaIdsJson" ? "press-conference" : field === "playMediaIdsJson" || resource === "program" ? "performance" : field === "memoriesMediaIdsJson" ? "after-party" : field === "recapMediaId" ? "recap" : resource === "awards" ? "awards" : resource === "sponsors" ? "sponsor-branding" : "other";
  return { source: resource, year, editionId: resource === "editions" ? model.id : values.editionId, festivalDayId: resource === "days" ? model.id : values.festivalDayId, programItemId: resource === "program" ? model.id : values.programItemId, category };
}

const emptyPayload = () => ({ recordId: null, values: {}, translations: { sq: {}, en: {}, bs: {} }, mediaIds: [], editionIds: [], links: [], selections: [] });
const clone = (value) => JSON.parse(JSON.stringify(value));
const payloadFromItem = (item) => ({ recordId: item.id, values: clone(item.values || {}), translations: { sq: {}, en: {}, bs: {}, ...clone(item.translations || {}) }, mediaIds: clone(item.mediaIds || []), editionIds: clone(item.editionIds || []), links: clone(item.links || []), selections: clone(item.selections || []) });
const editionTitleForNumber = (language, number) => number ? `${language === "sq" ? "Edicioni" : "Edition"} ${number}` : "";
const slugify = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const todayForInput = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };

const editorBlueprints = {
  editions: [
    { key: "overview", label: "Overview", description: "Set the edition details, listing banner, page header photograph and edition logo.", fields: ["number", "year", "startDate", "endDate", "heroMediaId", "detailHeaderMediaId", "backgroundMediaId"] },
    { key: "intro", label: "Introduction", description: "Write separate translated content for the page header and the edition story below it.", translations: true, translationFields: ["title", "headerDescription", "storyTitle", "storySubtitle", "storyDescription"] },
    { key: "program", label: "Program", description: "The complete performance schedule for this edition.", relationResource: "program" },
    { key: "days", label: "Festival days", description: "Daily conclusions, conferences, plays, ceremonies and other activities.", relationResource: "days" },
    { key: "recap", label: "Edition recap", description: "The edition-wide recap video and its supporting copy.", fields: ["recapMediaId"], translations: true, translationFields: ["recapTitle", "recapText"] },
    { key: "awards", label: "Awards", description: "Awards and winners revealed after the edition ends.", relationResource: "awards" },
    { key: "news", label: "News", description: "All news stories connected to this edition.", relationResource: "news" },
    { key: "memories", label: "Memories", description: "Curate the ordered photographs visitors will see on the edition page.", relationResource: "galleries" },
    { key: "publication", label: "Publish", description: "Review completeness, visibility and display order.", fields: ["status", "publishedAt", "order"] },
  ],
  days: [
    { key: "header", label: "Header", description: "Choose the day, header photograph, title and introduction.", fields: ["editionId", "date", "dayNumber", "order", "isPageEnabled", "isHeaderVisible", "headerMediaId"], translations: true, translationFields: ["title", "description"] },
    { key: "conference", label: "Conference", description: "Write the conference content and select its photographs.", fields: ["isConferenceVisible", "conferenceMediaIdsJson"], translations: true, translationFields: ["conferenceTitle", "conferenceText"] },
    { key: "play", label: "Play / ceremony", description: "Write the label, title and text shown for the play or ceremony, then select its photographs.", fields: ["isPlayVisible", "playMediaIdsJson"], translations: true, translationFields: ["playLabel", "playTitle", "playText"] },
    { key: "recap", label: "Recap / ceremony film", description: "Preview the film and edit every label shown in this section. Add a YouTube link to use it instead of the uploaded video.", fields: ["isRecapVisible", "recapMediaId", "recapYoutubeUrl"], translations: true, translationFields: ["recapKicker", "recapTitle", "recapText", "recapMediaLabel", "recapPlayLabel"] },
    { key: "memories", label: "Memories", description: "Curate the afterparty photographs and publish them independently.", fields: ["isMemoriesVisible", "memoriesMediaIdsJson"], translations: true, translationFields: ["conclusion"] },
  ],
  news: [
    { key: "article", label: "News article", description: "Write, illustrate and publish the complete story in one workspace." },
  ],
  program: [
    { key: "details", label: "Play details", description: "Title, production, schedule, country, company and location.", fields: ["editionId", "participationType", "director", "credits", "startsAt", "venue"], translations: true, translationFields: ["title", "country", "company"] },
    { key: "content", label: "Synopsis & translations", description: "Public description and synopsis in every language.", translations: true, translationFields: ["description", "synopsis"] },
    { key: "media", label: "Poster & photographs", description: "Choose the main image and review photographs already assigned to this play.", fields: ["posterMediaId"] },
    { key: "publication", label: "Publication", description: "Review visibility, display order and publishing time.", fields: ["status", "publishedAt", "order"] },
  ],
  activities: [
    { key: "details", label: "Ceremony details", description: "Choose the festival day, ceremony type, time and venue.", fields: ["festivalDayId", "type", "startTime", "endTime", "venue"] },
    { key: "translations", label: "Text & translations", description: "Enter the ceremony title and supporting text in each website language.", translations: true, translationFields: ["title", "description", "body"] },
  ],
};

function makeNewModel(config) {
  const payload = emptyPayload();
  for (const field of config.fields) {
    if (field.name.startsWith("$")) continue;
    payload.values[field.name] = field.type === "checkbox" ? field.name !== "isCritical" : field.name === "status" ? "Draft" : field.name === "date" ? todayForInput() : field.options?.[0] ?? "";
  }
  return { id: null, payload };
}

function makeNewEditorModel(config, searchParams) {
  const initial = makeNewModel(config);
  for (const field of config.fields) {
    if (!field.name.startsWith("$") && searchParams.has(field.name)) initial.payload.values[field.name] = searchParams.get(field.name);
  }
  return { ...initial, originalPayload: clone(initial.payload) };
}

export function ResourcePage({ resource, scope, title, description }) {
  const auth = useAdminAuth();
  const dialog = useAdminDialog();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = resourceConfig[resource]; const [items, setItems] = useState([]); const [lookups, setLookups] = useState({});
  const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState("All"); const [newsPage, setNewsPage] = useState(1); const [editing, setEditing] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [previewKey, setPreviewKey] = useState(0);
  async function load() { setLoading(true); setError(""); try { const result = await adminApi.list(resource); setItems(result.items || []); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [resource]);
  const requestedEditId = searchParams.get("edit");
  useEffect(() => {
    if (!requestedEditId || editing) return;
    const item = items.find((entry) => entry.id === requestedEditId);
    if (item) setEditing({ id: item.id, payload: payloadFromItem(item) });
  }, [requestedEditId, items, editing]);
  useEffect(() => {
    const resources = [...new Set(config.fields.filter((f) => f.resource).map((f) => f.resource))];
    Promise.all(resources.map(async (name) => [name, (await adminApi.list(name)).items || []])).then((pairs) => setLookups(Object.fromEntries(pairs))).catch(() => {});
  }, [resource]);
  const queryKey = searchParams.toString();
  const effectiveScope = useMemo(() => {
    const query = new URLSearchParams(queryKey);
    const fromQuery = {};
    for (const field of config.fields) if (!field.name.startsWith("$") && query.has(field.name)) fromQuery[field.name] = query.get(field.name);
    return { ...fromQuery, ...(scope || {}) };
  }, [queryKey, scope, config.fields]);
  const filtered = useMemo(() => items.filter((item) => {
    if (Object.entries(effectiveScope).some(([key, value]) => String(item.values?.[key] ?? "") !== String(value))) return false;
    if (statusFilter !== "All" && item.values?.status !== statusFilter) return false;
    return !search || itemLabel(item).toLowerCase().includes(search.toLowerCase()) || JSON.stringify(item.values).toLowerCase().includes(search.toLowerCase());
  }), [items, search, statusFilter, effectiveScope]);
  const supportsStatus = config.fields.some((field) => field.name === "status");
  const supportsOrder = config.fields.some((field) => field.name === "order");
  const scopedEditionMemories = resource === "galleries" && effectiveScope.editionId
    ? items.find((item) => item.values?.editionId === effectiveScope.editionId && !item.values?.festivalDayId && !item.values?.activityId && !item.values?.programItemId)
    : null;
  const hasEditionFilter = resource === "days" || resource === "news";
  const editionFilter = hasEditionFilter ? searchParams.get("editionId") || "" : "";
  const editionOptions = hasEditionFilter ? [...(lookups.editions || [])].sort((a, b) => Number(b.values?.year || 0) - Number(a.values?.year || 0)) : [];
  function filterByEdition(editionId) {
    const next = new URLSearchParams(searchParams);
    if (editionId) next.set("editionId", editionId); else next.delete("editionId");
    setSearchParams(next, { replace: true });
    setNewsPage(1);
  }
  const newsPageSize = 20;
  const newsPageCount = Math.max(1, Math.ceil(filtered.length / newsPageSize));
  const displayedItems = resource === "news" ? filtered.slice((Math.min(newsPage, newsPageCount) - 1) * newsPageSize, Math.min(newsPage, newsPageCount) * newsPageSize) : filtered;
  function create() {
    const payload = emptyPayload();
    for (const field of config.fields) {
      if (field.name.startsWith("$")) continue;
      payload.values[field.name] = field.type === "checkbox" ? field.name !== "isCritical" : field.name === "status" ? "Draft" : field.options?.[0] ?? "";
    }
    Object.assign(payload.values, effectiveScope);
    if (["editions", "days", "news", "program", "activities"].includes(resource)) navigate(`/admin/${resource}/new${queryKey ? `?${queryKey}` : ""}`); else setEditing({ id: null, payload });
  }
  function edit(item) {
    if (["editions", "days", "news", "program", "activities"].includes(resource)) { navigate(`/admin/${resource}/${item.id}`); return; }
    setEditing({ id: item.id, payload: payloadFromItem(item) });
  }
  function closeEditing() {
    setEditing(null);
    if (!requestedEditId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }
  const restricted = resource === "languages" && !auth.isAdministrator;
  const canEdit = (item) => !restricted && !(resource === "settings" && item?.values?.isCritical && !auth.isAdministrator);
  async function remove(item) {
    if (!canEdit(item)) return;
    const label = itemLabel(item);
    const firstConfirmed = await dialog.confirm({ title: `Delete “${label}”?`, message: "This action cannot be undone.", confirmLabel: "Continue", tone: "danger" });
    if (!firstConfirmed) return;
    if (resource === "editions") {
      const finalConfirmed = await dialog.confirm({ title: "Delete the entire edition?", message: "Deleting this edition may also delete its festival days, plays, activities, galleries, awards, news, and other related content. Continue only if you are certain.", confirmLabel: "Delete edition", tone: "danger" });
      if (!finalConfirmed) return;
    }
    try { await adminApi.remove(resource, item.id); await load(); }
    catch (err) { await dialog.notice({ title: "Could not delete", message: err.message, tone: "danger" }); }
  }
  return <section className="admin-page">
    <PageHeader kicker={resource === "awards" ? "Festival results" : "Content"} title={title || config.title} description={description || (resource === "awards" ? "Record each edition’s award recipients and winning performances." : `Create, edit, publish and archive ${config.title.toLowerCase()}.`)} action={!restricted && <button className="admin-button admin-button--primary" onClick={() => scopedEditionMemories ? edit(scopedEditionMemories) : create()}>{scopedEditionMemories ? "Edit Memories" : `＋ Add ${resource === "galleries" && effectiveScope.editionId ? "Memories" : config.singular}`}</button>} />
    {restricted && <div className="admin-alert admin-alert--error">Only Admin and SuperAdmin accounts can change website languages.</div>}
    {resource === "homepage" && <div className="admin-callout"><div><b>Homepage editorial control</b><p>Every section is shown below, including sections currently hidden from visitors. Switch automatic sections to manual mode to choose exact featured content.</p></div><a className="admin-button" href="/admin/home-content">Edit hero & homepage text</a></div>}
    {resource === "homepage" && <HomepageLivePreview previewKey={previewKey} refresh={() => setPreviewKey((value) => value + 1)} />}
    <div className={`admin-card admin-resource-card ${resource === "homepage" ? "admin-home-sections" : ""}`}><div className="admin-toolbar"><div className="admin-list-search"><span>⌕</span><input className="admin-search" placeholder={`Search ${config.title.toLowerCase()}…`} value={search} onChange={(e) => { setSearch(e.target.value); setNewsPage(1); }} /></div>{hasEditionFilter && <label className="admin-edition-filter"><span>Edition</span><select value={editionFilter} onChange={(event) => filterByEdition(event.target.value)}><option value="">All editions</option>{editionOptions.map((item) => <option value={item.id} key={item.id}>{itemLabel(item)}{item.values?.year ? ` · ${item.values.year}` : ""}</option>)}</select></label>}{supportsStatus && <div className="admin-filter-pills" aria-label="Filter by status">{["All", "Draft", "Published", "Archived"].map((status) => <button type="button" className={statusFilter === status ? "is-active" : ""} onClick={() => { setStatusFilter(status); setNewsPage(1); }} key={status}>{status}</button>)}</div>}<span className="admin-count">{filtered.length} {filtered.length === 1 ? "item" : "items"}</span><button className="admin-button admin-button--quiet" onClick={async () => { await load(); if (resource === "homepage") setPreviewKey((value) => value + 1); }}>Refresh</button></div>
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {loading ? <div className="admin-empty">Loading…</div> : filtered.length === 0 ? <div className="admin-empty"><b>No content found</b><span>Add the first item or change your search.</span></div> : resource === "homepage" ? <HomepageSectionBoard items={displayedItems} lookups={lookups} edit={edit} /> : resource === "editions" ? <EditionCardGrid items={displayedItems} edit={edit} remove={remove} canEdit={canEdit} /> : resource === "news" ? <><AdminNewsCardGrid items={displayedItems} lookups={lookups} edit={edit} remove={remove} canEdit={canEdit} />{newsPageCount > 1 && <AdminNewsPagination page={Math.min(newsPage, newsPageCount)} pageCount={newsPageCount} onChange={setNewsPage} />}</> : <div className="admin-tablewrap"><table className="admin-table"><thead><tr><th>{resource === "awards" ? "Award" : "Content"}</th><th>Context</th><th>Status</th>{supportsOrder && <th>Order</th>}<th /></tr></thead><tbody>{displayedItems.map((item) => { const edition = editionForItem(item, lookups); const secondary = resource === "awards" ? item.values?.person || item.values?.recipient || "Winner not entered" : resource === "galleries" ? `${item.values?.mediaCount || 0} picture${item.values?.mediaCount === 1 ? "" : "s"}` : item.values?.slug || item.values?.key || item.values?.sectionKey || item.id; return <tr className={edition ? "admin-table__edition-row" : ""} style={edition ? { "--edition-row-accent": editionAccent(edition) } : undefined} key={item.id}><td><button className="admin-table__title" disabled={!canEdit(item)} onClick={() => edit(item)}>{itemLabel(item)}</button><small>{secondary}</small></td><td>{contextLabel(item, lookups)}</td><td><StatusBadge status={item.values?.status} /></td>{supportsOrder && <td>{item.values?.order ?? "—"}</td>}<td>{canEdit(item) ? <div className="admin-rowactions"><button onClick={() => edit(item)}>Edit</button><button className="is-danger" onClick={() => remove(item)}>Delete</button></div> : <small>Protected</small>}</td></tr>; })}</tbody></table></div>}
    </div>
    {editing && <ResourceEditor resource={resource} config={config} model={editing} lookups={resource === "awards" ? { ...lookups, awards: items, program: (lookups.program || []).filter((item) => item.values?.participationType === "Official Competition") } : lookups} onClose={closeEditing} onSaved={async () => { closeEditing(); await load(); if (resource === "homepage") setPreviewKey((value) => value + 1); }} />}
  </section>;
}

function AdminNewsCardGrid({ items, lookups, edit, remove, canEdit }) {
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return <div className="admin-news-grid">{items.map((item) => {
    const values = item.values || {};
    const edition = editionForItem(item, lookups);
    const accent = editionAccent(edition || { id: values.editionId });
    const cover = absoluteMediaUrl(values.coverMediaUrl);
    const date = values.date ? formatter.format(new Date(`${String(values.date).slice(0, 10)}T00:00:00Z`)) : "Date not set";
    return <article className="admin-news-card" style={{ "--news-accent": accent }} key={item.id}>
      <button className="admin-news-card__visual" type="button" disabled={!canEdit(item)} onClick={() => edit(item)} aria-label={`Edit ${itemLabel(item)}`}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="admin-news-card__fallback"><i>N</i><small>PITF NEWS</small></span>}
        <span className="admin-news-card__shade" />
        <span className="admin-news-card__status"><StatusBadge status={values.status} /></span>
        {values.category && <span className="admin-news-card__category">{values.category}</span>}
      </button>
      <div className="admin-news-card__body">
        <div className="admin-news-card__meta"><time>{date}</time><span>Order {values.order ?? "—"}</span></div>
        <button className="admin-news-card__title" type="button" disabled={!canEdit(item)} onClick={() => edit(item)}>{itemLabel(item)}</button>
        <div className="admin-news-card__context">{contextLabel(item, lookups)}</div>
        <code>{values.slug || item.id}</code>
        {canEdit(item) && <div className="admin-news-card__actions"><button type="button" onClick={() => edit(item)}>Edit article <span>→</span></button><button type="button" className="is-danger" onClick={() => remove(item)}>Delete</button></div>}
      </div>
    </article>;
  })}</div>;
}

function AdminNewsPagination({ page, pageCount, onChange }) {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, Math.max(5, page + 2));
  const pages = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  return <nav className="admin-news-pagination" aria-label="News pages">
    <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>← Previous</button>
    <div>{start > 1 && <><button type="button" onClick={() => onChange(1)}>1</button>{start > 2 && <span>…</span>}</>}{pages.map((number) => <button type="button" className={number === page ? "is-active" : ""} aria-current={number === page ? "page" : undefined} onClick={() => onChange(number)} key={number}>{number}</button>)}{end < pageCount && <>{end < pageCount - 1 && <span>…</span>}<button type="button" onClick={() => onChange(pageCount)}>{pageCount}</button></>}</div>
    <button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next →</button>
  </nav>;
}

function EditionCardGrid({ items, edit, remove, canEdit }) {
  return <div className="admin-edition-grid">{items.map((item) => {
    const values = item.values || {};
    const title = itemLabel(item);
    const hero = absoluteMediaUrl(values.heroMediaUrl);
    const identity = absoluteMediaUrl(values.identityMediaUrl);
    const editionNumber = String(values.number || "").padStart(2, "0");
    return <article className="admin-edition-card" key={item.id}>
      <button className="admin-edition-card__visual" type="button" disabled={!canEdit(item)} onClick={() => edit(item)} aria-label={`Edit ${title}`}>
        {hero ? <img className="admin-edition-card__hero" src={hero} alt="" loading="lazy" /> : <span className="admin-edition-card__fallback" />}
        <span className="admin-edition-card__shade" />
        {identity && <img className="admin-edition-card__identity" src={identity} alt={`${title} identity`} loading="lazy" />}
        <span className="admin-edition-card__number">{editionNumber}</span>
        <span className="admin-edition-card__year">{values.year}</span>
      </button>
      <div className="admin-edition-card__body">
        <div className="admin-edition-card__heading"><div><span>Edition {editionNumber}</span><button type="button" disabled={!canEdit(item)} onClick={() => edit(item)}>{title}</button></div><StatusBadge status={values.status} /></div>
        <div className="admin-edition-card__meta"><span>{editionDateRange(values.startDate, values.endDate)}</span><code>{values.slug}</code></div>
        {canEdit(item) && <div className="admin-edition-card__actions"><button type="button" onClick={() => edit(item)}>Edit edition <span>→</span></button><button type="button" className="is-danger" onClick={() => remove(item)}>Delete</button></div>}
      </div>
    </article>;
  })}</div>;
}

function editionDateRange(start, end) {
  if (!start && !end) return "Dates not set";
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const format = (value) => value ? formatter.format(new Date(`${String(value).slice(0, 10)}T00:00:00Z`)) : null;
  const first = format(start); const last = format(end);
  return first && last ? `${first} — ${last}` : first || last;
}

function EditionRelationsPanel({ editionId, section, lookups }) {
  if (!editionId) return <section className="admin-editor-section admin-edition-related admin-edition-related--locked"><span>01</span><h2>Save the edition first</h2><p>Once the edition exists, its {section.label.toLowerCase()} can be attached and managed here.</p></section>;
  const resource = section.relationResource;
  if (resource === "program") return <EditionProgramManager key={editionId} editionId={editionId} lookups={lookups} />;
  const allItems = lookups[resource] || [];
  const items = allItems.filter((item) => item.values?.editionId === editionId && (resource !== "galleries" || (!item.values?.festivalDayId && !item.values?.activityId && !item.values?.programItemId)));
  const sorted = [...items].sort((a, b) => resource === "program" || resource === "news" ? String(a.values?.startsAt || a.values?.date || "").localeCompare(String(b.values?.startsAt || b.values?.date || "")) : (a.values?.order ?? 0) - (b.values?.order ?? 0));
  const manageUrl = `/admin/${resource}?editionId=${editionId}`;
  const activities = lookups.activities || [];
  const dayGalleries = (lookups.galleries || []).filter((gallery) => gallery.values?.editionId === editionId && gallery.values?.festivalDayId);

  return <section className={`admin-editor-section admin-edition-related admin-edition-related--${resource}`}>
    <header><div><span className="admin-kicker">Edition structure</span><h2>{section.label}</h2><p>{relationHelp(resource)}</p></div><a className="admin-button admin-button--primary" href={manageUrl}>Manage {section.label.toLowerCase()} <span>→</span></a></header>
    <div className="admin-edition-related__summary"><strong>{sorted.length}</strong><span>{sorted.length === 1 ? "record" : "records"} connected to this edition</span>{resource === "days" && <small>{activities.filter((activity) => sorted.some((day) => day.id === activity.values?.festivalDayId)).length} scheduled activities</small>}{resource === "galleries" && <small>{sorted.reduce((total, gallery) => total + (gallery.mediaIds?.length || 0), 0)} selected memories</small>}</div>
    {sorted.length === 0 ? <div className="admin-edition-related__empty"><b>No {section.label.toLowerCase()} yet</b><p>This section is optional for older editions. Add it whenever material is available.</p><a href={manageUrl}>Open {section.label.toLowerCase()} manager →</a></div> : <div className="admin-edition-related__list">{sorted.map((item) => {
      const dayActivities = resource === "days" ? activities.filter((activity) => activity.values?.festivalDayId === item.id) : [];
      const dayMedia = resource === "days" ? dayGalleries.filter((gallery) => gallery.values?.festivalDayId === item.id) : [];
      const copy = item.translations?.sq || item.translations?.en || item.translations?.bs || {};
      const returnTo = encodeURIComponent(`/admin/editions/${editionId}?tab=${section.key}`);
      const editUrl = resource === "galleries" ? `/admin/galleries?editionId=${editionId}&edit=${item.id}` : `/admin/${resource}/${item.id}?returnTo=${returnTo}`;
      return <article key={item.id}><span className="admin-edition-related__index">{resource === "days" ? `D${item.values?.dayNumber || "—"}` : String((item.values?.order ?? 0) + 1).padStart(2, "0")}</span><div><h3>{itemLabel(item)}</h3><p>{relationItemMeta(resource, item)}</p>{resource === "days" && <div className="admin-edition-day-flags"><span>{dayActivities.filter((activity) => activity.values?.type === "press-conference").length} conference</span><span>{dayActivities.filter((activity) => activity.values?.programItemId).length} play</span>{dayActivities.some((activity) => ["opening-ceremony", "closing-ceremony"].includes(activity.values?.type)) && <span className="is-special">Ceremony</span>}<span>{dayActivities.filter((activity) => !["press-conference", "opening-ceremony", "closing-ceremony"].includes(activity.values?.type) && !activity.values?.programItemId).length} other</span><span>{dayMedia.reduce((total, gallery) => total + (gallery.mediaIds?.length || 0), 0)} media</span><span className={copy.conclusion ? "is-ready" : "is-missing"}>{copy.conclusion ? "Conclusion ready" : "Conclusion missing"}</span></div>}</div><div className="admin-edition-related__actions"><StatusBadge status={item.values?.status} /><a href={editUrl}>Edit {resource === "days" ? "day" : "item"} <span>→</span></a></div></article>;
    })}</div>}
  </section>;
}

function EditionProgramManager({ editionId, lookups }) {
  const navigate = useNavigate();
  const dialog = useAdminDialog();
  const editionDays = (lookups.days || []).filter((day) => day.values?.editionId === editionId).sort((a, b) => String(a.values?.date || "").localeCompare(String(b.values?.date || "")));
  const [program, setProgram] = useState(() => (lookups.program || []).filter((item) => item.values?.editionId === editionId));
  const [activities, setActivities] = useState(() => (lookups.activities || []).filter((item) => editionDays.some((day) => day.id === item.values?.festivalDayId)));
  const [editor, setEditor] = useState(null);
  const [language, setLanguage] = useState("sq");
  const [mediaPicker, setMediaPicker] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function begin(resource, item = null) {
    const config = resourceConfig[resource];
    const payload = item ? payloadFromItem(item) : makeNewModel(config).payload;
    if (!item && resource === "program") payload.values.editionId = editionId;
    if (!item && resource === "activities") { payload.values.festivalDayId = editionDays[0]?.id || null; payload.values.type = "opening-ceremony"; }
    setLanguage(resource === "activities" ? "en" : "sq"); setError(""); setEditor({ resource, id: item?.id || null, payload });
  }
  function updatePayload(change) { setEditor((current) => ({ ...current, payload: change(current.payload) })); }
  function setValue(name, value) { updatePayload((payload) => ({ ...payload, values: { ...payload.values, [name]: value } })); }
  function setTranslation(field, value) { updatePayload((payload) => ({ ...payload, translations: { ...payload.translations, [language]: { ...(payload.translations[language] || {}), [field]: value } } })); }
  async function saveChild() {
    setBusy(true); setError("");
    try {
      const saved = await adminApi.save(editor.resource, { id: editor.id, payload: editor.payload });
      const [programResult, activityResult] = await Promise.all([adminApi.list("program"), adminApi.list("activities")]);
      const savedId = editor.id || saved?.id;
      const savedItems = editor.resource === "activities" ? activityResult.items : programResult.items;
      if (!savedId || !(savedItems || []).some((item) => item.id === savedId)) throw new Error(`The ${editor.resource === "activities" ? "ceremony" : "performance"} was not returned after saving. Please try again.`);
      setProgram((programResult.items || []).filter((item) => item.values?.editionId === editionId));
      setActivities((activityResult.items || []).filter((item) => editionDays.some((day) => day.id === item.values?.festivalDayId)));
      setEditor(null);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function removeEntry(entry) {
    const label = itemLabel(entry.item);
    if (!await dialog.confirm({ title: `Delete “${label}”?`, message: "This action cannot be undone.", confirmLabel: "Delete", tone: "danger" })) return;
    setBusy(true); setError("");
    try {
      await adminApi.remove(entry.kind, entry.item.id);
      if (entry.kind === "program") setProgram((items) => items.filter((item) => item.id !== entry.item.id));
      else setActivities((items) => items.filter((item) => item.id !== entry.item.id));
      if (editor?.id === entry.item.id) setEditor(null);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  function applyMedia(ids) { setValue(mediaPicker.field, ids[0] || null); setMediaPicker(null); }

  const dayById = new Map(editionDays.map((day) => [day.id, day]));
  // Program is intentionally limited to performances and the two ceremonies.
  // Conferences, after-parties and other activities belong to their day page.
  const ceremonyTypes = new Set(["opening-ceremony", "closing-ceremony", "award-ceremony"]);
  const specialActivities = activities.filter((activity) => ceremonyTypes.has(activity.values?.type));
  const schedule = [
    ...program.map((item) => ({ kind: "program", item, order: Number(item.values?.order || 0), chronology: item.values?.startsAt || "9999", date: item.values?.startsAt, type: item.values?.participationType || "Official Competition" })),
    ...specialActivities.map((item) => { const day = dayById.get(item.values?.festivalDayId); return { kind: "activities", item, order: Number(item.values?.order || 0), chronology: `${day?.values?.date || "9999"}T${item.values?.startTime || "23:59"}`, date: day?.values?.date, type: pretty(item.values?.type || "activity") }; }),
  ].sort(scheduleEntryCompare);

  const editorConfig = editor ? resourceConfig[editor.resource] : null;
  const editorFields = (editorConfig?.fields.filter((field) => !["editionId", "publishedAt"].includes(field.name)) || []).map((field) => {
    if (editor?.resource === "activities" && field.name === "type") return { ...field, options: ["opening-ceremony", "closing-ceremony", "award-ceremony"] };
    return field;
  });
  const editorTranslations = editorConfig?.translations || [];
  const editorLookups = { ...lookups, program, days: editionDays };

  if (editor?.resource === "activities") return <section className="admin-editor-section admin-edition-program-manager">
    <header><div><span className="admin-kicker">Festival ceremony</span><h2>{editor.id ? "Edit ceremony" : "Add ceremony"}</h2><p>Complete the ceremony details and translations. The program will return after you save or cancel.</p></div><button type="button" className="admin-button admin-button--quiet" onClick={() => setEditor(null)}>Cancel</button></header>
    {error && <div className="admin-alert admin-alert--error">{error}</div>}
    <section className="admin-formsection admin-standard-card"><div className="admin-standard-card__head"><div><span className="admin-kicker">Schedule</span><h2>Ceremony details</h2><p>Choose a day from this edition, the ceremony type, time and venue.</p></div></div><div className="admin-fieldgrid">{editorFields.map((field) => <Field key={field.name} field={field} payload={editor.payload} value={editor.payload.values[field.name]} setValue={(next) => setValue(field.name, next)} lookups={editorLookups} openMedia={(multiple = false) => setMediaPicker({ field: field.name, multiple })} setPayload={updatePayload} selectionIds={() => []} setSelectionIds={() => {}} />)}</div></section>
    <section className="admin-formsection admin-standard-card"><div className="admin-standard-card__head"><div><span className="admin-kicker">Public text</span><h2>Text & translations</h2><p>Enter the ceremony text in each available website language.</p></div><LanguageTabs language={language} setLanguage={setLanguage} translations={editor.payload.translations} field="title" /></div><div className="admin-translation-fields">{editorTranslations.map((field) => <label key={`${language}-${field}`}>{pretty(field)}{["description", "body"].includes(field) ? <textarea rows={field === "body" ? 9 : 5} value={editor.payload.translations?.[language]?.[field] || ""} onChange={(event) => setTranslation(field, event.target.value)} /> : <input value={editor.payload.translations?.[language]?.[field] || ""} onChange={(event) => setTranslation(field, event.target.value)} />}</label>)}</div></section>
    <footer className="admin-sticky-save"><span>{editor.id ? "Editing ceremony" : "New ceremony"}</span><button type="button" className="admin-button admin-button--quiet" onClick={() => setEditor(null)}>Cancel</button><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={saveChild}>{busy ? "Saving…" : editor.id ? "Save changes" : "Create ceremony"}</button></footer>
    {mediaPicker && <MediaPicker open initial={[editor.payload.values[mediaPicker.field]]} onClose={() => setMediaPicker(null)} onSelect={applyMedia} />}
  </section>;

  return <section className="admin-editor-section admin-edition-program-manager">
    <header><div><span className="admin-kicker">Edition schedule</span><h2>Program & ceremonies</h2><p>Plays and ceremonies are kept in this schedule. Conferences, after-parties and other activities are managed inside each festival day.</p></div><div><button type="button" className="admin-button admin-button--primary" onClick={() => navigate(`/admin/program/new?editionId=${editionId}&returnTo=${encodeURIComponent(`/admin/editions/${editionId}?tab=program`)}`)}>＋ Add performance</button><button type="button" className="admin-button" onClick={() => begin("activities")} disabled={!editionDays.length}>＋ Add ceremony</button></div></header>
    {!editionDays.length && <div className="admin-alert">Create the festival days first before adding ceremonies, conferences or after-parties.</div>}
    <div className="admin-edition-schedule">{schedule.length === 0 ? <div className="admin-edition-related__empty"><b>No program entries yet</b><p>Add performances, then place the opening and closing ceremonies around them.</p></div> : schedule.map((entry) => { const item = entry.item; const values = item.values || {}; const returnTo = encodeURIComponent(`/admin/editions/${editionId}?tab=program`); const playUrl = `/admin/program/${item.id}?returnTo=${returnTo}`; const ceremonyUrl = `/admin/activities/${item.id}?returnTo=${returnTo}`; return <article className={`is-${entry.kind}`} key={`${entry.kind}-${item.id}`}><time><b>{scheduleDate(entry.date)}</b><span>{entry.kind === "program" ? scheduleTime(values.startsAt) : String(values.startTime || "—").slice(0, 5)}</span></time><div><span className="admin-edition-schedule__type">{entry.type}</span><h3>{entry.kind === "program" ? <a href={playUrl}>{itemLabel(item)}</a> : <a href={ceremonyUrl}>{itemLabel(item)}</a>}</h3><p>{entry.kind === "program" ? [translatedItemField(item, "company", language), values.venue, translatedItemField(item, "country", language)].filter(Boolean).join(" · ") : [values.venue, dayById.get(values.festivalDayId)?.values?.date].filter(Boolean).join(" · ")}</p></div><div className="admin-edition-schedule__actions">{entry.kind === "program" ? <a className="admin-edition-schedule__action" href={playUrl}>Open play →</a> : <a className="admin-edition-schedule__action" href={ceremonyUrl}>Edit ceremony →</a>}<button type="button" className="is-danger" disabled={busy} onClick={() => removeEntry(entry)}>Delete</button></div></article>; })}</div>
    {mediaPicker && <MediaPicker open initial={[editor.payload.values[mediaPicker.field]]} onClose={() => setMediaPicker(null)} onSelect={applyMedia} />}
  </section>;
}

function scheduleDate(value) { if (!value) return "Date TBA"; return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function scheduleTime(value) { return value ? String(value).slice(11, 16) : "—"; }
function scheduleEntryCompare(a, b) { const aOrdered = a.order > 0; const bOrdered = b.order > 0; if (aOrdered && bOrdered && a.order !== b.order) return a.order - b.order; if (aOrdered !== bOrdered) return aOrdered ? -1 : 1; return String(a.chronology).localeCompare(String(b.chronology)); }
function translatedItemField(item, field, language = "sq") { return item.translations?.[language]?.[field] || item.translations?.sq?.[field] || item.translations?.en?.[field] || item.translations?.bs?.[field] || item.values?.[field] || ""; }

function relationHelp(resource) {
  return {
    program: "Performances and their schedule, theatre, synopsis, cast, poster and trailer.",
    days: "Each day can contain a conference, linked play, after-party, ceremonies, other activities, media and a conclusion.",
    awards: "Winners, award categories, related plays, countries and optional winner media.",
    news: "Articles remain reusable in News while being explicitly connected to this edition.",
    galleries: "One general Memories collection is used on the edition page. Day photographs are managed inside each Festival Day instead.",
  }[resource] || "Content connected to this edition.";
}

function relationItemMeta(resource, item) {
  const values = item.values || {};
  if (resource === "program") return [values.startsAt ? new Date(values.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Date not set", values.venue, translatedItemField(item, "country")].filter(Boolean).join(" · ");
  if (resource === "days") return values.date ? new Date(`${values.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date not set";
  if (resource === "awards") return [values.person || values.recipient, values.country].filter(Boolean).join(" · ");
  if (resource === "news") return [values.date, values.category || "News"].filter(Boolean).join(" · ");
  if (resource === "galleries") return `${item.mediaIds?.length || 0} selected media items`;
  return "";
}

export function ResourceEditorPage({ resource }) {
  const config = resourceConfig[resource];
  const dialog = useAdminDialog();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const [model, setModel] = useState(() => id === "new" ? makeNewEditorModel(config, searchParams) : null);
  const [lookups, setLookups] = useState({});
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get("tab");
    return editorBlueprints[resource]?.some((entry) => entry.key === requestedTab) ? requestedTab : editorBlueprints[resource]?.[0]?.key;
  });
  const [language, setLanguage] = useState(["days", "activities"].includes(resource) ? "en" : "sq");
  const [mediaPicker, setMediaPicker] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setError("");
    if (id === "new") setModel(makeNewEditorModel(config, new URLSearchParams(queryKey)));
    else setModel(null);
    const workspaceResources = resource === "editions" ? ["program", "days", "activities", "awards", "news", "galleries"] : resource === "days" ? ["activities", "galleries", "program"] : [];
    const related = [...new Set([...config.fields.filter((field) => field.resource).map((field) => field.resource), ...workspaceResources])];
    Promise.all([
      id === "new" ? Promise.resolve(null) : adminApi.list(resource),
      ...related.map(async (name) => {
        try { return [name, (await adminApi.list(name)).items || []]; }
        catch { return [name, []]; }
      }),
    ]).then(([result, ...pairs]) => {
      if (!active) return;
      setLookups(Object.fromEntries(pairs));
      if (id !== "new") {
        const item = result?.items?.find((entry) => entry.id === id);
        if (!item) throw new Error(`${config.singular} could not be found.`);
        const payload = payloadFromItem(item);
        setModel({ id: item.id, payload, originalPayload: clone(payload) });
      }
    }).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [resource, id, queryKey]);
  if (error && !model) return <section className="admin-request-state"><span>!</span><h1>Content unavailable</h1><p>{error}</p><button className="admin-button" onClick={() => navigate(`/admin/${resource}`)}>Back to {config.title}</button></section>;
  if (!model) return <section className="admin-editor-loading"><i /><i /><i /><i /></section>;
  const payload = model.payload;
  const blueprint = editorBlueprints[resource];
  const section = blueprint.find((entry) => entry.key === activeTab) || blueprint[0];
  const translationFields = resource === "awards" ? [] : [...new Set([...config.translations, ...Object.values(payload.translations).flatMap((entry) => Object.keys(entry || {}))])];
  const sectionTranslationFields = section.translationFields || translationFields;
  const isProgramDetails = resource === "program" && section.key === "details";
  const isNewsWriting = resource === "news" && section.translations;
  const displayedTranslationFields = isProgramDetails || isNewsWriting ? [] : sectionTranslationFields;
  const dirty = JSON.stringify(payload) !== JSON.stringify(model.originalPayload);
  const isCeremonyEditor = resource === "activities" && (["opening-ceremony", "closing-ceremony", "award-ceremony"].includes(payload.values.type) || searchParams.get("returnTo")?.includes("/admin/editions/"));
  const visibleFields = section.fields ? config.fields.filter((field) => section.fields.includes(field.name)).filter((field) => resource !== "news" || payload.values.contentMode === "External" || !["externalUrl", "externalTarget"].includes(field.name)).map((field) => isCeremonyEditor && field.name === "type" ? { ...field, options: ["opening-ceremony", "closing-ceremony", "award-ceremony"] } : field) : [];
  const translatedTitle = resource === "days"
    ? payload.translations?.en?.title || `Day ${payload.values?.dayNumber || ""}`.trim()
    : payload.translations?.sq?.title || payload.translations?.en?.title || payload.values?.slug;
  const status = payload.values?.status || (resource === "days" ? null : "Draft");
  const publicationChecks = resource === "editions"
    ? [{ label: "Header introduction", complete: Boolean(payload.translations?.sq?.headerDescription || payload.translations?.en?.headerDescription || payload.translations?.sq?.description || payload.translations?.en?.description), tab: "intro" }, { label: "Edition story", complete: Boolean(payload.translations?.sq?.storyDescription || payload.translations?.en?.storyDescription), tab: "intro" }, { label: "Festival dates", complete: Boolean(payload.values.startDate && payload.values.endDate), tab: "overview" }, { label: "Editions page banner", complete: Boolean(payload.values.heroMediaId), tab: "overview" }, { label: "Edition page header", complete: Boolean(payload.values.detailHeaderMediaId), tab: "overview", optional: true }, { label: "Edition logo", complete: Boolean(payload.values.backgroundMediaId), tab: "overview", optional: true }, { label: "Edition recap", complete: Boolean(payload.values.recapMediaId), tab: "recap", optional: true }]
    : resource === "days"
      ? [{ label: "Day page", complete: Boolean(payload.values.isPageEnabled), tab: "header" }, { label: "Header", complete: Boolean(payload.values.isHeaderVisible), tab: "header", optional: true }, { label: "Conference", complete: Boolean(payload.values.isConferenceVisible), tab: "conference", optional: true }, { label: "Play / ceremony", complete: Boolean(payload.values.isPlayVisible), tab: "play", optional: true }, { label: "Recap", complete: Boolean(payload.values.isRecapVisible), tab: "recap", optional: true }, { label: "Memories", complete: Boolean(payload.values.isMemoriesVisible), tab: "memories", optional: true }]
    : resource === "news"
      ? [{ label: "Albanian content", complete: Boolean(payload.translations?.sq?.title && payload.translations?.sq?.summary && (payload.values.contentMode === "External" || payload.translations?.sq?.body)), tab: "article" }, { label: "English content", complete: Boolean(payload.translations?.en?.title && payload.translations?.en?.summary && (payload.values.contentMode === "External" || payload.translations?.en?.body)), tab: "article" }, { label: "Cover media", complete: Boolean(payload.values.coverMediaId || payload.mediaIds?.length), tab: "article", optional: true }]
    : resource === "activities"
      ? [{ label: "Ceremony title", complete: Boolean(payload.translations?.sq?.title || payload.translations?.en?.title || payload.translations?.bs?.title), tab: "translations" }, { label: "Festival day", complete: Boolean(payload.values.festivalDayId), tab: "details" }, { label: "Start time", complete: Boolean(payload.values.startTime), tab: "details" }, { label: "Venue", complete: Boolean(payload.values.venue), tab: "details", optional: true }]
      : [{ label: "Play title", complete: Boolean(payload.translations?.sq?.title || payload.translations?.en?.title), tab: "content" }, { label: "Schedule", complete: Boolean(payload.values.startsAt), tab: "details" }, { label: "Synopsis", complete: Boolean(payload.translations?.sq?.synopsis || payload.translations?.en?.synopsis), tab: "content", optional: true }, { label: "Poster", complete: Boolean(payload.values.posterMediaId), tab: "media", optional: true }];
  const editorKicker = resource === "editions" ? "Festival edition" : resource === "days" ? "Festival day" : resource === "news" ? "Newsroom" : resource === "activities" ? "Festival ceremony" : "Festival program";
  const editorDescription = resource === "editions" ? "Shape the edition identity, public introduction, media and publishing settings in one workspace." : resource === "days" ? "Organise the day story, schedule, special ceremonies, conclusion and recap media." : resource === "news" ? "Write the story, arrange its media and decide when it becomes public." : resource === "activities" ? "Manage the ceremony schedule and translated public text." : "Manage production information, synopsis, cast, poster and publication.";
  const readinessTitle = resource === "editions" ? "Edition readiness" : resource === "days" ? "Day readiness" : resource === "news" ? "Article readiness" : resource === "activities" ? "Ceremony readiness" : "Play readiness";
  const requestedReturn = searchParams.get("returnTo");
  const returnTarget = requestedReturn?.startsWith("/admin/") ? requestedReturn : `/admin/${resource}`;
  function updatePayload(change) { setModel((current) => ({ ...current, payload: change(current.payload) })); }
  function value(name, next) {
    updatePayload((current) => {
      if (resource !== "editions" || name !== "number") return { ...current, values: { ...current.values, [name]: next } };
      const previousNumber = current.values.number;
      const translations = { ...current.translations };
      for (const code of ["sq", "en"]) {
        const currentTitle = current.translations?.[code]?.title || "";
        const previousDefault = editionTitleForNumber(code, previousNumber);
        if (!currentTitle || currentTitle === previousDefault) {
          translations[code] = { ...(translations[code] || {}), title: editionTitleForNumber(code, next) };
        }
      }
      return { ...current, values: { ...current.values, [name]: next, slug: next ? `edition-${next}` : "" }, translations };
    });
  }
  function translation(field, next) {
    updatePayload((current) => {
      const translations = { ...current.translations, [language]: { ...(current.translations[language] || {}), [field]: next } };
      const shouldGenerateSlug = (resource === "program" || resource === "news") && field === "title" && (language === "sq" || !current.translations?.sq?.title) && (!model.id || !current.values.slug);
      return { ...current, translations, values: shouldGenerateSlug ? { ...current.values, slug: slugify(next) } : current.values };
    });
  }
  function selectionIds(type) { return payload.selections.filter((entry) => entry.entityType === type).map((entry) => entry.entityId); }
  function setSelectionIds(type, ids) { updatePayload((current) => ({ ...current, selections: [...current.selections.filter((entry) => entry.entityType !== type), ...ids.map((entityId) => ({ entityType: type, entityId }))] })); }
  function applyMedia(ids, uploadedIds = []) {
    updatePayload((current) => ({ ...current, uploadedMediaIds: [...new Set([...(current.uploadedMediaIds || []), ...uploadedIds])] }));
    if (mediaPicker.field.endsWith("MediaIdsJson")) value(mediaPicker.field, JSON.stringify(ids));
    else if (mediaPicker.multiple) updatePayload((current) => ({ ...current, mediaIds: ids }));
    else if (resource === "news" && mediaPicker.field === "coverMediaId") {
      const coverMediaId = ids[0] || null;
      updatePayload((current) => ({
        ...current,
        values: { ...current.values, coverMediaId },
        mediaIds: coverMediaId
          ? [...new Set([coverMediaId, ...(current.mediaIds || [])])]
          : current.mediaIds || [],
      }));
    }
    else value(mediaPicker.field, ids[0] || null);
    setMediaPicker(null);
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      let savePayload = payload;
      if (resource === "days" || resource === "program") {
        const edition = (lookups.editions || []).find((item) => item.id === payload.values.editionId);
        const scheduledValue = resource === "days" ? payload.values.date : payload.values.startsAt;
        const scheduledDate = String(scheduledValue || "").slice(0, 10);
        const startDate = String(edition?.values?.startDate || "").slice(0, 10);
        const endDate = String(edition?.values?.endDate || "").slice(0, 10);
        if (scheduledDate && ((startDate && scheduledDate < startDate) || (endDate && scheduledDate > endDate))) {
          setActiveTab(resource === "days" ? "header" : "details");
          throw new Error(`Choose a date between ${startDate} and ${endDate} for this edition.`);
        }
      }
      if (resource === "editions") {
        if (!payload.values.number) throw new Error("Add the edition number before saving.");
        savePayload = { ...payload, values: { ...payload.values, slug: payload.values.slug || `edition-${payload.values.number}` } };
      }
      if (resource === "news") {
        const translations = Object.fromEntries(Object.entries(payload.translations).map(([code, fields]) => [code, { ...fields, slug: fields.slug || slugify(fields.title) }]));
        const canonicalSlug = translations.sq?.slug || translations.en?.slug || payload.values.slug;
        if (!canonicalSlug) throw new Error("Add a title and slug in at least one language before saving.");
        savePayload = { ...payload, translations, values: { ...payload.values, slug: canonicalSlug } };
      }
      if (resource === "program") {
        const title = payload.translations?.sq?.title || payload.translations?.en?.title || payload.translations?.bs?.title;
        if (!title?.trim()) { setActiveTab("details"); throw new Error("Add the play title in at least one language before saving."); }
        const credits = parseCredits(payload.values.credits).map((entry) => ({ role: entry.role.trim(), name: entry.name.trim() })).filter((entry) => entry.role || entry.name);
        savePayload = { ...payload, values: { ...payload.values, slug: slugify(title), credits: credits.length ? JSON.stringify(credits) : "" } };
      }
      await adminApi.save(resource, { id: model.id, payload: savePayload }); navigate(returnTarget);
    }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function deleteCurrent() {
    if (!model.id || !await dialog.confirm({ title: `Delete “${translatedTitle || config.singular}”?`, message: "This action cannot be undone.", confirmLabel: "Delete", tone: "danger" })) return;
    setBusy(true); setError("");
    try { await adminApi.remove(resource, model.id); navigate(returnTarget); }
    catch (reason) { setError(reason.message); setBusy(false); }
  }
  const isWideEditionWorkspace = (resource === "editions" && ["program", "days"].includes(section.key)) || resource === "news";
  return <section className={`admin-page admin-content-editor${resource === "news" ? " admin-content-editor--news" : ""}`}>
    <PageHeader kicker={editorKicker} title={translatedTitle || (resource === "activities" ? "New ceremony" : `New ${config.singular.toLowerCase()}`)} description={editorDescription} action={<div className="admin-page-actions"><button className="admin-button admin-button--quiet" type="button" onClick={() => navigate(returnTarget)}>{requestedReturn ? "Back to edition" : "Back to list"}</button>{resource === "program" && model.id && <button className="admin-button admin-button--danger" type="button" disabled={busy} onClick={deleteCurrent}>Delete play</button>}{status && <StatusBadge status={status} />}</div>} />
    <div className={`admin-editor-workbench${resource === "news" ? " admin-editor-workbench--news" : ""}`}>{resource !== "news" && <nav className="admin-editor-tabs" aria-label="Editor sections">{blueprint.map((entry, index) => <button type="button" className={activeTab === entry.key ? "is-active" : ""} onClick={() => setActiveTab(entry.key)} key={entry.key}><span>{String(index + 1).padStart(2, "0")}</span><b>{entry.label}</b><small>{entry.description}</small></button>)}</nav>}
    <form className="admin-editor-pageform" onSubmit={save}>
      <div className={`admin-editor-pagegrid${isWideEditionWorkspace ? " admin-editor-pagegrid--wide" : ""}`}><div className="admin-editor-pagegrid__main">
        {error && <div className="admin-alert admin-alert--error">{error}</div>}
        {(visibleFields.length > 0 || section.translations || isProgramDetails) && <section className={`admin-formsection admin-editor-section admin-standard-card${isNewsWriting ? " admin-news-writing" : ""}`}><div className="admin-standard-card__head"><div><span className="admin-kicker">{editorKicker}</span><h2>{section.label}</h2><p>{isNewsWriting ? "Write the Albanian and English versions together. Each language is saved independently." : section.description}</p></div>{isNewsWriting ? <span className="admin-bilingual-badge">SQ + EN</span> : section.translations && <LanguageTabs language={language} setLanguage={setLanguage} translations={payload.translations} field={isProgramDetails ? "title" : undefined} />}</div>{isProgramDetails && <div className="admin-translation-fields admin-program-title-inline"><label>Title ({languageName(language)})<small className="admin-required-hint">Required in at least one language · the URL slug is generated automatically</small><input required={!(["sq", "en", "bs"].some((code) => code !== language && payload.translations?.[code]?.title?.trim()))} autoFocus value={payload.translations[language]?.title || ""} onChange={(event) => translation("title", event.target.value)} /></label><label>Country ({languageName(language)})<input value={payload.translations[language]?.country ?? (language === "en" ? payload.values.country || "" : "")} onChange={(event) => translation("country", event.target.value)} /></label><label>Theatre / company ({languageName(language)})<input value={payload.translations[language]?.company ?? (language === "en" ? payload.values.company || "" : "")} onChange={(event) => translation("company", event.target.value)} /></label></div>}{visibleFields.length > 0 && <div className="admin-fieldgrid">{visibleFields.map((field) => <Field key={field.name} field={field} payload={payload} value={payload.values[field.name]} setValue={(next) => value(field.name, next)} lookups={lookups} openMedia={(multiple = false) => setMediaPicker({ field: field.name, multiple })} setPayload={(updater) => updatePayload(updater)} selectionIds={selectionIds} setSelectionIds={setSelectionIds} />)}</div>}{isNewsWriting && <NewsBilingualEditor payload={payload} updatePayload={updatePayload} />}{section.translations && displayedTranslationFields.length > 0 && <div className="admin-translation-fields">{displayedTranslationFields.map((field) => <label key={`${language}-${field}`}>{pretty(field)}{config.rich?.includes(field) ? <RichText value={payload.translations[language]?.[field] || ""} onChange={(next) => translation(field, next)} /> : ["body", "description", "text", "synopsis", "summary"].some((name) => field.toLowerCase().includes(name)) ? <textarea rows={field.toLowerCase().includes("body") ? 11 : 7} value={payload.translations[language]?.[field] || ""} onChange={(event) => translation(field, event.target.value)} /> : <input value={payload.translations[language]?.[field] || ""} onChange={(event) => translation(field, event.target.value)} />}</label>)}</div>}</section>}
        {resource === "editions" && section.relationResource && <EditionRelationsPanel editionId={model.id} section={section} lookups={lookups} />}
        {resource === "days" && section.relationResource && <DayRelationsPanel dayId={model.id} editionId={payload.values.editionId} section={section} lookups={lookups} />}
        {resource === "news" && <NewsArticleWorkspace config={config} payload={payload} lookups={lookups} value={value} updatePayload={updatePayload} openMedia={(field, multiple = false) => setMediaPicker({ field, multiple })} selectionIds={selectionIds} setSelectionIds={setSelectionIds} />}
        {resource === "program" && section.key === "media" && !model.id && <section className="admin-formsection admin-program-gallery admin-standard-card"><div className="admin-program-gallery__head"><div><span className="admin-kicker">Play media</span><h2>Play photographs</h2><p>Add the photographs for this play before creating the program item.</p></div><button type="button" className="admin-button admin-button--primary" onClick={() => setMediaPicker({ field: "$mediaIds", multiple: true })}>Add photographs</button></div><DayMediaPreview ids={payload.mediaIds} setIds={(mediaIds) => updatePayload((current) => ({ ...current, mediaIds }))} /></section>}
        {resource === "program" && section.key === "media" && model.id && <ProgramMediaPanel programId={model.id} editionId={payload.values.editionId} posterMediaId={payload.values.posterMediaId} onSelectPoster={(id) => value("posterMediaId", id)} />}
      </div>{resource === "editions" ? <EditionEditorPreview payload={payload} language={language} checks={publicationChecks} setActiveTab={setActiveTab} status={status} /> : resource === "days" ? <DayEditorPreview payload={payload} language={language} checks={publicationChecks} setActiveTab={setActiveTab} lookups={lookups} dayId={model.id} /> : <aside className="admin-editor-summary"><span className="admin-kicker">Publication check</span><h3>{readinessTitle}</h3><p>Use this checklist to see what is ready before publishing.</p><div>{publicationChecks.map((check) => <button type="button" className={check.complete ? "is-complete" : ""} onClick={() => setActiveTab(check.tab)} key={check.label}><i>{check.complete ? "✓" : "!"}</i><span><b>{check.label}</b><small>{check.complete ? "Ready" : check.optional ? "Recommended" : "Required"}</small></span></button>)}</div><hr /><StatusBadge status={status} /><small>{status === "Published" ? "This content is visible on the public website." : "This content remains hidden until it is published."}</small></aside>}</div>
      <footer className="admin-sticky-save"><span className={dirty ? "is-unsaved" : "is-saved"}>{dirty ? "Unsaved changes" : "No changes yet"}</span><button type="button" className="admin-button admin-button--quiet" onClick={() => navigate(returnTarget)}>Cancel</button><button className="admin-button admin-button--primary" disabled={busy}>{busy ? "Saving…" : model.id ? "Save changes" : `Create ${config.singular.toLowerCase()}`}</button></footer>
    </form>
    </div>
    {mediaPicker && <MediaPicker open uploadContext={editorUploadContext(resource, model, payload, mediaPicker.field)} multiple={mediaPicker.multiple} initial={mediaPicker.field.endsWith("MediaIdsJson") ? parseMediaIds(payload.values[mediaPicker.field]) : mediaPicker.multiple ? payload.mediaIds : [payload.values[mediaPicker.field]]} onClose={() => setMediaPicker(null)} onSelect={applyMedia} />}
  </section>;
}

function EditionEditorPreview({ payload, language, checks, setActiveTab, status }) {
  const values = payload.values || {};
  const translated = payload.translations?.[language] || {};
  const fallbackTranslation = payload.translations?.en || payload.translations?.sq || payload.translations?.bs || {};
  const content = { ...fallbackTranslation, ...translated };
  const [media, setMedia] = useState({});

  useEffect(() => {
    let active = true;
    const requestedIds = [values.heroMediaId, values.detailHeaderMediaId, values.backgroundMediaId, values.recapMediaId].filter(Boolean);
    Promise.all(requestedIds.map(async (mediaId) => {
      try { return [mediaId, await adminApi.mediaItem(mediaId)]; }
      catch { return [mediaId, null]; }
    })).then((entries) => { if (active) setMedia(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [values.heroMediaId, values.detailHeaderMediaId, values.backgroundMediaId, values.recapMediaId]);

  const hero = media[values.heroMediaId];
  const detailHeader = media[values.detailHeaderMediaId];
  const identity = media[values.backgroundMediaId];
  const recap = media[values.recapMediaId];
  const title = content.title || values.slug || "Edition title";
  const description = stripMarkup(content.headerDescription || content.description || "Your edition introduction will appear here as you write it.");
  const number = String(values.number || "").padStart(2, "0");
  const previewUrl = values.slug ? `/editions/${values.slug}` : null;

  return <aside className="admin-edition-editor-preview">
    <div className="admin-edition-preview__head"><div><span className="admin-kicker">Live content preview</span><h3>{title}</h3></div><span>{language.toUpperCase()}</span></div>
    <div className="admin-edition-preview__hero">
      {hero && mediaPreviewUrl(hero) ? <img src={mediaPreviewUrl(hero)} alt="" /> : <span className="admin-edition-preview__empty">Choose a banner</span>}
      <i />
      {identity && mediaPreviewUrl(identity) && <img className="admin-edition-preview__logo" src={mediaPreviewUrl(identity)} alt="Edition logo" />}
      <b>{number || "00"}</b><small>{values.year || "Year"}</small>
    </div>
    <div className="admin-edition-preview__copy"><span>Edition {number || "—"}</span><h4>{title}</h4><strong>{editionDateRange(values.startDate, values.endDate)}</strong><p>{description}</p></div>
    <div className="admin-edition-preview__media">
      <EditionMediaPreview label="Listing banner" item={hero} />
      <EditionMediaPreview label="Page header" item={detailHeader} />
      <EditionMediaPreview label="Edition logo" item={identity} />
      <EditionMediaPreview label="Recap media" item={recap} />
    </div>
    <div className="admin-edition-preview__checks"><span className="admin-kicker">Publication check</span>{checks.map((check) => <button type="button" className={check.complete ? "is-complete" : ""} onClick={() => setActiveTab(check.tab)} key={check.label}><i>{check.complete ? "✓" : "!"}</i><span><b>{check.label}</b><small>{check.complete ? "Ready" : check.optional ? "Recommended" : "Required"}</small></span></button>)}</div>
    <div className="admin-edition-preview__foot"><StatusBadge status={status} />{previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Open website preview ↗</a>}</div>
  </aside>;
}

function ProgramMediaPanel({ programId, editionId, posterMediaId, onSelectPoster }) {
  const fileInput = useRef(null);
  const dialog = useAdminDialog();
  const [media, setMedia] = useState([]);
  const [editing, setEditing] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!programId) return;
    try {
      const result = await adminApi.media({ programItemId: programId, type: "Image", pageSize: 200, sort: "name-asc" });
      setMedia(result.items || []);
    } catch (reason) { setError(reason.message); }
  }
  useEffect(() => {
    let active = true;
    if (!programId) return () => { active = false; };
    adminApi.media({ programItemId: programId, type: "Image", pageSize: 200, sort: "name-asc" }).then((result) => { if (active) setMedia(result.items || []); }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [programId]);

  function mediaPayload(item, overrides = {}) {
    return { alt: item.alt || null, caption: item.caption || null, credit: item.credit || null, folderId: item.folder?.id || null, posterUrl: item.videoPosterUrl || null, year: item.year || null, editionId: item.editionId || editionId || null, category: item.category || "performance", tags: item.tags || null, festivalDayId: item.festivalDayId || null, programItemId: item.programItemId || null, ...overrides };
  }
  async function upload(files) {
    if (!files?.length) return;
    setBusy(true); setError("");
    try {
      const uploaded = await adminApi.upload(files, { source: "program", editionId, programItemId: programId, category: "performance" });
      await Promise.all((uploaded || []).filter((item) => item.programItemId !== programId).map((item) => adminApi.updateMedia(item.id, mediaPayload(item, { editionId: item.editionId || editionId || null, programItemId: programId, category: item.category === "other" ? "performance" : item.category }))));
      await load();
    }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function attachExisting(ids) {
    setBusy(true); setError("");
    try {
      const items = await Promise.all(ids.map((id) => adminApi.mediaItem(id)));
      await Promise.all(items.filter((item) => item.type === "image").map((item) => adminApi.updateMedia(item.id, mediaPayload(item, { editionId: item.editionId || editionId || null, programItemId: programId, category: item.category === "other" ? "performance" : item.category }))));
      setPickerOpen(false); await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function savePhoto(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await adminApi.updateMedia(editing.id, mediaPayload(editing, { programItemId: programId })); setEditing(null); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function removeFromPlay(item) {
    if (!await dialog.confirm({ title: "Remove photograph from play?", message: `“${item.originalFilename}” will remain available in the Media Library.`, confirmLabel: "Remove" })) return;
    setBusy(true); setError("");
    try { await adminApi.updateMedia(item.id, mediaPayload(item, { programItemId: null })); if (posterMediaId === item.id) onSelectPoster(null); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function deleteFile(item) {
    if (!await dialog.confirm({ title: "Permanently delete this file?", message: `“${item.originalFilename}” and its optimized versions will be deleted.`, confirmLabel: "Delete file", tone: "danger" })) return;
    setBusy(true); setError("");
    try { await adminApi.deleteMedia(item.id); if (posterMediaId === item.id) onSelectPoster(null); if (editing?.id === item.id) setEditing(null); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  if (!programId) return <section className="admin-formsection admin-program-gallery admin-standard-card"><div className="admin-program-gallery__head"><div><span className="admin-kicker">Play photographs</span><h2>Save this play first</h2><p>After saving, its automatic photo collection can be managed here.</p></div></div></section>;

  return <section className="admin-formsection admin-program-gallery admin-standard-card">
    <div className="admin-program-gallery__head"><div><span className="admin-kicker">Play photographs</span><h2>{media.length} attached photograph{media.length === 1 ? "" : "s"}</h2><p>This collection is generated automatically from media assigned to this play.</p></div><div className="admin-program-gallery__toolbar"><input ref={fileInput} hidden multiple type="file" accept="image/*" onChange={(event) => upload(event.target.files)} /><button type="button" className="admin-button admin-button--primary" disabled={busy} onClick={() => fileInput.current?.click()}>＋ Upload photos</button><button type="button" className="admin-button" disabled={busy} onClick={() => setPickerOpen(true)}>Attach existing</button></div></div>
    {error && <div className="admin-alert admin-alert--error">{error}</div>}
    {media.length > 0 ? <div className="admin-program-gallery__grid">{media.map((item) => { const url = mediaPreviewUrl(item); const isPoster = posterMediaId === item.id; return <figure className={isPoster ? "is-thumbnail" : ""} key={item.id}>{url ? <img src={url} alt={item.alt || item.originalFilename || "Play media"} /> : <span>Preview unavailable</span>}{isPoster && <em className="admin-program-gallery__thumbnail-badge">Program thumbnail</em>}<figcaption><div><b>{item.originalFilename || "Media"}</b><small>{item.caption || item.alt || "No caption"}</small></div><span><button type="button" className={isPoster ? "is-selected" : ""} disabled={isPoster} onClick={() => onSelectPoster(item.id)}>{isPoster ? "Selected" : "Use as thumbnail"}</button><button type="button" onClick={() => setEditing({ ...item })}>Edit</button><button type="button" onClick={() => removeFromPlay(item)}>Remove</button><button type="button" className="is-danger" onClick={() => deleteFile(item)}>Delete</button></span></figcaption></figure>; })}</div> : <div className="admin-program-gallery__empty"><span>□</span><div><b>No photographs attached yet</b><p>Upload new photographs or attach images that already exist in the Media Library.</p></div></div>}
    {pickerOpen && <MediaPicker open multiple initial={media.map((item) => item.id)} onClose={() => setPickerOpen(false)} onSelect={attachExisting} />}
    {editing && <div className="admin-modal" role="dialog" aria-modal="true"><form className="admin-modal__panel admin-play-photo-editor" onSubmit={savePhoto}><header><div><span className="admin-kicker">Play photograph</span><h2>Edit image details</h2><p>{editing.originalFilename}</p></div><button type="button" className="admin-iconbutton" onClick={() => setEditing(null)}>×</button></header><div className="admin-editor__body"><div className="admin-play-photo-editor__preview"><img src={mediaPreviewUrl(editing)} alt="" /></div><div className="admin-fieldgrid"><label>Alt text<input value={editing.alt || ""} onChange={(event) => setEditing({ ...editing, alt: event.target.value })} /></label><label>Credit<input value={editing.credit || ""} onChange={(event) => setEditing({ ...editing, credit: event.target.value })} /></label><label className="admin-field--wide">Caption<textarea rows="4" value={editing.caption || ""} onChange={(event) => setEditing({ ...editing, caption: event.target.value })} /></label><label>Category<select value={editing.category || "performance"} onChange={(event) => setEditing({ ...editing, category: event.target.value })}><option value="performance">Performance</option><option value="backstage">Backstage</option><option value="audience">Audience</option><option value="portrait">Portrait</option><option value="other">Other</option></select></label><label>Tags<input value={editing.tags || ""} onChange={(event) => setEditing({ ...editing, tags: event.target.value })} /></label></div></div><footer><button type="button" className="admin-button admin-button--danger" onClick={() => deleteFile(editing)}>Delete file</button><span /><button type="button" className="admin-button" onClick={() => setEditing(null)}>Cancel</button><button className="admin-button admin-button--primary" disabled={busy}>{busy ? "Saving…" : "Save image"}</button></footer></form></div>}
  </section>;
}

function DayRelationsPanel({ dayId, editionId, section, lookups }) {
  if (!dayId) return <section className="admin-editor-section admin-edition-related admin-edition-related--locked"><span>01</span><h2>Save the festival day first</h2><p>Activities and recap media can be connected after this day has been created.</p></section>;
  const resource = section.relationResource;
  const items = (lookups[resource] || []).filter((item) => item.values?.festivalDayId === dayId);
  const url = `/admin/${resource}?festivalDayId=${dayId}${editionId ? `&editionId=${editionId}` : ""}`;
  return <section className="admin-editor-section admin-edition-related"><header><div><span className="admin-kicker">Day workspace</span><h2>{section.label}</h2><p>{resource === "activities" ? "Add conferences, ceremonies, after-parties and other scheduled events." : "Use an ordered day gallery for images and include a video when a day recap is available."}</p></div><a className="admin-button admin-button--primary" href={url}>Manage {section.label.toLowerCase()} →</a></header><div className="admin-edition-related__summary"><strong>{items.length}</strong><span>{items.length === 1 ? "record" : "records"} connected to this day</span>{resource === "galleries" && <small>{items.reduce((total, item) => total + (item.mediaIds?.length || 0), 0)} media items</small>}</div>{items.length === 0 ? <div className="admin-edition-related__empty"><b>Nothing attached yet</b><p>Older editions may remain incomplete until more archive material is found.</p></div> : <div className="admin-edition-related__list">{items.map((item, index) => <article key={item.id}><span className="admin-edition-related__index">{String(index + 1).padStart(2, "0")}</span><div><h3>{itemLabel(item)}</h3><p>{resource === "activities" ? [pretty(item.values?.type || "activity"), String(item.values?.startTime || "").slice(0, 5), item.values?.venue].filter(Boolean).join(" · ") : `${item.mediaIds?.length || 0} ordered media items`}</p></div></article>)}</div>}</section>;
}

function DayEditorPreview({ payload, language, checks, setActiveTab, lookups, dayId }) {
  const copy = { ...(payload.translations?.sq || {}), ...(payload.translations?.[language] || {}) };
  const activities = (lookups.activities || []).filter((item) => item.values?.festivalDayId === dayId);
  const memoryCount = parseMediaIds(payload.values?.memoriesMediaIdsJson).length;
  return <aside className="admin-editor-summary admin-day-editor-preview"><span className="admin-kicker">Day page preview</span><strong className="admin-day-editor-preview__number">{String(payload.values?.dayNumber || "").padStart(2, "0")}</strong><h3>{copy.title || `Day ${payload.values?.dayNumber || "—"}`}</h3><time>{payload.values?.date ? new Date(`${payload.values.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date not set"}</time><p>{copy.description || "The day introduction will preview here."}</p><div className="admin-day-editor-preview__conclusion"><b>Conclusion</b><span>{copy.conclusion || "No conclusion has been written yet."}</span></div><div className="admin-day-editor-preview__stats"><span><b>{activities.length}</b> activities</span><span><b>{memoryCount}</b> memories</span></div><hr /><div>{checks.map((check) => <button type="button" className={check.complete ? "is-complete" : ""} onClick={() => setActiveTab(check.tab)} key={check.label}><i>{check.complete ? "✓" : "!"}</i><span><b>{check.label}</b><small>{check.complete ? "Ready" : "Required"}</small></span></button>)}</div></aside>;
}

function EditionMediaPreview({ label, item }) {
  const url = mediaPreviewUrl(item);
  return <div className={item ? "has-media" : ""}>{url && item?.type === "image" ? <img src={url} alt="" /> : <span>{item?.type === "video" ? "▶" : "+"}</span>}<small>{label}</small></div>;
}

function mediaPreviewUrl(item) {
  return absoluteMediaUrl(item?.mediumUrl || item?.thumbnailUrl || item?.posterUrl || item?.originalUrl);
}

function stripMarkup(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const homepageSectionMeta = {
  hero: ["Hero", "Opening headline, dates, primary call to action and hero visual.", "H"],
  about: ["About preview", "Short festival introduction and its featured image.", "A"],
  "featured-edition": ["Featured edition", "Current edition highlight, visual identity and edition link.", "E"],
  "featured-program": ["Featured program", "Selected performances shown in the homepage program preview.", "P"],
  editions: ["Editions", "The ordered PITF editions carousel.", "10"],
  "featured-news": ["Featured news", "Selected news cards and external stories.", "N"],
  sponsors: ["Sponsors & partners", "Sponsor logos and supporting copy.", "S"],
  newsletter: ["Newsletter / CTA", "Closing call-to-action and newsletter form.", "→"],
};

function HomepageLivePreview({ previewKey, refresh }) {
  return <section className="admin-home-preview admin-card"><header className="admin-card__head"><div><span className="admin-kicker">Live preview</span><h2>Current public homepage</h2><p>This is the real homepage rendered with published API content.</p></div><div className="admin-rowactions"><button onClick={refresh}>Refresh preview</button><a href="/" target="_blank" rel="noreferrer">Open full page ↗</a></div></header><div className="admin-home-preview__viewport"><iframe key={previewKey} src="/?adminPreview=1" title="PITF public homepage preview" /></div></section>;
}

function HomepageSectionBoard({ items, lookups, edit }) {
  return <div className="admin-home-board">{[...items].sort((a, b) => (a.values?.order ?? 0) - (b.values?.order ?? 0)).map((item) => <HomepageSectionCard item={item} lookups={lookups} edit={edit} key={item.id} />)}</div>;
}

function HomepageSectionCard({ item, lookups, edit }) {
  const values = item.values || {}; const meta = homepageSectionMeta[values.key] || [pretty(values.key || "Section"), "Custom homepage section.", "◆"];
  const configuration = parseJson(values.configurationJson); const translated = item.translations?.sq || item.translations?.en || item.translations?.bs || {};
  const title = translated["configuration.title"] || configuration.title; const selectedEdition = (lookups.editions || []).find((entry) => entry.id === values.selectedEditionId);
  const selections = (item.selections || []).map((selection) => {
    const resource = selection.entityType === "News" ? "news" : selection.entityType === "ProgramItem" ? "program" : "editions";
    const match = (lookups[resource] || []).find((entry) => entry.id === selection.entityId);
    return match ? itemLabel(match) : selection.entityId;
  });
  const contentLink = ["hero", "about", "newsletter"].includes(values.key) ? "/admin/home-content" : null;
  return <article className={`admin-home-section ${values.isVisible ? "" : "is-hidden"}`}>
    <div className="admin-home-section__preview"><span>{meta[2]}</span><div>{title && <b>{title}</b>}<small>{meta[1]}</small>{selectedEdition && <em>Edition: {itemLabel(selectedEdition)}</em>}{selections.length > 0 && <ul>{selections.slice(0, 4).map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}{selections.length > 4 && <li>+{selections.length - 4} more</li>}</ul>}</div></div>
    <div className="admin-home-section__body"><div><span className="admin-home-section__order">{String((values.order ?? 0) + 1).padStart(2, "0")}</span><div><h3>{meta[0]}</h3><code>{values.key}</code></div></div><div className="admin-home-section__badges"><span className={values.isVisible ? "is-visible" : "is-hidden"}>{values.isVisible ? "Visible" : "Hidden"}</span><StatusBadge status={values.status} /><span>{values.selectionMode || "automatic"}</span></div><div className="admin-home-section__actions">{contentLink && <a href={contentLink}>Edit content</a>}<button onClick={() => edit(item)}>Configure section</button></div></div>
  </article>;
}

function parseJson(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }

function ResourceEditor({ resource, config, model, lookups, onClose, onSaved }) {
  const [payload, setPayload] = useState(model.payload); const [language, setLanguage] = useState("sq"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [mediaPicker, setMediaPicker] = useState(null);
  const translationFields = useMemo(() => resource === "awards" ? [] : [...new Set([...config.translations, ...Object.values(payload.translations).flatMap((x) => Object.keys(x || {}))])], [resource, config, payload.translations]);
  function value(name, next) { setPayload((p) => ({ ...p, values: { ...p.values, [name]: next } })); }
  function translation(field, next) { setPayload((p) => ({ ...p, translations: { ...p.translations, [language]: { ...(p.translations[language] || {}), [field]: next } } })); }
  async function save(event) { event.preventDefault(); setBusy(true); setError(""); try { await adminApi.save(resource, { id: model.id, payload }); await onSaved(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  function applyMedia(ids, uploadedIds = []) {
    setPayload((current) => ({ ...current, uploadedMediaIds: [...new Set([...(current.uploadedMediaIds || []), ...uploadedIds])] }));
    if (mediaPicker.multiple) setPayload((p) => ({ ...p, mediaIds: ids })); else value(mediaPicker.field, ids[0] || null);
    setMediaPicker(null);
  }
  function selectionIds(type) { return payload.selections.filter((x) => x.entityType === type).map((x) => x.entityId); }
  function setSelectionIds(type, ids) { setPayload((p) => ({ ...p, selections: [...p.selections.filter((x) => x.entityType !== type), ...ids.map((entityId) => ({ entityType: type, entityId }))] })); }
  return <div className="admin-modal" role="dialog" aria-modal="true"><form className="admin-modal__panel admin-editor" onSubmit={save}>
    <header><div><span className="admin-kicker">{model.id ? "Edit content" : "New content"}</span><h2>{config.singular}</h2></div><button type="button" className="admin-iconbutton" onClick={onClose}>×</button></header>
    <div className="admin-editor__body">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      <section className="admin-formsection admin-standard-card"><div className="admin-standard-card__head"><div><span className="admin-kicker">{resource === "awards" ? "Winner selection" : "Content editor"}</span><h2>{resource === "awards" ? "Award details" : "Content details"}</h2><p>{resource === "awards" ? "Choose the edition, award category, winning performance and recipient." : "Core information, relationships and publication settings."}</p></div></div><div className="admin-fieldgrid">{config.fields.map((field) => <Field key={field.name} field={field} payload={payload} value={payload.values[field.name]} setValue={(next) => value(field.name, next)} lookups={lookups} openMedia={(multiple = false) => setMediaPicker({ field: field.name, multiple })} setPayload={setPayload} selectionIds={selectionIds} setSelectionIds={setSelectionIds} />)}</div></section>
      {translationFields.length > 0 && <section className="admin-formsection admin-standard-card"><div className="admin-standard-card__head"><div><span className="admin-kicker">Language content</span><h2>{resource === "galleries" ? "Gallery name & description" : "Translations"}</h2><p>{resource === "galleries" ? "Give the gallery a recognizable name. You can translate it for each website language." : "Existing values are preserved per language. Empty fields remain empty."}</p></div><div className="admin-language-tabs">{["sq", "en", "bs"].map((code) => <button type="button" className={language === code ? "is-active" : ""} onClick={() => setLanguage(code)} key={code}>{code.toUpperCase()}</button>)}</div></div><div className="admin-translation-fields">{translationFields.map((field) => <label key={`${language}-${field}`}>{resource === "galleries" && field === "title" ? "Gallery name (optional)" : pretty(field)}{config.rich?.includes(field) ? <RichText value={payload.translations[language]?.[field] || ""} onChange={(next) => translation(field, next)} /> : field.toLowerCase().includes("body") || field.toLowerCase().includes("description") || field.toLowerCase().includes("text") ? <textarea rows="7" value={payload.translations[language]?.[field] || ""} onChange={(e) => translation(field, e.target.value)} /> : <input value={payload.translations[language]?.[field] || ""} onChange={(e) => translation(field, e.target.value)} />}</label>)}</div></section>}
      {resource === "editions" && model.id && <section className="admin-formsection admin-standard-card"><div className="admin-standard-card__head"><div><span className="admin-kicker">Edition structure</span><h2>Edition workspace</h2><p>Manage all records connected to this edition.</p></div></div><div className="admin-linkgrid"><a href="/admin/days">Festival days</a><a href="/admin/program">Program</a><a href="/admin/news">News</a><a href="/admin/galleries">Galleries</a><a href="/admin/sponsors">Sponsors</a><a href="/admin/awards">Awards</a></div></section>}
    </div>
    <footer><button type="button" className="admin-button" onClick={onClose}>Cancel</button><button className="admin-button admin-button--primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></footer>
  </form>{mediaPicker && <MediaPicker open uploadContext={editorUploadContext(resource, model, payload, mediaPicker.field)} multiple={mediaPicker.multiple} initial={mediaPicker.multiple ? payload.mediaIds : [payload.values[mediaPicker.field]]} onClose={() => setMediaPicker(null)} onSelect={applyMedia} />}</div>;
}

function englishItemLabel(item) { const v = item?.values || {}; const t = item?.translations || {}; return t.en?.title || t.en?.name || t.sq?.title || t.bs?.title || v.name || v.title || v.slug || v.year || item?.id || ""; }
function playCountry(item) { return item?.translations?.en?.country || item?.values?.country || item?.translations?.sq?.country || item?.translations?.bs?.country || ""; }
function relationItemLabel(item, resource) { return resource === "editions" && item?.values?.number ? `Edition ${item.values.number}` : itemLabel(item); }

function Field({ field, payload, value, setValue, lookups, openMedia, setPayload, selectionIds, setSelectionIds }) {
  if (field.specialMentionOnly && payload.values.awardType !== "Special Mention Award") return null;
  if (field.type === "checkbox") return <label className="admin-check"><input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} /><span><b>{field.label}</b></span></label>;
  if (field.type === "media") return <MediaField label={field.label} value={value} choose={() => openMedia(false)} clear={() => setValue(null)} />;
  if (field.type === "mediaMultiple") return <label className="admin-field--wide admin-day-section-media">{field.label}<DayMediaPreview ids={payload.mediaIds} setIds={(mediaIds) => setPayload((p) => ({ ...p, mediaIds }))} /><button type="button" className="admin-button" onClick={() => openMedia(true)}>Choose / reorder pictures</button></label>;
  if (field.type === "mediaJson") { const ids = parseMediaIds(value); return <label className="admin-field--wide admin-day-section-media">{field.label}<DayMediaPreview ids={ids} setIds={(next) => setValue(JSON.stringify(next))} /><button type="button" className="admin-button" onClick={() => openMedia(true)}>Choose / reorder images</button></label>; }
  if (field.type === "daySelect") { const edition = (lookups.editions || []).find((item) => item.id === payload.values.editionId); const start = edition?.values?.startDate ? new Date(`${edition.values.startDate}T00:00:00`) : null; const end = edition?.values?.endDate ? new Date(`${edition.values.endDate}T00:00:00`) : null; const scheduledCount = start && end ? Math.max(1, Math.round((end - start) / 86400000) + 1) : (lookups.days || []).filter((item) => item.values?.editionId === payload.values.editionId).length || 1; return <label>{field.label}<select required={field.required} value={value || ""} onChange={(event) => setValue(Number(event.target.value))}><option value="" disabled>Select a day</option>{Array.from({ length: scheduledCount }, (_, index) => index + 1).map((day) => <option value={day} key={day}>Day {day}</option>)}</select></label>; }
  if (field.type === "relationMulti") return <label className="admin-field--wide">{field.label}<RelationMulti ids={payload.editionIds} setIds={(editionIds) => setPayload((p) => ({ ...p, editionIds }))} items={lookups[field.resource] || []} /></label>;
  if (field.type === "selectionMulti") { const ids = selectionIds(field.entityType); return <label className="admin-field--wide">{field.label}<RelationMulti ids={ids} setIds={(next) => setSelectionIds(field.entityType, next)} items={lookups[field.resource] || []} /></label>; }
  if (field.type === "links") return <label className="admin-field--wide">{field.label}<LinksEditor links={payload.links} setLinks={(links) => setPayload((p) => ({ ...p, links }))} /></label>;
  if (field.type === "credits") return <CreditsEditor label={field.label} value={value} onChange={setValue} />;
  if (field.type === "awardPerson") {
    const type = payload.values.awardType || "";
    const isPersonAward = ["Best Director Award", "Best Actor Award", "Best Actress Award", "Best Supporting Actor Award", "Best Supporting Actress Award"].includes(type);
    if (!isPersonAward && type !== "Special Mention Award") return null;
    const play = (lookups.program || []).find((item) => item.id === payload.values.programItemId);
    const credits = (() => { try { return JSON.parse(play?.values?.credits || "[]"); } catch { return []; } })();
    const creditNames = credits.flatMap((entry) => String(entry.name || "").split(/,|;|\n/).map((name) => name.trim()).filter(Boolean));
    const suggestions = type === "Best Director Award" ? (play?.values?.director ? [play.values.director] : []) : [...new Set(type === "Special Mention Award" ? [...(play?.values?.director ? [play.values.director] : []), ...creditNames] : creditNames)];
    const actingAward = ["Best Actor Award", "Best Actress Award", "Best Supporting Actor Award", "Best Supporting Actress Award"].includes(type);
    if (actingAward) {
      const selected = String(value || "").split(/;|\n/).map((name) => name.trim()).filter(Boolean);
      const toggle = (name) => setValue(selected.includes(name) ? selected.filter((entry) => entry !== name).join("; ") : [...selected, name].join("; "));
      return <fieldset className="admin-award-winners"><legend>Winner(s)</legend><p>Select one winner, or select two when the award is shared.</p>{suggestions.length > 0 && <div>{suggestions.map((name) => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} /><span>{name}</span></label>)}</div>}<label>Manual winner names<input placeholder="Enter missing names separated by semicolons" required value={value || ""} onChange={(event) => setValue(event.target.value)} /></label></fieldset>;
    }
    return <label>{type === "Best Director Award" ? "Winning director" : type === "Special Mention Award" ? "Person (optional)" : "Winning actor / actress"}<input list="award-person-suggestions" placeholder="Select a name or type one manually" required={isPersonAward} value={value || ""} onChange={(event) => setValue(event.target.value)} /><datalist id="award-person-suggestions">{suggestions.map((name) => <option value={name} key={name} />)}</datalist><small>{suggestions.length ? "Choose someone from the selected play or type a missing person manually." : "No cast is stored for this play. Type the winner’s name manually."}</small></label>;
  }
  if (field.type === "suggestions") { const listId = `suggestions-${field.name}`; return <label>{field.label}<input list={listId} value={value || ""} onChange={(event) => setValue(event.target.value)} /><datalist id={listId}>{field.options.map((option) => <option value={option} key={option} />)}</datalist></label>; }
  if (field.type === "relation") { let items = lookups[field.resource] || []; const selectedEdition = payload.values?.editionId; const editionDependent = ["days", "activities", "program"].includes(field.resource) && payload.values && Object.prototype.hasOwnProperty.call(payload.values, "editionId"); if (editionDependent) { if (!selectedEdition) items = []; else if (field.resource === "activities") { const editionDayIds = new Set((lookups.days || []).filter((day) => day.values?.editionId === selectedEdition).map((day) => day.id)); items = items.filter((item) => editionDayIds.has(item.values?.festivalDayId)); } else items = items.filter((item) => item.values?.editionId === selectedEdition); } else if (field.filterByEdition && selectedEdition) items = items.filter((item) => item.values?.editionId === selectedEdition); if (field.resource === "days") items = items.sort((a, b) => String(a.values?.date || "").localeCompare(String(b.values?.date || ""))); if (field.resource === "editions") items = [...items].sort((a, b) => Number(b.values?.number || 0) - Number(a.values?.number || 0)); const hasCurrent = items.some((item) => item.id === value); const awardNeedsPlay = field.filterByEdition && payload.values.awardType && payload.values.awardType !== "Special Mention Award"; return <label className={field.className || ""}>{field.label}<select disabled={editionDependent && !selectedEdition} required={field.required || awardNeedsPlay} value={hasCurrent ? value || "" : ""} onChange={(e) => setValue(e.target.value || null)}><option value="">{editionDependent && !selectedEdition ? "Choose an edition first" : "None"}</option>{items.map((item) => { const label = relationItemLabel(item, field.resource); const country = field.filterByEdition ? playCountry(item) : ""; return <option key={item.id} value={item.id}>{field.resource === "days" && item.values?.date ? `${label} — ${String(item.values.date).slice(0, 10)}` : country ? `${label} — ${country}` : label}</option>; })}</select></label>; }
  if (field.type === "select") { const usedAwards = field.name === "awardType" ? new Set((lookups.awards || []).filter((item) => item.id !== payload.recordId && item.values?.editionId === payload.values.editionId).map((item) => item.values?.awardType)) : new Set(); return <label>{field.label}<select value={value || ""} onChange={(e) => setValue(e.target.value)}>{field.options.map((option) => <option key={option} disabled={usedAwards.has(option)}>{option}{usedAwards.has(option) ? " — already awarded" : ""}</option>)}</select></label>; }
  if (field.type === "textarea" || field.type === "json") return <label className="admin-field--wide">{field.label}<textarea className={field.type === "json" ? "admin-code" : ""} rows={field.type === "json" ? 10 : 5} value={value || ""} onChange={(e) => setValue(e.target.value)} /></label>;
  const selectedEdition = (lookups.editions || []).find((item) => item.id === payload.values?.editionId);
  const isEditionScheduledDate = (field.type === "date" && field.name === "date") || (field.type === "datetime" && field.name === "startsAt");
  const startDate = isEditionScheduledDate ? String(selectedEdition?.values?.startDate || "").slice(0, 10) : "";
  const endDate = isEditionScheduledDate ? String(selectedEdition?.values?.endDate || "").slice(0, 10) : "";
  const formattedValue = formatInput(value, field.type);
  const valueDate = String(formattedValue || "").slice(0, 10);
  const inEditionRange = !isEditionScheduledDate || !valueDate || ((!startDate || valueDate >= startDate) && (!endDate || valueDate <= endDate));
  const min = field.type === "datetime" && startDate ? `${startDate}T00:00` : startDate || undefined;
  const max = field.type === "datetime" && endDate ? `${endDate}T23:59` : endDate || undefined;
  return <label>{field.label}<input type={field.type === "datetime" ? "datetime-local" : field.type || "text"} min={min} max={max} required={field.required} value={inEditionRange ? formattedValue : ""} onChange={(e) => setValue(e.target.value)} /></label>;
}

function parseMediaIds(value) { try { const ids = JSON.parse(value || "[]"); return Array.isArray(ids) ? ids.filter(Boolean) : []; } catch { return []; } }

function DayMediaPreview({ ids, setIds }) {
  const [media, setMedia] = useState({});
  useEffect(() => {
    let active = true;
    const missing = ids.filter((id) => !media[id]);
    if (!missing.length) return () => { active = false; };
    Promise.all(missing.map(async (id) => { try { return [id, await adminApi.mediaItem(id)]; } catch { return [id, null]; } }))
      .then((entries) => { if (active) setMedia((current) => ({ ...current, ...Object.fromEntries(entries) })); });
    return () => { active = false; };
  }, [ids, media]);
  function move(index, delta) { const target = index + delta; if (target < 0 || target >= ids.length) return; const next = [...ids]; [next[index], next[target]] = [next[target], next[index]]; setIds(next); }
  if (!ids.length) return <div className="admin-day-media-empty">No images selected yet.</div>;
  return <div className="admin-day-media-preview">{ids.map((id, index) => { const item = media[id]; return <article key={id}>{item ? <MediaThumb media={item} /> : <div className="admin-media-thumb admin-day-media-loading" />}<div><span>{item?.alt || item?.originalFilename || `Image ${index + 1}`}</span><div><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move image earlier">←</button><button type="button" disabled={index === ids.length - 1} onClick={() => move(index, 1)} aria-label="Move image later">→</button><button type="button" className="is-danger" onClick={() => setIds(ids.filter((entry) => entry !== id))} aria-label="Remove image">×</button></div></div></article>; })}</div>;
}

function languageName(code) {
  return { sq: "Albanian", en: "English", bs: "Bosnian" }[code] || code.toUpperCase();
}

function LanguageTabs({ language, setLanguage, translations, field }) {
  return <div className="admin-language-tabs" aria-label="Content language">{["sq", "en", "bs"].map((code) => {
    const fields = translations?.[code] || {};
    const complete = field ? Boolean(fields[field]?.trim()) : Object.values(fields).some((value) => String(value || "").trim());
    return <button type="button" className={`${language === code ? "is-active" : ""}${complete ? " is-complete" : ""}`} onClick={() => setLanguage(code)} aria-pressed={language === code} title={`${languageName(code)}${complete ? " — content added" : " — empty"}`} key={code}>{code.toUpperCase()}<i aria-hidden="true" /></button>;
  })}</div>;
}

const creditRoleSuggestions = ["Director", "Writer / playwright", "Dramaturgy", "Assistant director", "Producer", "Set design", "Costume design", "Music", "Lighting design", "Choreography", "Actor", "Technical team"];

function parseCredits(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map((entry) => ({ role: entry.role || "", name: entry.name || "" }));
  } catch { /* Preserve legacy free-text credits as one editable row. */ }
  return [{ role: "Other credits", name: String(value) }];
}

function CreditsEditor({ label, value, onChange }) {
  const entries = parseCredits(value);
  function commit(next) { onChange(next.length ? JSON.stringify(next) : ""); }
  function patchEntry(index, key, nextValue) { commit(entries.map((entry, position) => position === index ? { ...entry, [key]: nextValue } : entry)); }
  return <fieldset className="admin-credits-editor admin-field--wide"><legend>{label}</legend><p>Choose or write a role, then attach the person’s name. Add as many cast and creative-team entries as needed.</p><datalist id="program-credit-roles">{creditRoleSuggestions.map((role) => <option value={role} key={role} />)}</datalist><div>{entries.map((entry, index) => <div className="admin-credits-editor__row" key={index}><label><span>Role</span><input list="program-credit-roles" placeholder="e.g. Actor" value={entry.role} onChange={(event) => patchEntry(index, "role", event.target.value)} /></label><label><span>Name</span><input placeholder="Person or group name" value={entry.name} onChange={(event) => patchEntry(index, "name", event.target.value)} /></label><button type="button" aria-label="Remove credit" onClick={() => commit(entries.filter((_, position) => position !== index))}>×</button></div>)}</div><button type="button" className="admin-button" onClick={() => commit([...entries, { role: "", name: "" }])}>＋ Add role and name</button></fieldset>;
}

function MediaField({ label, value, choose, clear }) {
  const [item, setItem] = useState(null);
  useEffect(() => {
    let active = true;
    if (!value) return () => { active = false; };
    adminApi.mediaItem(value).then((result) => { if (active) setItem(result); }).catch(() => { if (active) setItem(null); });
    return () => { active = false; };
  }, [value]);
  const selected = item?.id === value ? item : null;
  const url = mediaPreviewUrl(selected);
  return <label className={`admin-mediafield-wrap${selected?.type === "video" ? " is-video" : ""}`}><span>{label}</span><div className={`admin-mediafield-preview ${selected ? "has-media" : ""}${selected?.type === "video" ? " is-video" : ""}`}>
    {url && selected?.type === "video"
      ? <div className="admin-mediafield-preview__visual"><video src={absoluteMediaUrl(selected.originalUrl)} poster={absoluteMediaUrl(selected.videoPosterUrl || "")} controls preload="metadata" /></div>
      : <button type="button" className="admin-mediafield-preview__visual" onClick={choose}>{url && selected?.type === "image" ? <img src={url} alt={selected.alt || ""} /> : <span>{value ? "Loading preview…" : "+ Add media"}</span>}</button>}
    <div className="admin-mediafield-preview__details"><b>{selected?.originalFilename || (value ? "Selected media" : "No media selected")}</b><small>{selected ? `${selected.type} · ${selected.width || "—"} × ${selected.height || "—"}` : "Upload new files or choose existing media"}</small><code>{value || "No media ID"}</code><span><button type="button" onClick={choose}>{value ? "Replace" : "Add media"}</button>{value && <button type="button" className="is-danger" onClick={clear}>Clear</button>}</span></div>
  </div></label>;
}

function RelationMulti({ ids, setIds, items }) {
  const [choice, setChoice] = useState(""); const labels = Object.fromEntries(items.map((x) => [x.id, itemLabel(x)]));
  return <div className="admin-multirelation"><OrderedIds ids={ids} setIds={setIds} labels={labels} /><div><select value={choice} onChange={(e) => setChoice(e.target.value)}><option value="">Choose item…</option>{items.filter((x) => !ids.includes(x.id)).map((x) => <option value={x.id} key={x.id}>{itemLabel(x)}</option>)}</select><button type="button" disabled={!choice} onClick={() => { setIds([...ids, choice]); setChoice(""); }}>Add</button></div></div>;
}
function OrderedIds({ ids = [], setIds, labels }) { function move(index, delta) { const next = [...ids]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setIds(next); } return <div className="admin-ordered">{ids.length === 0 && <small>Nothing selected.</small>}{ids.map((id, index) => <div key={id}><span>{labels[id] || id}</span><button type="button" onClick={() => move(index, -1)}>↑</button><button type="button" onClick={() => move(index, 1)}>↓</button><button type="button" className="is-danger" onClick={() => setIds(ids.filter((x) => x !== id))}>×</button></div>)}</div>; }
function LinksEditor({ links = [], setLinks }) { function patch(index, key, value) { setLinks(links.map((x, i) => i === index ? { ...x, [key]: value } : x)); } return <div className="admin-links">{links.map((link, index) => <div key={index}><input placeholder="Label" value={link.label || ""} onChange={(e) => patch(index, "label", e.target.value)} /><input placeholder="https://…" value={link.url || ""} onChange={(e) => patch(index, "url", e.target.value)} /><select value={link.target || "_blank"} onChange={(e) => patch(index, "target", e.target.value)}><option>_blank</option><option>_self</option></select><button type="button" onClick={() => setLinks(links.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" onClick={() => setLinks([...links, { label: "", url: "", target: "_blank" }])}>＋ Add link</button></div>; }
function NewsArticleWorkspace({ config, payload, lookups, value, updatePayload, openMedia, selectionIds, setSelectionIds }) {
  const field = (name) => config.fields.find((entry) => entry.name === name);
  const renderField = (name, wide = false) => {
    const definition = field(name);
    if (!definition) return null;
    const setFieldValue = name === "editionId" ? (next) => updatePayload((current) => ({ ...current, values: { ...current.values, editionId: next, festivalDayId: null, activityId: null, programItemId: null } })) : (next) => value(name, next);
    return <Field key={name} field={wide ? { ...definition, className: "admin-field--wide" } : definition} payload={payload} value={payload.values[name]} setValue={setFieldValue} lookups={lookups} openMedia={(multiple = false) => openMedia(name, multiple)} setPayload={(updater) => updatePayload(updater)} selectionIds={selectionIds} setSelectionIds={setSelectionIds} />;
  };
  return <section className="admin-news-workspace">
    <div className="admin-news-formgroup admin-news-formgroup--context">
      <div className="admin-news-formgroup__title"><div><span className="admin-kicker">PITF context</span><h3>Festival connections & article type</h3><p>Choose where the story belongs and whether visitors read it on PITF or on an external website.</p></div></div>
      <div className="admin-fieldgrid admin-news-details">{renderField("editionId")}{renderField("festivalDayId")}{renderField("activityId")}{renderField("programItemId")}{renderField("date")}{renderField("category")}{renderField("contentMode")}</div>
    </div>

    <div className="admin-news-formgroup admin-news-formgroup--content">
      <div className="admin-news-formgroup__title"><div><span className="admin-kicker">Article content</span><h3>Story & translations</h3><p>Edit the translated headline, summary and full article.</p></div></div>
      <NewsBilingualEditor payload={payload} updatePayload={updatePayload} />
    </div>

    <div className="admin-news-formgroup admin-news-formgroup--media">
      <div className="admin-news-formgroup__title"><div><span className="admin-kicker">Article media</span><h3>Cover & gallery</h3><p>The cover is used on News cards and at the top of the article. Arrange supporting images and videos below it.</p></div></div>
      <div className={`admin-news-media-fields${payload.values.contentMode === "External" ? " is-thumbnail-only" : ""}`}>{renderField("coverMediaId")}{payload.values.contentMode !== "External" && renderField("$mediaIds")}</div>
    </div>

    <div className="admin-news-formgroup">
      <div className="admin-news-formgroup__title"><div><span className="admin-kicker">Related external coverage</span><h3>Coverage from other publishers</h3><p>Add optional sources covering the same topic. These links open according to their selected target.</p></div></div>
      <div className="admin-news-related">{renderField("$links")}</div>
    </div>

    <div className="admin-news-formgroup admin-news-formgroup--settings">
      <div className="admin-news-formgroup__title"><div><span className="admin-kicker">Article settings</span><h3>Publication</h3><p>Choose visibility, scheduling and display order.</p></div></div>
      <div className="admin-fieldgrid admin-news-publishing">{renderField("status")}{renderField("publishedAt")}</div>
    </div>
  </section>;
}

function NewsBilingualEditor({ payload, updatePayload }) {
  const [activeLanguage, setActiveLanguage] = useState("sq");
  function setTranslation(language, field, next) {
    updatePayload((current) => {
      const currentLanguage = current.translations[language] || {};
      const localized = { ...currentLanguage, [field]: next };
      if (field === "title" && (!currentLanguage.slug || currentLanguage.slug === slugify(currentLanguage.title))) localized.slug = slugify(next);
      const translations = { ...current.translations, [language]: localized };
      const shouldGenerateSlug = field === "title" && language === "sq" && !current.values.slug;
      return { ...current, translations, values: shouldGenerateSlug ? { ...current.values, slug: slugify(next) } : current.values };
    });
  }
  const code = activeLanguage;
  const name = code === "sq" ? "Albanian" : "English";
  const translated = payload.translations?.[code] || {};
  const requiredFields = payload.values.contentMode === "External" ? ["title", "summary"] : ["title", "summary", "body"];
  const completed = requiredFields.filter((field) => String(translated[field] || "").replace(/<[^>]+>/g, "").trim()).length;
  return <div className={`admin-bilingual-editor admin-bilingual-editor--switch is-${code}`}>
    <nav className="admin-language-switch" aria-label="Article language">
      <button type="button" className={code === "sq" ? "is-active" : ""} onClick={() => setActiveLanguage("sq")}><span>SQ</span><div><b>Albanian</b><small>{payload.translations?.sq?.title ? "Translation started" : "Not started"}</small></div></button>
      <button type="button" className={code === "en" ? "is-active" : ""} onClick={() => setActiveLanguage("en")}><span>EN</span><div><b>English</b><small>{payload.translations?.en?.title ? "Translation started" : "Not started"}</small></div></button>
    </nav>
    <section className="admin-language-column" key={code}>
      <header><span>{code.toUpperCase()}</span><div><h3>{name} content</h3><small>{completed}/{requiredFields.length} required fields completed</small></div></header>
      <label>Article title <small>The headline visitors see on cards and the article page.</small><input value={translated.title || ""} placeholder={code === "sq" ? "Shkruani titullin në shqip…" : "Write the English headline…"} onChange={(event) => setTranslation(code, "title", event.target.value)} /></label>
      <label>URL slug <small>This language has its own public article URL.</small><input value={translated.slug || ""} placeholder={slugify(translated.title) || (code === "sq" ? "titulli-i-artikullit" : "article-title")} onChange={(event) => setTranslation(code, "slug", slugify(event.target.value))} /></label>
      <label>Summary <small>A short introduction for news cards and search results.</small><textarea rows="4" value={translated.summary || ""} placeholder={code === "sq" ? "Përmbledhje e shkurtër…" : "Short article summary…"} onChange={(event) => setTranslation(code, "summary", event.target.value)} /></label>
      {payload.values.contentMode === "External" ? <label>External article URL <small>Visitors open this link instead of a PITF article body.</small><input type="url" required value={payload.values.externalUrl || ""} placeholder="https://…" onChange={(event) => updatePayload((current) => ({ ...current, values: { ...current.values, externalUrl: event.target.value } }))} /></label> : <div className="admin-language-column__body admin-rich-field-group"><span>Article body</span><small>Use paragraphs and headings to make the story easy to read.</small><RichText value={translated.body || ""} placeholder={code === "sq" ? "Filloni të shkruani artikullin…" : "Start writing the article…"} onChange={(next) => setTranslation(code, "body", next)} /></div>}
    </section>
  </div>;
}

function RichText({ value, onChange, placeholder = "Start writing…" }) {
  const ref = useRef(null);
  const dialog = useAdminDialog();
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false });
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);
  function updateActiveFormats() {
    const selection = window.getSelection();
    const insideEditor = selection?.anchorNode && ref.current?.contains(selection.anchorNode);
    setActiveFormats(insideEditor ? { bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic") } : { bold: false, italic: false });
  }
  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats);
    return () => document.removeEventListener("selectionchange", updateActiveFormats);
  }, []);
  function command(name, argument) {
    ref.current?.focus();
    document.execCommand(name, false, argument);
    onChange(ref.current?.innerHTML || "");
    updateActiveFormats();
  }
  async function addLink() {
    const url = await dialog.prompt({ title: "Add a link", message: "Paste the full URL for the selected text.", label: "Link URL", placeholder: "https://example.com", inputType: "url", confirmLabel: "Add link" });
    if (url) command("createLink", url);
  }
  return <div className="admin-rich admin-rich--modern">
    <div className="admin-rich__toolbar">
      <select aria-label="Text style" defaultValue="p" onChange={(event) => command("formatBlock", event.target.value)}><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select>
      <span />
      <button type="button" title="Bold" className={activeFormats.bold ? "is-active" : ""} aria-pressed={activeFormats.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button>
      <button type="button" title="Italic" className={activeFormats.italic ? "is-active" : ""} aria-pressed={activeFormats.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button>
      <button type="button" title="Bulleted list" onClick={() => command("insertUnorderedList")}>• List</button>
      <button type="button" title="Numbered list" onClick={() => command("insertOrderedList")}>1. List</button>
      <button type="button" title="Add link" onClick={addLink}>Link</button>
      <button type="button" title="Undo" onClick={() => command("undo")}>↶</button>
      <button type="button" title="Clear formatting" onClick={() => command("removeFormat")}>Clear</button>
    </div>
    <div ref={ref} className="admin-rich__area" contentEditable data-placeholder={placeholder} suppressContentEditableWarning onInput={(event) => { onChange(event.currentTarget.innerHTML); updateActiveFormats(); }} onKeyUp={updateActiveFormats} onMouseUp={updateActiveFormats} />
  </div>;
}

export function PageHeader({ kicker, title, description, action }) { return <header className="admin-pagehead"><div><span className="admin-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
export function StatusBadge({ status }) { return status ? <span className={`admin-status admin-status--${status.toLowerCase()}`}>{status}</span> : <span className="admin-status">—</span>; }
const editionAccents = ["#d6a552", "#55b8a9", "#719bea", "#c879b2", "#de7a67", "#86b85c", "#9b83dc", "#d08d45"];
function editionForItem(item, lookups) { const editionId = item.values?.editionId; return editionId ? (lookups.editions || []).find((edition) => edition.id === editionId) : null; }
function editionAccent(edition) { if (/^#[0-9a-f]{6}$/i.test(edition?.values?.primaryColor || "")) return edition.values.primaryColor; const identity = Number(edition?.values?.number || edition?.values?.year); if (Number.isFinite(identity) && identity > 0) return editionAccents[(identity - 1) % editionAccents.length]; const key = String(edition?.id || ""); const hash = [...key].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0); return editionAccents[hash % editionAccents.length]; }
function contextLabel(item, lookups) { const v = item.values || {}; if (v.year) return v.year; if (v.editionId) { const edition = editionForItem(item, lookups); const label = itemLabel(edition || { id: v.editionId, values: {} }); const editionBadge = <span className="admin-edition-context" style={{ "--edition-row-accent": editionAccent(edition || { id: v.editionId }) }}><i aria-hidden="true" />{label}{edition?.values?.year && <em>{edition.values.year}</em>}</span>; if (Array.isArray(v.previewMediaUrls)) return <div className="admin-gallery-context"><div className="admin-gallery-preview">{v.previewMediaUrls.map((url, index) => <img src={absoluteMediaUrl(url)} alt="" loading="lazy" key={`${url}-${index}`} />)}{v.mediaCount > v.previewMediaUrls.length && <span>+{v.mediaCount - v.previewMediaUrls.length}</span>}{v.previewMediaUrls.length === 0 && <small>No pictures yet</small>}</div>{editionBadge}</div>; return editionBadge; } if (v.pageKey) return `${v.pageKey} / ${v.sectionKey}`; if (v.group) return v.group; return v.date || v.type || "—"; }
function pretty(value) { return value.replace(/^configuration\./, "").replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase()); }
function formatInput(value, type) { if (!value) return ""; return type === "datetime" ? String(value).slice(0, 16) : value; }
