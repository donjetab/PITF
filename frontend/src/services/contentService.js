import { useEffect, useSyncExternalStore } from "react";
import { isStatic, readStaticContent } from "./contentSource";

const listeners = new Set();
const detailRequests = new Map();
let coreRequest;
let newsArchiveRequest;
let coreRetryTimer;
let coreFocusRefreshBound = false;
const contentRevisionKey = "pitf-content-revision";
let snapshot = {
  revision: 0,
  loading: false,
  ready: false,
  error: null,
  language: localStorage.getItem("pitf-language") || "en",
  raw: { editions: [], news: [], pages: [], about: [], homepage: null, site: null, contact: null },
  editionDetails: new Map(),
  newsDetails: new Map(),
};

function publish(change = {}) {
  snapshot = { ...snapshot, ...change, revision: snapshot.revision + 1 };
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function api(path) {
  if (isStatic) return readStaticContent(path);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`PITF API ${response.status}: ${path}`);
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function ensureCore() {
  if (!coreFocusRefreshBound) {
    const refresh = () => {
      coreRequest = undefined;
      ensureCore();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pitf-content-updated", refresh);
    window.addEventListener("storage", (event) => {
      if (event.key === contentRevisionKey) refresh();
    });
    coreFocusRefreshBound = true;
  }
  if (coreRequest) return coreRequest;
  publish({ loading: true, error: null });
  coreRequest = Promise.all([
    api("/api/public/homepage"), api("/api/public/about"), api("/api/public/site"),
    api("/api/public/contact"),
  ]).then(([homepage, about, site, contact]) => {
    window.clearTimeout(coreRetryTimer);
    coreRetryTimer = undefined;
    publish({
      loading: false, ready: true,
      raw: {
        homepage, about, site, contact,
        editions: homepage.editions || [], pages: site.pages || [],
        news: [],
      },
    });
  }).catch((error) => {
    coreRequest = undefined;
    publish({ loading: false, error: error.message });
    window.clearTimeout(coreRetryTimer);
    if (!isStatic) coreRetryTimer = window.setTimeout(() => {
      coreRetryTimer = undefined;
      ensureCore();
    }, 1200);
  });
  return coreRequest;
}

function loadNewsArchive() {
  if (newsArchiveRequest) return newsArchiveRequest;
  newsArchiveRequest = (async () => {
    const first = await api("/api/public/news?page=1&pageSize=100");
    let items = first.items || [];
    publish({ raw: { ...snapshot.raw, news: items } });
    for (let page = 2; page <= first.totalPages; page += 1) {
      const result = await api(`/api/public/news?page=${page}&pageSize=100`);
      items = [...items, ...(result.items || [])];
      publish({ raw: { ...snapshot.raw, news: items } });
    }
  })().catch((error) => {
    newsArchiveRequest = undefined;
    publish({ error: error.message });
    if (!isStatic) window.setTimeout(loadNewsArchive, 1200);
  });
  return newsArchiveRequest;
}

function translated(entity, language = snapshot.language) {
  const translations = entity?.translations || {};
  return translations[language] || translations.en || translations.sq || translations.bs || {};
}

function translatedPageContent(entity, language = snapshot.language) {
  const base = entity?.content && typeof entity.content === "object" ? entity.content : {};
  if (language === "en") return base;
  const copy = entity?.translations?.[language] || {};
  return Object.fromEntries(Object.entries({ ...base, ...copy }).map(([key, value]) => {
    const firstCharacter = typeof value === "string" ? value.trim()[0] : "";
    if (firstCharacter !== "[" && firstCharacter !== "{") return [key, value];
    try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
  }));
}

function mediaUrl(media, size = "medium") {
  if (!media) return null;
  return media[`${size}Url`] || media.largeUrl || media.mediumUrl || media.thumbnailUrl || media.originalUrl || null;
}

function editionMap() {
  return new Map(snapshot.raw.editions.map((edition) => [edition.id, edition]));
}

function mapEdition(raw) {
  if (!raw) return null;
  const copy = translated(raw);
  return {
    id: raw.number, dbId: raw.id, slug: raw.slug, number: raw.number, year: raw.year,
    primaryColor: raw.primaryColor || null, secondaryColor: raw.secondaryColor || null,
    title: copy.title || `${raw.number} Edition`, description: copy.description || null,
    headerDescription: copy.headerDescription || null,
    storyTitle: copy.storyTitle || null, storySubtitle: copy.storySubtitle || null,
    storyDescription: copy.storyDescription || null,
    dates: raw.startDate && raw.endDate ? { start: raw.startDate, end: raw.endDate } : null,
    logoSrc: mediaUrl(raw.backgroundMedia, "medium") || `${import.meta.env.BASE_URL}assets/act-outline-icon.png`,
    bannerSrc: mediaUrl(raw.heroMedia, "large") || `${import.meta.env.BASE_URL}assets/editions-header.jpg`,
    detailHeaderSrc: mediaUrl(raw.detailHeaderMedia, "large") || mediaUrl(raw.heroMedia, "large") || `${import.meta.env.BASE_URL}assets/editions-header.jpg`,
    heroMedia: raw.heroMedia, detailHeaderMedia: raw.detailHeaderMedia, backgroundMedia: raw.backgroundMedia,
  };
}

function mapProgram(raw, editionNumber) {
  const copy = translated(raw);
  let creditEntries = [];
  if (raw.credits) {
    try { const parsed = JSON.parse(raw.credits); if (Array.isArray(parsed)) creditEntries = parsed.filter((entry) => entry?.role || entry?.name); }
    catch { creditEntries = [{ role: "Cast & credits", name: raw.credits }]; }
  }
  return {
    id: raw.id, editionId: editionNumber, slug: raw.slug, participationType: raw.participationType || "Official Competition",
    title: copy.title || "PITF performance", description: copy.description || copy.synopsis || null,
    country: copy.country || raw.translations?.en?.country || raw.translations?.sq?.country || raw.translations?.bs?.country || raw.country,
    company: copy.company || raw.translations?.en?.company || raw.translations?.sq?.company || raw.translations?.bs?.company || raw.company,
    director: raw.director, credits: raw.credits, creditEntries,
    startsAt: raw.startsAt, venue: raw.venue, order: Number(raw.order || 0),
    imageSrc: mediaUrl(raw.poster, "medium"), trailerSrc: raw.trailer?.type === "video" ? raw.trailer.originalUrl : null,
  };
}

function mapNews(raw) {
  const edition = editionMap().get(raw.editionId);
  const copy = translated(raw);
  return {
    id: raw.id, editionId: edition?.number, editionYear: edition?.year, slug: copy.slug || raw.slug,
    date: raw.date, suggestedType: raw.category, title: copy.title || "PITF news",
    summary: copy.summary || "", body: copy.body || "", imageSrc: raw.cardThumbnailUrl || null,
    videoSrc: raw.coverMedia?.type === "video" ? raw.coverMedia.originalUrl : null,
    mediaImages: raw.coverMedia ? [mediaUrl(raw.coverMedia, "large")].filter(Boolean) : [],
    contentMode: raw.contentMode, isExternalOnly: raw.isExternalOnly,
    externalUrl: raw.externalUrl, externalTarget: raw.externalTarget || "_blank",
    detailAvailable: raw.staticDetailAvailable !== false,
  };
}

function mapSponsor(raw) {
  return { id: raw.id, name: raw.name, logoSrc: mediaUrl(raw.logo, "medium"), website: raw.url, category: raw.category };
}

function mapDay(raw, galleries) {
  const copy = translated(raw);
  const activityIds = new Set((raw.activities || []).map((activity) => activity.id));
  const dayGalleries = galleries.filter((item) => item.festivalDayId === raw.id || activityIds.has(item.activityId));
  const media = dayGalleries.flatMap((gallery) => gallery.media || []);
  return {
    id: raw.id, dayNumber: raw.dayNumber, date: raw.date,
    isPageEnabled: Boolean(raw.isPageEnabled),
    sections: {
      header: Boolean(raw.isHeaderVisible), conference: Boolean(raw.isConferenceVisible),
      play: Boolean(raw.isPlayVisible), recap: Boolean(raw.isRecapVisible), memories: Boolean(raw.isMemoriesVisible),
    },
    title: copy.title || `Day ${raw.dayNumber}`, description: copy.description || null, conclusion: copy.conclusion || null,
    headerImage: mediaUrl(raw.headerMedia, "large") || null,
    recapKicker: copy.recapKicker || `Day ${raw.dayNumber} recap`, recapTitle: copy.recapTitle || "The Day in a Glance", recapText: copy.recapText || "A short look back at the performances, conversations and encounters that shaped the festival day.",
    recapYoutubeUrl: raw.recapYoutubeUrl || null,
    recapMediaLabel: copy.recapMediaLabel || null, recapPlayLabel: copy.recapPlayLabel || "Play recap",
    conferenceTitle: copy.conferenceTitle || null, conferenceText: copy.conferenceText || null,
    playLabel: copy.playLabel || null, playTitle: copy.playTitle || null, playText: copy.playText || null,
    conferenceImages: (raw.conferenceMedia || []).filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean),
    playImages: (raw.playMedia || []).filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean),
    memoriesImages: (raw.memoriesMedia || []).filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean),
    activities: (raw.activities || []).map((activity) => ({ ...activity, ...translated(activity), images: dayGalleries.filter((gallery) => gallery.activityId === activity.id).flatMap((gallery) => gallery.media || []).filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean) })),
    images: media.filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean),
    recap: raw.recapMedia?.type === "video" ? raw.recapMedia.originalUrl : raw.recapYoutubeUrl || null,
    recapImage: raw.recapMedia?.type === "image" ? mediaUrl(raw.recapMedia, "large") : null,
    recapPoster: raw.recapMedia?.videoPosterUrl || null,
  };
}

