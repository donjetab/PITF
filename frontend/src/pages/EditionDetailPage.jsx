import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, X } from "lucide-react";
import { NewsCard } from "../components/NewsCard";
import { useEditionDetail } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";

const archiveCopy = "PITF brought together bold stories, fearless artists and audiences from across borders, creating a meeting place for contemporary theatre.";
const introCopy = "From its first edition in 2017 to its tenth anniversary in 2026, PITF has brought together artists, audiences and stories from across borders.";
const journeyPlaceholderCopy = "Across the day, artists and audiences met through performances, conversations and shared moments that carried the festival beyond the stage.";
const editionTenAwardPreview = [
  { id: "preview-best-actor", awardName: "Best Actor", person: "Biljana Dragocevik Projkovska", recipient: "Chicken", country: "North Macedonia" },
  { id: "preview-student-choice", awardName: "Best Play – Student Choice", recipient: "Buongiorno", country: "Montenegro" },
  { id: "preview-best-play", awardName: "Best Play", recipient: "Chicken", country: "North Macedonia" },
  { id: "preview-media-choice", awardName: "Best Play – Media Choice", recipient: "The Kanun of the Farm", country: "Kosovo" },
  { id: "preview-best-director", awardName: "Best Director", recipient: "The Fortress", country: "Italy" },
  { id: "preview-supporting-actor", awardName: "Best Supporting Actor", person: "Armend Zeqiri", recipient: "Buongiorno", country: "Montenegro" },
  { id: "preview-special-mention", awardName: "Special Mention", recipient: "Gideon’s Knot", country: "Bosnia and Herzegovina" },
];

const editionPalettes = {
  10: { primary: "#b57a24", secondary: "#6d3515" },
  9: { primary: "#5559c9", secondary: "#252775" },
  8: { primary: "#68619a", secondary: "#292845" },
  7: { primary: "#24756b", secondary: "#153f3d" },
  6: { primary: "#1286a9", secondary: "#07516c" },
  5: { primary: "#526b75", secondary: "#25353d" },
  4: { primary: "#8274b9", secondary: "#3f3769" },
  3: { primary: "#284a9a", secondary: "#061a54" },
  2: { primary: "#bd1c5f", secondary: "#0b5d5e" },
  1: { primary: "#705977", secondary: "#423547" },
};

function compareScheduleEntries(a, b) {
  const chronologyDifference = a.timestamp - b.timestamp;
  if (chronologyDifference !== 0) return chronologyDifference;
  const aOrdered = a.order > 0;
  const bOrdered = b.order > 0;
  if (aOrdered && bOrdered && a.order !== b.order) return a.order - b.order;
  if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
  return 0;
}

function editionScheduleTimestamp(value, editionYear) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return Number.MAX_SAFE_INTEGER;
  if (date.getFullYear() !== editionYear) date.setFullYear(editionYear);
  return date.getTime();
}

