const status = { name: "status", label: "Status", type: "select", options: ["Draft", "Published", "Archived"] };
const order = { name: "order", label: "Order", type: "number" };
const publishedAt = { name: "publishedAt", label: "Publish at", type: "datetime" };
const edition = { name: "editionId", label: "Edition", type: "relation", resource: "editions", required: true };

export const resourceConfig = {
  editions: { title: "Editions", singular: "Edition", icon: "10", fields: [
    { name: "number", label: "Edition number", type: "number", required: true }, { name: "year", label: "Year", type: "number", required: true },
    { name: "startDate", label: "Start date", type: "date" }, { name: "endDate", label: "End date", type: "date" }, { name: "slug", label: "Slug", required: true },
    { name: "primaryColor", label: "Primary color", type: "color" }, { name: "secondaryColor", label: "Secondary color", type: "color" }, status, publishedAt, order,
    { name: "heroMediaId", label: "Editions page banner", type: "media" }, { name: "detailHeaderMediaId", label: "Edition page header photograph", type: "media" }, { name: "backgroundMediaId", label: "Edition logo", type: "media" }, { name: "recapMediaId", label: "Recap video or photograph", type: "media" },
  ], translations: ["title", "headerDescription", "storyTitle", "storySubtitle", "storyDescription", "recapTitle", "recapText"] },
  days: { title: "Festival days", singular: "Festival day", fields: [
    edition, { name: "date", label: "Date", type: "date", required: true }, { name: "dayNumber", label: "Day", type: "daySelect", required: true }, order,
    { name: "isPageEnabled", label: "Enable day page", type: "checkbox" },
    { name: "isHeaderVisible", label: "Show header", type: "checkbox" },
    { name: "headerMediaId", label: "Header image", type: "media" },
    { name: "recapMediaId", label: "Recap video", type: "media" },
    { name: "recapYoutubeUrl", label: "YouTube video link (overrides uploaded video)", type: "url" },
    { name: "isConferenceVisible", label: "Show conference", type: "checkbox" },
    { name: "isPlayVisible", label: "Show play / ceremony", type: "checkbox" },
    { name: "isRecapVisible", label: "Show recap", type: "checkbox" },
    { name: "isMemoriesVisible", label: "Show memories", type: "checkbox" },
    { name: "conferenceMediaIdsJson", label: "Conference images", type: "mediaJson" },
    { name: "playMediaIdsJson", label: "Play / ceremony images", type: "mediaJson" },
    { name: "memoriesMediaIdsJson", label: "Afterparty / memories images", type: "mediaJson" },
  ], translations: ["title", "description", "conclusion", "conferenceTitle", "conferenceText", "playLabel", "playTitle", "playText", "recapKicker", "recapTitle", "recapText", "recapMediaLabel", "recapPlayLabel"] },
  activities: { title: "Activities", singular: "Activity", fields: [
    { name: "festivalDayId", label: "Festival day", type: "relation", resource: "days", required: true },
    { name: "type", label: "Activity type", type: "select", options: ["performance", "press-conference", "afterparty", "workshop", "panel", "poetry-night", "exhibition", "opening-ceremony", "closing-ceremony", "award-ceremony", "special-event", "other"] },
    { name: "startTime", label: "Start time", type: "time" }, { name: "endTime", label: "End time", type: "time" }, { name: "venue", label: "Venue" },
  ], translations: ["title", "description", "body"] },
  program: { title: "Program & performances", singular: "Program item", fields: [
    edition, { name: "slug", label: "Slug", required: true }, { name: "participationType", label: "Program category", type: "select", options: ["Official Competition", "Guest Performance"] }, { name: "country", label: "Country" }, { name: "company", label: "Theatre / company" }, { name: "director", label: "Director" },
    { name: "credits", label: "Cast & creative team", type: "credits" }, { name: "startsAt", label: "Performance date & time", type: "datetime" }, { name: "venue", label: "Location / venue", type: "suggestions", options: ['Teatri AAB "Faruk Begolli"', 'Teatri Kamertal AAB "Faruk Begolli"'] },
    { name: "posterMediaId", label: "Poster / main image", type: "media" }, status, publishedAt, order,
  ], translations: ["title", "country", "company", "description", "synopsis"] },
  news: { title: "News", singular: "News article", fields: [
    { ...edition, required: false }, { name: "festivalDayId", label: "Festival day", type: "relation", resource: "days" },
    { name: "activityId", label: "Related activity", type: "relation", resource: "activities" },
    { name: "programItemId", label: "Related performance", type: "relation", resource: "program", filterByEdition: true },
    { name: "date", label: "Article date", type: "date", required: true }, { name: "slug", label: "Slug", required: true }, { name: "category", label: "Category", type: "select", options: ["festival-news", "announcement", "performance", "awards", "interview", "press", "short-update", "video"] },
    { name: "contentMode", label: "Content mode", type: "select", options: ["Internal", "External"] }, { name: "externalUrl", label: "External / YouTube URL", type: "url" },
    { name: "coverMediaId", label: "Featured / cover media", type: "media" }, { name: "$mediaIds", label: "Article images & videos", type: "mediaMultiple" }, { name: "$links", label: "External links", type: "links" }, status, publishedAt,
  ], translations: ["title", "summary", "body"], rich: ["body"] },
  galleries: { title: "Galleries", singular: "Gallery", fields: [edition, { name: "festivalDayId", label: "Festival day", type: "relation", resource: "days" }, { name: "activityId", label: "Activity", type: "relation", resource: "activities" }, { name: "programItemId", label: "Program item", type: "relation", resource: "program" }, { name: "coverMediaId", label: "Cover", type: "media" }, { name: "$mediaIds", label: "Ordered media", type: "mediaMultiple" }, status, publishedAt, order], translations: ["title", "description"] },
  sponsors: { title: "Sponsors & partners", singular: "Sponsor", fields: [{ name: "name", label: "Name", required: true }, { name: "logoMediaId", label: "Logo", type: "media" }, { name: "url", label: "Website", type: "url" }, { name: "category", label: "Category / type" }, { name: "$editionIds", label: "Participating editions", type: "relationMulti", resource: "editions" }, status, publishedAt, order], translations: ["name", "description"] },
  awards: { title: "Festival awards", singular: "Award winner", fields: [
    { ...edition, preferEnglish: true },
    { name: "awardType", label: "Award", type: "select", required: true, options: ["Best Play Award", "Best Director Award", "Best Actor Award", "Best Actress Award", "Best Supporting Actor Award", "Best Supporting Actress Award", "Students’ Choice Award for Best Play", "Media Choice Award for Best Play", "Public Award for Best Play", "Special Mention Award"] },
    { name: "programItemId", label: "Winning performance", type: "relation", resource: "program", filterByEdition: true, className: "admin-award-play-field" },
    { name: "person", label: "Winner", type: "awardPerson" },
    { name: "mediaId", label: "Media", type: "media" }, status, order,
  ], translations: [] },
  pages: { title: "Page content", singular: "Content section", fields: [{ name: "pageKey", label: "Page key", required: true }, { name: "sectionKey", label: "Section key", required: true }, { name: "contentJson", label: "Structured content (JSON)", type: "json" }, { name: "mediaId", label: "Primary content media", type: "media" }, { name: "$mediaIds", label: "Additional content media", type: "mediaMultiple" }, status, publishedAt, order], translations: ["title", "kicker", "subtitle", "text", "body", "linkText", "label"] },
  navigation: { title: "Navigation", singular: "Navigation item", fields: [{ name: "key", label: "Key", required: true }, { name: "url", label: "URL / route", required: true }, { name: "target", label: "Target", type: "select", options: ["_self", "_blank"] }, { name: "parentId", label: "Parent item", type: "relation", resource: "navigation" }, status, publishedAt, order], translations: ["label"] },
  settings: { title: "Site settings", singular: "Setting", fields: [{ name: "key", label: "Key", required: true }, { name: "value", label: "Value", type: "textarea" }, { name: "valueType", label: "Value type", type: "select", options: ["text", "url", "email", "phone", "json", "number", "boolean"] }, { name: "group", label: "Group" }, { name: "isCritical", label: "Critical setting", type: "checkbox" }], translations: ["value"] },
  languages: { title: "Languages & translations", singular: "Language", fields: [{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }, { name: "isPublic", label: "Public website language", type: "checkbox" }, { name: "isActive", label: "Active", type: "checkbox" }, order], translations: [] },
  homepage: { title: "Homepage configuration", singular: "Homepage section", fields: [
    { name: "key", label: "Section key", required: true }, { name: "isVisible", label: "Visible", type: "checkbox" }, order,
    { name: "selectionMode", label: "Selection mode", type: "select", options: ["automatic", "manual"] }, { name: "selectedEditionId", label: "Featured edition override", type: "relation", resource: "editions" }, { name: "itemLimit", label: "Automatic item limit", type: "number" },
    { name: "$newsSelections", label: "Manually featured news", type: "selectionMulti", resource: "news", entityType: "News" }, { name: "$programSelections", label: "Manually featured program", type: "selectionMulti", resource: "program", entityType: "ProgramItem" }, { name: "$editionSelections", label: "Manually featured editions", type: "selectionMulti", resource: "editions", entityType: "Edition" },
    { name: "configurationJson", label: "Section configuration (JSON)", type: "json" }, status, publishedAt,
  ], translations: ["configuration.title", "configuration.kicker", "configuration.text", "configuration.linkText"] },
};

export function itemLabel(item) {
  const v = item.values || {}; const t = item.translations || {};
  return t.en?.title || t.sq?.title || t.bs?.title || t.en?.label || t.sq?.label || t.en?.name || t.sq?.name || v.displayName || v.awardType || v.name || v.title || v.slug || v.key || v.sectionKey || v.code || v.date || item.id;
}