function mapEditionDetail(raw) {
  if (!raw) return null;
  const edition = mapEdition(raw.edition);
  const galleries = raw.galleries || [];
  const curatedMemoryGalleries = galleries.filter((gallery) => !gallery.festivalDayId && !gallery.activityId && !gallery.programItemId);
  return {
    ...edition,
    recapSrc: raw.recapMedia?.originalUrl || null,
    recapImageSrc: raw.recapMedia?.type === "image" ? mediaUrl(raw.recapMedia, "large") : null,
    recapType: raw.recapMedia?.type || null,
    recap: raw.recapTranslations || {},
    program: (raw.program || []).map((item) => mapProgram(item, edition.number)),
    days: (raw.days || []).map((day) => mapDay(day, galleries)),
    news: (raw.news || []).map(mapNews),
    gallery: [...new Set(curatedMemoryGalleries.flatMap((gallery) => gallery.media || []).filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean))],
    sponsors: (raw.sponsors || []).map(mapSponsor),
    awards: (raw.awards || []).map((award) => ({ ...award, ...translated(award) })),
  };
}

function mapNewsDetail(raw) {
  if (!raw) return null;
  const card = mapNews(raw.card);
  const media = raw.media || [];
  return {
    ...card, status: raw.status, publishedAt: raw.publishedAt,
    festivalDayId: raw.festivalDayId, activityId: raw.activityId, programItemId: raw.programItemId,
    mediaImages: media.filter((item) => item.type === "image").map((item) => mediaUrl(item, "large")).filter(Boolean),
    videos: media.filter((item) => item.type === "video").map((item) => ({ src: item.originalUrl, poster: item.videoPosterUrl })),
    externalLinks: raw.externalLinks || [],
  };
}