function formatDateRange(edition) {
  if (!edition.dates) return String(edition.year);
  const start = new Date(`${edition.dates.start}T00:00:00`);
  const end = new Date(`${edition.dates.end}T00:00:00`);
  const startMonth = start.toLocaleDateString("en-GB", { month: "long" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "long" });
  if (start.getFullYear() !== end.getFullYear()) return `${start.getDate()} ${startMonth} ${start.getFullYear()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  return `${start.getDate()}–${end.getDate()} ${startMonth} ${end.getFullYear()}`;
}

function formatJourneyDate(day) {
  if (!day?.date) return "";
  const date = new Date(`${day.date}T00:00:00`);
  const number = date.getDate();
  const suffix = number % 10 === 1 && number !== 11 ? "st" : number % 10 === 2 && number !== 12 ? "nd" : number % 10 === 3 && number !== 13 ? "rd" : "th";
  return `${date.toLocaleDateString("en-GB", { month: "long" })} ${number}${suffix}`;
}

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

function journeyMedia(day) {
  const conference = day?.conferenceImages || [];
  const play = day?.playImages || [];
  const afterparty = day?.memoriesImages || [];
  const all = [...new Set([...conference, ...play, ...afterparty, ...(day?.images || [])].filter(Boolean))];
  const featuredImage = day?.recapImage || (!day?.recap ? play[0] || conference[0] || afterparty[0] || all[0] : null);
  const used = new Set(featuredImage ? [featuredImage] : []);
  const requested = [conference[0], play.find((image) => !used.has(image)), afterparty[0]];
  const supporting = requested.map((image) => {
    if (!image || used.has(image)) return null;
    used.add(image);
    return image;
  }).filter(Boolean);
  return {
    youtube: youtubeEmbedUrl(day?.recapYoutubeUrl),
    video: day?.recap || null,
    featuredImage,
    poster: day?.recapPoster || play[0] || conference[0] || afterparty[0] || all[0] || null,
    supporting,
  };
}

function scheduleParts(dateTime, fallbackTime = "00:00") {
  const value = String(dateTime || "");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const monthLabel = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    .toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return { date: `${year}-${month}-${day}`, day: Number(day), month: monthLabel, time: hour && minute ? `${hour}:${minute}` : fallbackTime };
}

function shortTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
}

function CeremonyIcon({ item }) {
  const isAward = item.type === "award-ceremony" || /award|ndarj.*[cç]mime/i.test(item.title || "");
  if (isAward) return <svg className="edition-program-row__ceremony-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M22 10h20v9c0 10-4 17-10 20-6-3-10-10-10-20z"/><path d="M22 15H12c0 11 5 17 14 17M42 15h10c0 11-5 17-14 17M32 39v10M22 54h20M26 49h12"/></svg>;
  if (item.type === "opening-ceremony") return <svg className="edition-program-row__ceremony-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 27h28l-4 27H22zM15 54h34M28 27l-4-10M24 17l12-5M36 12l4 4M40 16v11"/><circle cx="22" cy="15" r="3"/></svg>;
  return <svg className="edition-program-row__ceremony-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 12h40v40H12zM20 12c0 14 3 25 12 40M44 12c0 14-3 25-12 40M12 42h40"/></svg>;
}

function isActorCredit(entry) {
  return /^(actor|actress|aktor|aktore|aktori|aktorja)$/i.test(String(entry?.role || "").trim());
}

function ProgramRow({ item }) {
  const schedule = scheduleParts(item.startsAt);
  const [isExpanded, setIsExpanded] = useState(false);
  const actors = (item.creditEntries || []).filter(isActorCredit);
  const staff = (item.creditEntries || []).filter((entry) => !isActorCredit(entry));
  const legacyCredits = item.creditEntries?.length ? "" : String(item.credits || "").trim();
  const hasLegacyCredits = Boolean(legacyCredits && legacyCredits !== "[]" && legacyCredits !== "{}");
  const hasMoreInfo = Boolean(item.description || actors.length || staff.length || hasLegacyCredits);

  return (
    <article className={`edition-program-row${isExpanded ? " is-expanded" : ""}`}>
      <div className="edition-program-row__image">
        {item.imageSrc ? <img src={item.imageSrc} alt="" /> : <span>Cover coming soon</span>}
      </div>
      <time dateTime={item.startsAt}><span>{schedule?.month || "TBA"}</span><strong>{schedule?.day || "—"}</strong></time>
      <div className="edition-program-row__time">{schedule?.time || "TBA"}</div>
      <div className="edition-program-row__play">
        <span>{[item.country, item.participationType].filter(Boolean).join(" · ")}</span><h3>{item.title}</h3><p>{item.company}</p>
        {item.director && <p>Director: {item.director}</p>}
      </div>
      {item.venue && <div className="edition-program-row__venue"><span>Location</span><p>{item.venue}</p></div>}
      {hasMoreInfo && (
        <button
          className="edition-program-row__toggle"
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Hide" : "Show"} details for ${item.title}`}
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          <span aria-hidden="true" />
        </button>
      )}
      {hasMoreInfo && <div className="edition-program-row__details" aria-hidden={!isExpanded}><div className="edition-program-row__details-inner">
        {actors.length > 0 && <section className="edition-program-row__actors"><strong>Actors</strong><ul>{actors.map((entry, index) => <li key={`${entry.name}-${index}`}>{entry.name}</li>)}</ul></section>}
        {staff.length > 0 && <section className="edition-program-row__staff"><strong>Creative &amp; production staff</strong><dl className="edition-program-row__credits">{staff.map((entry, index) => <div key={`${entry.role}-${index}`}><dt>{entry.role}</dt><dd>{entry.name}</dd></div>)}</dl></section>}
        {hasLegacyCredits && <section><strong>Cast &amp; credits</strong><p>{legacyCredits}</p></section>}
        {item.description && <section className="edition-program-row__synopsis"><strong>Synopsis</strong><p>{item.description}</p></section>}
      </div></div>}
    </article>
  );
}

