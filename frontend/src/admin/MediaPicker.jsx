import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { adminApi, absoluteMediaUrl } from "./adminApi";
import { folderOptions as buildFolderOptions } from "./folderUtils";

export function MediaPicker({ open, multiple = false, initial = [], onClose, onSelect, uploadContext }) {
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 }); const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState(""); const [type, setType] = useState(""); const [folderId, setFolderId] = useState(""); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set(initial.filter(Boolean))); const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState([]);
  const uploadInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  useEffect(() => { if (open) adminApi.folders().then(setFolders).catch((reason) => setError(reason.message)); }, [open]);
  useEffect(() => { if (!open) return; const timer = setTimeout(() => { setLoading(true); adminApi.media({ search, type, folderId, page, pageSize: 60 }).then(setData).catch((reason) => setError(reason.message)).finally(() => setLoading(false)); }, 180); return () => clearTimeout(timer); }, [open, search, type, folderId, page]);
  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders]);
  async function uploadFiles(inputFiles) {
    const files = [...inputFiles].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!multiple && files.length > 1) { setError("Choose one file for this image field."); return; }
    if (!files.length) return;
    setUploading(true); setError("");
    try {
      const rows = await adminApi.upload(files, uploadContext || {});
      setUploaded((current) => [...current, ...rows]);
      setSelected((current) => new Set(multiple ? [...current, ...rows.map((item) => item.id)] : [rows[0]?.id].filter(Boolean)));
    } catch (reason) { setError(reason.message); }
    finally { setUploading(false); }
  }
  if (!open) return null;
  function toggle(id) { setSelected((current) => { const next = new Set(multiple ? current : []); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  return createPortal(<div className="admin-modal admin-media-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="media-picker-title"><div className="admin-modal__panel admin-modal__panel--wide admin-media-picker">
    <header className="admin-media-picker__head"><div><span className="admin-kicker">Content media</span><h2 id="media-picker-title">Add pictures & videos</h2></div><button type="button" className="admin-iconbutton" aria-label="Close media picker" disabled={uploading} onClick={onClose}>×</button></header>
    <div className="admin-media-picker__workspace">
    {uploadContext && <section className={`admin-direct-upload${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!uploading) uploadFiles(event.dataTransfer.files); }} aria-busy={uploading}>
      <div className="admin-direct-upload__icon"><Upload size={24} aria-hidden="true" /></div><div className="admin-direct-upload__copy"><b>{uploading ? "Uploading your files?" : "Add new pictures or videos"}</b><p>Drop {multiple ? "files" : "a file"} here or browse your computer. Uploads are selected automatically.</p><small>Images and videos</small></div>
      <input ref={uploadInput} hidden aria-label="Upload files for this content" type="file" accept="image/*,video/*" multiple={multiple} disabled={uploading} onChange={(event) => { uploadFiles(event.target.files); event.target.value = ""; }} />
      <button type="button" className="admin-button admin-button--primary" disabled={uploading} onClick={() => uploadInput.current?.click()}><Upload size={16} aria-hidden="true" />{uploading ? "Uploading?" : "Browse files"}</button>
    </section>}
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
    {uploaded.length > 0 && <div className="admin-media-grid admin-media-grid--picker admin-uploaded-preview">{uploaded.map((item) => <button type="button" key={item.id} className={`admin-media-card ${selected.has(item.id) ? "is-selected" : ""}`} aria-pressed={selected.has(item.id)} disabled={uploading} onClick={() => toggle(item.id)}><MediaThumb media={item} /><i className="admin-media-picker__check" aria-hidden="true">{selected.has(item.id) && <Check size={14} />}</i><span>{item.originalFilename}</span></button>)}</div>}
    <div className="admin-media-picker__library-label"><b>Choose existing media</b><span>{data.total.toLocaleString()} files in your library</span></div>
    <div className="admin-toolbar admin-media-picker__toolbar">
      <input aria-label="Search media" placeholder="Search filename…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      <select aria-label="Filter by media type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All media</option><option value="Image">Images</option><option value="Video">Videos</option></select>
      <select aria-label="Filter by folder" value={folderId} onChange={(e) => { setFolderId(e.target.value); setPage(1); }}><option value="">All folders</option>{folderOptions.map((f) => <option key={f.id} value={f.id}>{f.path}</option>)}</select>
    </div>
    {loading ? <div className="admin-empty admin-media-picker__body">Loading media…</div> : data.items.length ? <div className="admin-media-grid admin-media-grid--picker admin-media-picker__body">{data.items.map((m) => <button type="button" className={`admin-media-card ${selected.has(m.id) ? "is-selected" : ""}`} key={m.id} aria-pressed={selected.has(m.id)} onClick={() => toggle(m.id)}><MediaThumb media={m} /><i className="admin-media-picker__check" aria-hidden="true">{selected.has(m.id) && <Check size={14} />}</i><span title={m.originalFilename || m.alt || "Media"}>{m.originalFilename || m.alt || m.originalUrl.split("/").pop()}</span><small>{m.type} · {m.width || "?"}×{m.height || "?"}</small></button>)}</div> : <div className="admin-empty admin-media-picker__body"><b>No media found</b><span>Try another search, type, or folder.</span></div>}
    </div>
    <footer className="admin-media-picker__footer"><span><b>{selected.size}</b> selected</span><div className="admin-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>{page} / {data.totalPages || 1}</span><button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div><button type="button" className="admin-button admin-button--primary" disabled={uploading || !selected.size} onClick={() => onSelect([...selected], uploaded.map((item) => item.id))}>Use selected media</button></footer>
  </div></div>, document.body);
}

export function MediaThumb({ media }) {
  const src = media.thumbnailUrl || media.videoPosterUrl || media.mediumUrl || media.originalUrl;
  return <div className="admin-media-thumb">{media.type === "video" && !media.videoPosterUrl ? <video src={absoluteMediaUrl(media.originalUrl)} muted preload="metadata" /> : <img src={absoluteMediaUrl(src)} alt={media.alt || ""} loading="lazy" />}<b>{media.type === "video" ? "▶" : ""}</b></div>;
}
