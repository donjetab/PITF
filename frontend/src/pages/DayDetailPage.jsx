import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, X } from "lucide-react";
import { NewsletterSection } from "../components/NewsletterSection";
import { contentService, useContentData, useEditionDetail } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";

const fallbackIntro = "Artists and audiences came together for a full day of performances, conversations and festival encounters.";
const dayAccents = { 10: "#b57a24", 9: "#5559c9", 8: "#68619a", 7: "#24756b", 6: "#1286a9", 5: "#526b75", 4: "#8274b9", 3: "#284a9a", 2: "#bd1c5f", 1: "#705977" };

function prettyType(value = "") { return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dayDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""; }
function paragraphs(value) { return String(value || "").split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean); }
function youtubeEmbedUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
    if (!id && ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1];
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

function ConferenceCarousel({ images, title, onOpen }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % images.length), 4200);
    return () => window.clearInterval(timer);
  }, [images.length, paused]);
  if (!images.length) return null;
  const move = (direction) => setActive((current) => (current + direction + images.length) % images.length);
  const positionFor = (index) => {
    const distance = (index - active + images.length) % images.length;
    if (distance === 0) return "main";
    if (distance === 1) return "next";
    if (distance === images.length - 1) return "previous";
    return "hidden";
  };

  return <div className="day-story__carousel" aria-label={`${title} photos`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    {images.length > 1 && <button type="button" onClick={() => move(-1)} aria-label="Previous conference photo"><ChevronUp aria-hidden="true" /></button>}
    <div className="day-story__slides" aria-live="polite">{images.map((src, index) => { const position = positionFor(index); return <img className={`is-${position}`} src={src} alt={`${title} ${index + 1}`} aria-hidden={position === "hidden"} tabIndex={position === "hidden" ? -1 : 0} role="button" onClick={() => onOpen(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(index); }} key={src} />; })}</div>
    {images.length > 1 && <button type="button" onClick={() => move(1)} aria-label="Next conference photo"><ChevronDown aria-hidden="true" /></button>}
  </div>;
}