function SpecialProgramRow({ item }) {
  const schedule = scheduleParts(item.date, item.startTime || "TBA");
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreInfo = Boolean(item.description || item.body);
  return <article className={`edition-program-row edition-program-row--special edition-program-row--${item.type}${isExpanded ? " is-expanded" : ""}`}>
    <div className="edition-program-row__image"><CeremonyIcon item={item} /><span>{item.type === "opening-ceremony" ? "Opening" : item.type === "closing-ceremony" ? "Closing" : item.type?.replaceAll("-", " ")}</span></div>
    <time dateTime={schedule ? `${schedule.date}T${item.startTime || "00:00"}` : undefined}><span>{schedule?.month || "TBA"}</span><strong>{schedule?.day || "—"}</strong></time>
    <div className="edition-program-row__time">{shortTime(item.startTime) || "TBA"}</div>
    <div className="edition-program-row__play"><span>{item.type?.replaceAll("-", " ")}</span><h3>{item.title || (item.type === "opening-ceremony" ? "Opening Ceremony" : item.type === "closing-ceremony" ? "Closing Ceremony" : "Festival activity")}</h3>{item.description && <p>{item.description}</p>}</div>
    {item.venue && <div className="edition-program-row__venue"><span>Location</span><p>{item.venue}</p></div>}
    {hasMoreInfo && <button className="edition-program-row__toggle" type="button" aria-expanded={isExpanded} onClick={() => setIsExpanded((expanded) => !expanded)}><span aria-hidden="true" /></button>}
    {hasMoreInfo && <div className="edition-program-row__details" aria-hidden={!isExpanded}><div className="edition-program-row__details-inner">{item.description && <section><strong>About</strong><p>{item.description}</p></section>}{item.body && <section><strong>Details</strong><p>{item.body}</p></section>}</div></div>}
  </article>;
}

function ViewportVideo({ src, poster, className = "" }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.pause();
    video.load();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          video.muted = true;
          video.play()?.catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.55, 1] },
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [src]);

  return (
    <video ref={videoRef} className={className} controls muted playsInline preload="metadata" poster={poster} key={src}>
      <source src={src} type="video/mp4" />
      Your browser does not support the video element.
    </video>
  );
}

function awardPlayTitle(award, program) {
  const play = program.find((entry) => entry.id === award.programItemId);
  return play?.title || play?.translations?.en?.title || play?.slug || "";
}