function loadDetail(kind, slug) {
  const key = `${kind}:${slug}`;
  if (detailRequests.has(key)) return;
  detailRequests.set(key, api(`/api/public/${kind}/${encodeURIComponent(slug)}`)
    .then((value) => {
      const field = kind === "editions" ? "editionDetails" : "newsDetails";
      const next = new Map(snapshot[field]); next.set(slug, value); publish({ [field]: next });
    })
    .catch(() => {
      const field = kind === "editions" ? "editionDetails" : "newsDetails";
      const next = new Map(snapshot[field]); next.set(slug, null); publish({ [field]: next });
    })
    .finally(() => detailRequests.delete(key)));
}

export function useContentData() {
  const value = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => { ensureCore(); }, []);
  return value;
}

export function useNewsArchive() {
  const value = useContentData();
  useEffect(() => { loadNewsArchive(); }, []);
  return value;
}

export function useEditionDetail(slug) {
  const value = useContentData();
  useEffect(() => {
    if (!slug) return undefined;
    loadDetail("editions", slug);
    const refresh = () => loadDetail("editions", slug);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [slug]);
  return value.editionDetails.has(slug) ? mapEditionDetail(value.editionDetails.get(slug)) : undefined;
}

export function useNewsDetail(slug) {
  const value = useContentData();
  useEffect(() => { if (slug) loadDetail("news", slug); }, [slug]);
  return value.newsDetails.has(slug) ? mapNewsDetail(value.newsDetails.get(slug)) : undefined;
}

function section(page, key) {
  return snapshot.raw.pages.find((item) => item.pageKey === page && item.sectionKey === key)
    || snapshot.raw.about.find((item) => item.pageKey === page && item.sectionKey === key);
}

export const contentService = {
  refresh() {
    localStorage.setItem(contentRevisionKey, String(Date.now()));
    window.dispatchEvent(new Event("pitf-content-updated"));
  },
  getSite() {
    const raw = snapshot.raw.site;
    const settings = Object.fromEntries((raw?.settings || []).map((item) => [item.key, item.value]));
    const localizedSetting = (key, fallback) => settings[snapshot.language === "en" ? key : `${key}.${snapshot.language}`] || settings[key] || fallback;
    let footerSections = null;
    try { const parsed = JSON.parse(localizedSetting("footer.sections", "null")); if (Array.isArray(parsed)) footerSections = parsed; } catch { /* use the legacy footer structure */ }
    return {
      name: settings["site.name"] || "PITF", shortName: settings["site.shortName"] || "PITF",
      navigation: (raw?.navigation || []).map((item) => ({ label: translated(item).label || item.key, to: item.url, target: item.target })),
      socialLinks: ["instagram", "facebook", "tiktok"].map((name) => ({ label: name[0].toUpperCase() + name.slice(1), href: settings[`social.${name}`] || "#" })),
      location: settings["contact.location"] || "", copyright: localizedSetting("footer.copyright", ""),
      footerLabels: {
        festival: localizedSetting("footer.festivalTitle", "Festival"),
        contact: localizedSetting("footer.contactTitle", "Contact us"),
        contactPage: localizedSetting("footer.contactPageLabel", "Contact page"),
        follow: localizedSetting("footer.followTitle", "Follow us"),
      },
      footerSections,
    };
  },
  getHomeContent() {
    const homepage = snapshot.raw.homepage;
    const aboutSection = homepage?.aboutPreview?.[0];
    const heroSection = homepage?.hero?.[0];
    return {
      hero: { ...(heroSection?.content || {}), imageSrc: mediaUrl(heroSection?.media, "large") },
      about: { ...(aboutSection?.content || {}), imageSrc: mediaUrl(aboutSection?.media, "large") },
      newsletter: homepage?.newsletterCta?.[0]?.content || {},
    };
  },
  getHomepageSections: () => snapshot.raw.homepage?.sections || [],
  getEditions: () => snapshot.raw.editions.map(mapEdition),
  getLatestEdition() {
    const edition = mapEdition(snapshot.raw.homepage?.featuredEdition?.edition);
    if (!edition) return null;
    const feature = section("home", "latest-edition")?.content || {};
    if (edition.dates) {
      const start = new Date(`${edition.dates.start}T00:00:00`);
      const end = new Date(`${edition.dates.end}T00:00:00`);
      edition.dateLabel = `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-GB", { month: "long" })} ${edition.year}`;
    }
    return { ...edition, featureTitle: feature.title || null, featureText: feature.text || null };
  },
  getFeaturedProgram: () => (snapshot.raw.homepage?.featuredProgram || []).map((item) => mapProgram(item, snapshot.raw.homepage?.featuredEdition?.edition?.number)),
  getFeaturedNews: () => (snapshot.raw.homepage?.featuredNews || []).map(mapNews),
  getSponsors: () => (snapshot.raw.homepage?.sponsors || []).map(mapSponsor),
  getNews: () => snapshot.raw.news.map(mapNews),
  getLocalizedNewsSlug(currentSlug, language) {
    const rows = [...snapshot.raw.news, ...[...snapshot.newsDetails.values()].map((detail) => detail?.card).filter(Boolean)];
    const article = rows.find((item) => item.slug === currentSlug || Object.values(item.translations || {}).some((translation) => translation?.slug === currentSlug));
    return article?.translations?.[language]?.slug || article?.slug || currentSlug;
  },
  getPageContent: (page, key) => section(page, key),
  getAbout() {
    const sections = Object.fromEntries(snapshot.raw.about.map((item) => [item.sectionKey, { ...item, content: translatedPageContent(item) }]));
    return { sections, newsletter: this.getHomeContent().newsletter };
  },
  getContact() {
    const entry = snapshot.raw.contact?.content?.[0];
    const content = translatedPageContent(entry);
    const settings = Object.fromEntries((snapshot.raw.contact?.settings || []).map((item) => [item.key, item.value]));
    return { ...content, imageSrc: mediaUrl(entry?.media, "large"), settings };
  },
  setLanguage(language) {
    const code = language.toLowerCase();
    localStorage.setItem("pitf-language", code); publish({ language: code });
  },
};