function MovingGallery({ images, title, onOpen }) {
  const trackRef = useRef(null);
  const isStatic = images.length < 5;
  useEffect(() => {
    const track = trackRef.current;
    if (isStatic || !track) return undefined;
    let frame;
    let previous = performance.now();
    const speed = 30;
    const animate = (now) => {
      const elapsed = Math.min(now - previous, 40);
      previous = now;
      track.scrollLeft += speed * elapsed / 1000;
      if (track.scrollLeft >= track.scrollWidth / 2) track.scrollLeft -= track.scrollWidth / 2;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [images.length, isStatic]);

  if (!images.length) return null;
  const loopImages = isStatic ? images : [...images, ...images];
  return <div className={`day-play-gallery${isStatic ? " is-static" : ""}`} style={isStatic ? { "--play-image-count": images.length } : undefined} ref={trackRef}>
    <div className="day-play-gallery__track">{loopImages.map((src, index) => <button type="button" onClick={() => onOpen(index % images.length)} aria-label={`Open ${title} photo ${(index % images.length) + 1}`} key={`${src}-${index}`}><img src={src} alt={`${title} ${(index % images.length) + 1}`} /></button>)}</div>
  </div>;
}

function DayLightbox({ gallery, onClose, onMove }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onMove(-1);
      if (event.key === "ArrowRight") onMove(1);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, onMove]);
  useEffect(() => {
    if (!gallery) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [gallery]);
  if (!gallery) return null;
  return createPortal(<div className="day-lightbox" role="dialog" aria-modal="true" aria-label={`${gallery.title} image gallery`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="day-lightbox__close" type="button" onClick={onClose} aria-label="Close full-screen gallery"><X aria-hidden="true" /></button>
    {gallery.images.length > 1 && <button className="day-lightbox__arrow is-previous" type="button" onClick={() => onMove(-1)} aria-label="Previous image"><ChevronLeft aria-hidden="true" /></button>}
    <figure><img src={gallery.images[gallery.index]} alt={`${gallery.title} ${gallery.index + 1}`} key={gallery.images[gallery.index]} /><figcaption>{gallery.title} <span>{gallery.index + 1} / {gallery.images.length}</span></figcaption></figure>
    {gallery.images.length > 1 && <button className="day-lightbox__arrow is-next" type="button" onClick={() => onMove(1)} aria-label="Next image"><ChevronRight aria-hidden="true" /></button>}
  </div>, document.body);
}

function RecapFilm({ day, edition, poster }) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const play = () => {
    setStarted(true);
    requestAnimationFrame(() => videoRef.current?.play());
  };
  const youtubeUrl = youtubeEmbedUrl(day.recapYoutubeUrl);
  return <section className="day-recap section-shell">
    <header className="day-recap__heading">
      <div><p className="kicker">{day.recapKicker}</p><h2>{day.recapTitle}</h2><p>{day.recapText}</p></div>
      <span>{day.recapMediaLabel || "Festival film"}</span>
    </header>
    <div className={`day-recap__media${started ? " is-playing" : ""}`}>
      {youtubeUrl ? <iframe src={youtubeUrl} title={day.recapTitle} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <>
        <video ref={videoRef} controls={started} preload="metadata" poster={poster || ""} onPlay={() => setStarted(true)}><source src={day.recap} /></video>
        {!started && <button className="day-recap__play" type="button" onClick={play} aria-label={day.recapPlayLabel}><Play fill="currentColor" aria-hidden="true" /><span>{day.recapPlayLabel}</span></button>}
      </>}
    </div>
    <p className="day-recap__caption">{edition.title}{day.date ? ` · ${dayDate(day.date)}` : ""}</p>
  </section>;
}

export function DayDetailPage() {
  const { editionSlug, dayNumber } = useParams();
  const { ready } = useContentData();
  const edition = useEditionDetail(editionSlug);
  const newsletter = contentService.getHomeContent().newsletter;
  const day = edition?.days?.find((item) => String(item.dayNumber) === String(dayNumber));
  const [lightbox, setLightbox] = useState(null);

  if (!ready || edition === undefined) return <PublicLoading label="Preparing the festival day" />;
  if (!edition || !day || !day.isPageEnabled) return <section className="day-detail day-detail--missing"><p className="kicker">Festival day</p><h1>Day not available yet</h1><Link className="outline-button" to={`/editions/${editionSlug}`}>Back to edition</Link></section>;

  const orderedActivities = [...(day.activities || [])].sort((a, b) => String(a.startTime || "23:59").localeCompare(String(b.startTime || "23:59")));
  const leadActivity = orderedActivities.find((item) => item.type === "press-conference") || orderedActivities[0];
  const dayProgram = (edition.program || []).filter((item) => String(item.startsAt || "").slice(0, 10) === day.date).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  const feature = dayProgram[0] || orderedActivities.find((item) => item.id !== leadActivity?.id);
  const allImages = [...new Set([...(leadActivity?.images || []), ...(day.images || []), feature?.imageSrc].filter(Boolean))];
  const conferenceImages = day.conferenceImages?.length ? day.conferenceImages : [...new Set([...(leadActivity?.images || []), ...(day.images || [])].filter(Boolean))];
  const conferenceSet = new Set(leadActivity?.images || []);
  const playOnlyImages = [...new Set([...(feature?.images || []), feature?.imageSrc, ...(day.images || []).filter((src) => !conferenceSet.has(src))].filter(Boolean))];
  const featureImages = day.playImages?.length ? day.playImages : playOnlyImages.length > 1 ? playOnlyImages : [...new Set([...playOnlyImages, ...allImages].filter(Boolean))];
  const memories = day.memoriesImages?.length ? day.memoriesImages.slice(0, 8) : allImages.slice(0, 8);
  const heroImage = day.headerImage || allImages[0] || edition.detailHeaderSrc || edition.bannerSrc;
  const conferenceTitle = day.conferenceTitle || leadActivity?.title || "Press conference";
  const conferenceCopy = day.conferenceText || leadActivity?.body || leadActivity?.description || day.description || fallbackIntro;
  const featureTitle = day.playTitle || feature?.title || leadActivity?.title || "Festival highlight";
  const featureCopy = day.playText || feature?.description || day.conclusion || day.description || fallbackIntro;
  const compactLayout = String(conferenceCopy || "").length < 900 && String(featureCopy || "").length < 900;
  const openGallery = (images, index, title) => setLightbox({ images, index, title });
  const moveLightbox = (direction) => setLightbox((current) => current ? { ...current, index: (current.index + direction + current.images.length) % current.images.length } : null);

  return <article className={`day-detail${compactLayout ? " is-compact" : ""}`} style={{ "--day-accent": dayAccents[edition.number] || "#b57a24", "--day-hero": `url("${heroImage}")` }}>
    <header className="day-hero">
      <div className="section-shell day-hero__content"><p className="kicker">{edition.title} · Day {day.dayNumber}{day.date ? ` · ${dayDate(day.date)}` : ""}</p><h1>{day.title || `Day ${day.dayNumber}`}</h1><p>{day.description || leadActivity?.description || fallbackIntro}</p></div>
      <nav className="day-tabs" aria-label="Edition festival days"><div className="section-shell">{edition.days.map((entry) => entry.isPageEnabled ? <Link className={entry.id === day.id ? "is-active" : ""} to={`/editions/${edition.slug}/days/${entry.dayNumber}`} key={entry.id} viewTransition aria-current={entry.id === day.id ? "page" : undefined}>Day {entry.dayNumber}<span>{dayDate(entry.date)}</span></Link> : <span className="is-disabled" aria-disabled="true" key={entry.id}>Day {entry.dayNumber}<span>{dayDate(entry.date)}</span></span>)}</div></nav>
    </header>

    {day.sections.conference && (day.conferenceTitle || day.conferenceText || leadActivity) && <section className="day-story section-shell">
      <div className="day-story__copy"><p className="kicker">Press conference</p><h2>{conferenceTitle}</h2>{paragraphs(conferenceCopy).map((text, index) => <p key={index}>{text}</p>)}</div>
      <ConferenceCarousel images={conferenceImages} title={conferenceTitle} onOpen={(index) => openGallery(conferenceImages, index, conferenceTitle)} />
    </section>}

    {day.sections.play && (day.playTitle || day.playText || feature) && <section className={`day-feature section-shell${!day.sections.conference ? " is-first-section" : ""}`}>
      <MovingGallery images={featureImages} title={featureTitle} onOpen={(index) => openGallery(featureImages, index, featureTitle)} />
      <div className="day-feature__copy"><p className="kicker">{day.playLabel || feature.participationType || prettyType(feature.type) || "Performance"}</p><h2>{featureTitle}</h2>{paragraphs(featureCopy).map((text, index) => <p key={index}>{text}</p>)}</div>
    </section>}

    {day.sections.recap && (day.recap ? <RecapFilm day={day} edition={edition} poster={day.recapPoster || allImages[0]} key={day.id} /> : allImages[0] && <section className="day-recap section-shell"><header className="day-recap__heading"><div><p className="kicker">{day.recapKicker}</p><h2>{day.recapTitle}</h2><p>{day.recapText}</p></div><span>{day.recapMediaLabel || "Photo story"}</span></header><div className="day-recap__media"><button type="button" onClick={() => openGallery(allImages, 0, `Day ${day.dayNumber}`)} aria-label="Open day recap image full screen"><img src={allImages[0]} alt={`Day ${day.dayNumber} recap`} /></button></div><p className="day-recap__caption">{edition.title}{day.date ? ` · ${dayDate(day.date)}` : ""}</p></section>)}

    {day.sections.memories && memories.length > 0 && <section className="day-memories section-shell" id="day-memories"><h2>More Memories</h2><div>{memories.map((src, index) => <button type="button" onClick={() => openGallery(memories, index, `Day ${day.dayNumber} memories`)} aria-label={`Open memory ${index + 1} full screen`} key={`${src}-${index}`}><img src={src} alt={`Day ${day.dayNumber} memory ${index + 1}`} /></button>)}</div></section>}

    <NewsletterSection content={{ kicker: newsletter.kicker || "Join the journey", title: newsletter.title || "Be Part of the Theatre", text: newsletter.text || "Stay updated with the latest news, programs and announcements!" }} />
    <DayLightbox gallery={lightbox} onClose={() => setLightbox(null)} onMove={moveLightbox} />
  </article>;
}