function FestivalAwards({ awards, year, program }) {
  return (
    <section className="edition-awards section-shell" aria-labelledby="edition-awards-title">
      <div className="edition-awards__identity">
        <span className="edition-awards__decoration" aria-hidden="true" />
        <div><h2 id="edition-awards-title">Festival Awards</h2><strong>{year}</strong></div>
      </div>
      <div className="edition-awards__list">
        {awards.map((award) => (
          <article className="edition-awards__item" key={award.id}>
            <h3>{award.awardType || award.awardName || award.name || "Festival Award"}</h3>
            <div>
              {(award.person || award.recipient) && <strong>{award.person || award.recipient}</strong>}
              <div className="edition-awards__meta">
                {award.person && awardPlayTitle(award, program) && <span>“{awardPlayTitle(award, program)}”</span>}
                {award.country && <small>{award.country}</small>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EditionDetailPage() {
  const { editionSlug } = useParams();
  const pageRef = useRef(null);
  const edition = useEditionDetail(editionSlug);
  const editionId = edition?.id;
  const program = edition?.program || [];
  const scheduledDays = edition?.days || [];
  const editionNews = edition?.news || [];
  const [activeDay, setActiveDay] = useState(0);
  const [visibleMemoryCount, setVisibleMemoryCount] = useState(6);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const gallery = edition?.gallery || [];
  const days = scheduledDays.filter((day) => day.isPageEnabled);
  const ceremonyTypes = new Set(["opening-ceremony", "closing-ceremony", "award-ceremony"]);
  const specialProgram = days.flatMap((day) => (day.activities || []).filter((activity) => ceremonyTypes.has(activity.type)).map((activity) => ({ ...activity, date: day.date, dayNumber: day.dayNumber })));
  const completeSchedule = [...program.map((item) => ({ kind: "performance", order: Number(item.order || 0), timestamp: editionScheduleTimestamp(item.startsAt, edition.year), item })), ...specialProgram.map((item) => ({ kind: "special", order: Number(item.order || 0), timestamp: editionScheduleTimestamp(`${item.date || ""}T${item.startTime || "23:59"}`, edition.year), item }))].sort(compareScheduleEntries);

  useEffect(() => {
    setActiveDay(0);
    setVisibleMemoryCount(6);
    setSelectedMemory(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [editionSlug]);

  useEffect(() => {
    if (selectedMemory === null) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedMemory(null);
      if (event.key === "ArrowLeft") setSelectedMemory((index) => (index - 1 + gallery.length) % gallery.length);
      if (event.key === "ArrowRight") setSelectedMemory((index) => (index + 1) % gallery.length);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedMemory, gallery.length]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !editionId) return undefined;

    const groups = [
      ".edition-detail__heading > *, .edition-detail__hero",
      ".edition-story__rule, .edition-story__copy, .edition-story__image",
      ".edition-program > h2, .edition-program-row",
      ".edition-awards__identity, .edition-awards__item",
      ".edition-journey__tabs, .edition-journey__label",
      ".edition-news .edition-section-heading, .edition-news__grid, .edition-news__all",
      ".edition-memories .edition-section-heading, .edition-memories__grid, .edition-memories__more",
      ".edition-detail__archive-nav",
    ];

    const elements = [];
    groups.forEach((selector) => {
      page.querySelectorAll(selector).forEach((element, index) => {
        element.classList.add("motion-reveal");
        element.style.setProperty("--motion-delay", `${Math.min(index, 6) * 65}ms`);
        elements.push(element);
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -7%" });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [editionSlug, editionId]);

  if (edition === undefined) return <PublicLoading label="Preparing the edition" />;

  if (edition === null) {
    return <section className="edition-detail edition-detail--missing"><p className="kicker">PITF Editions</p><h1>Edition not found</h1><Link className="outline-button" to="/editions">Back to editions</Link></section>;
  }

  const activeProgram = program.find((item) => String(item.startsAt || "").slice(0, 10) === days[activeDay]?.date);
  const activeDayMedia = days[activeDay];
  const activeDayJourneyMedia = journeyMedia(activeDayMedia);
  const activeDayHasMedia = Boolean(activeDayJourneyMedia.youtube || activeDayJourneyMedia.video || activeDayJourneyMedia.featuredImage || activeDayJourneyMedia.supporting.length);
  const activeScheduledDay = scheduledDays.findIndex((day) => day.id === activeDayMedia?.id);
  const legacyPalette = editionPalettes[edition.number] || editionPalettes[10];
  const editionPalette = {
    primary: edition.primaryColor || legacyPalette.primary,
    secondary: edition.secondaryColor || legacyPalette.secondary,
  };
  const recapSrc = edition.recapSrc;
  const recapIsVideo = edition.recapType === "video";
  const recapIsImage = edition.recapType === "image" && edition.recapImageSrc;
  const editionHasEnded = edition.dates?.end ? new Date(`${edition.dates.end}T23:59:59`) < new Date() : edition.year < new Date().getFullYear();
  const awards = edition.awards?.length ? edition.awards : edition.number === 10 && editionHasEnded ? editionTenAwardPreview : [];

  return (
    <article
      ref={pageRef}
      className="edition-detail"
      style={{
        "--edition-accent": editionPalette.primary,
        "--edition-accent-secondary": editionPalette.secondary,
      }}
    >
      <header className="edition-detail__intro section-shell">
        <div className="edition-detail__heading">
          <span className="edition-detail__number" aria-hidden="true">{String(edition.number).padStart(2, "0")}</span>
          <h1>{edition.title}</h1>
          <strong>{formatDateRange(edition)}</strong>
          <p>{edition.headerDescription || edition.description || introCopy}</p>
          <i aria-hidden="true" />
        </div>
        <div className="edition-detail__hero">
          <img
            src={edition.detailHeaderSrc}
            alt={`${edition.title} header background`}
          />
        </div>
      </header>

      <section className="edition-story section-shell">
        <div className="edition-story__copy">
          <h2>
            <span>{edition.storyTitle || edition.title}</span>
            <span>{edition.storySubtitle || (edition.number === 10 ? "A decade of Theatre." : "A celebration of theatre.")}</span>
          </h2>
          <p>{edition.storyDescription || edition.description || archiveCopy}</p>
        </div>
        <span className="edition-story__rule" aria-hidden="true" />
        <div className={`edition-story__image${recapIsVideo ? " edition-story__image--video" : recapIsImage ? " edition-story__image--photo" : " edition-story__image--placeholder"}`}>
          {recapIsVideo ? (
            <ViewportVideo src={recapSrc} poster={edition.detailHeaderSrc} />
          ) : recapIsImage ? (
            <img src={edition.recapImageSrc} alt={`${edition.title} recap`} />
          ) : (
            <div className="edition-story__placeholder-content">
              <span aria-hidden="true">▶</span>
              <strong>Edition preview</strong>
              <small>Coming soon</small>
            </div>
          )}
        </div>
      </section>

      {completeSchedule.length > 0 && <section className="edition-program section-shell"><h2><span>{edition.year}</span> Program</h2><div>{completeSchedule.map((entry) => entry.kind === "performance" ? <ProgramRow item={entry.item} key={`performance-${entry.item.id}`} /> : <SpecialProgramRow item={entry.item} key={`special-${entry.item.id}`} />)}</div></section>}

      {awards.length > 0 && <FestivalAwards awards={awards} year={edition.year} program={program} />}

      {scheduledDays.length > 0 && days.length > 0 && (
        <section className="edition-journey section-shell">
          <div
            className="edition-journey__tabs"
            role="tablist"
            aria-label="Festival days"
            style={{ "--journey-day-count": scheduledDays.length, "--journey-indicator": `${((activeScheduledDay + 0.5) / scheduledDays.length) * 100}%` }}
          >
            {scheduledDays.map((day) => { const enabledIndex = days.findIndex((enabledDay) => enabledDay.id === day.id); const date = day.date && new Date(`${day.date}T00:00:00`).toLocaleDateString("en-GB", { month: "short", day: "numeric" }); return enabledIndex < 0 ? <div className="is-disabled" role="tab" aria-disabled="true" key={day.id}><strong>Day {day.dayNumber}</strong>{date && <span>{date}</span>}</div> : <button className={enabledIndex === activeDay ? "is-active" : ""} key={day.id} onClick={() => setActiveDay(enabledIndex)} role="tab" aria-selected={enabledIndex === activeDay}><strong>Day {day.dayNumber}</strong>{date && <span>{date}</span>}</button>; })}
          </div>
          <div className="edition-journey__frame">
            <p className="edition-journey__label">Our journey through the days</p>
          <div className="edition-journey__copy" data-day={days[activeDay]?.dayNumber || activeDay + 1} key={`copy-${activeDay}`}><h2>Day {days[activeDay]?.dayNumber || activeDay + 1}{formatJourneyDate(days[activeDay]) ? ` – ${formatJourneyDate(days[activeDay])}` : ""}</h2><p>{days[activeDay]?.description || edition.description || archiveCopy}</p>{!days[activeDay]?.description && <p>{journeyPlaceholderCopy}</p>}{days[activeDay]?.conclusion && <p>{days[activeDay].conclusion}</p>}{activeProgram?.company && <p>{activeProgram.company}</p>}{days[activeDay]?.isPageEnabled ? <Link className="outline-button" to={`/editions/${edition.slug}/days/${days[activeDay]?.dayNumber || activeDay + 1}`}>Explore day {days[activeDay]?.dayNumber || activeDay + 1} <span>→</span></Link> : <span className="outline-button is-disabled" aria-disabled="true">Details coming soon</span>}</div>
            <div className={`edition-journey__media${activeDayHasMedia ? "" : " is-empty"}`} key={`media-${activeDay}`}>
              {activeDayJourneyMedia.youtube ? (
                <iframe key={`youtube-${days[activeDay]?.id}`} className="is-featured" src={activeDayJourneyMedia.youtube} title={`${days[activeDay]?.title || `Day ${activeDay + 1}`} film`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              ) : activeDayJourneyMedia.video ? (
                <ViewportVideo key={`video-${days[activeDay]?.id}-${activeDayJourneyMedia.video}`} className="is-featured" src={activeDayJourneyMedia.video} poster={activeDayJourneyMedia.poster} />
              ) : activeDayJourneyMedia.featuredImage ? (
                <img src={activeDayJourneyMedia.featuredImage} alt="" className="is-featured" />
              ) : null}
              {activeDayJourneyMedia.supporting.map((image) => <img src={image} alt="" key={image} />)}
              {!activeDayHasMedia && <div className="edition-journey__placeholder"><span>Day {days[activeDay]?.dayNumber || activeDay + 1}</span><strong>Content coming soon</strong><p>Photographs and highlights will appear here as this festival day is filled.</p></div>}
            </div>
          </div>
        </section>
      )}

      {editionNews.length > 0 && <section className="edition-news section-shell"><div className="edition-section-heading"><h2>News of the edition</h2><p>Stories and highlights from PITF {edition.year}.</p></div><div className="edition-news__grid">{editionNews.slice(0, 3).map((item) => <NewsCard item={item} key={item.id} />)}</div><Link className="edition-news__all" to={`/news?edition=${edition.number}`}>View all news →</Link></section>}

      {gallery.length > 0 && <section className="edition-memories section-shell" id="edition-memories">
        <div className="edition-section-heading"><h2>Memories</h2><p>Moments from the {edition.title.toLowerCase()}.</p></div>
        <div className="edition-memories__grid">{gallery.slice(0, visibleMemoryCount).map((image, index) => <button className="edition-memory-tile" style={{ "--memory-delay": `${(index % 9) * 55}ms` }} type="button" onClick={() => setSelectedMemory(index)} aria-label={`Open memory ${index + 1}`} key={image}><img src={image} alt="" /><span>View memory</span></button>)}</div>
        {gallery.length > 6 && (
          <button className="outline-button edition-memories__more" type="button" onClick={() => setVisibleMemoryCount((count) => count >= gallery.length ? 6 : Math.min(count + 9, gallery.length))}>
            {visibleMemoryCount >= gallery.length ? "Show less" : "See more"} <span>{visibleMemoryCount >= gallery.length ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}</span>
          </button>
        )}
        {selectedMemory !== null && gallery[selectedMemory] && createPortal((
          <div className="edition-lightbox" role="dialog" aria-modal="true" aria-label="Edition memories">
            <button className="edition-lightbox__close" type="button" onClick={() => setSelectedMemory(null)} aria-label="Close gallery"><X aria-hidden="true" /></button>
            <button className="edition-lightbox__arrow edition-lightbox__arrow--previous" type="button" onClick={() => setSelectedMemory((index) => (index - 1 + gallery.length) % gallery.length)} aria-label="Previous image"><ChevronLeft aria-hidden="true" /></button>
            <figure key={selectedMemory}><img src={gallery[selectedMemory]} alt="" /><figcaption>{selectedMemory + 1} / {gallery.length}</figcaption></figure>
            <button className="edition-lightbox__arrow edition-lightbox__arrow--next" type="button" onClick={() => setSelectedMemory((index) => (index + 1) % gallery.length)} aria-label="Next image"><ChevronRight aria-hidden="true" /></button>
          </div>
        ), document.body)}
      </section>}
      <nav className="edition-detail__archive-nav section-shell" aria-label="Edition navigation">
        <Link className="outline-button" to="/editions">← All editions</Link>
      </nav>
    </article>
  );
}
