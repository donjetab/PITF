const newsModules = import.meta.glob("../News/**/news-*.json", {
  eager: true,
  import: "default",
});

const mediaModules = import.meta.glob("../News/**/media-*.json", {
  eager: true,
  import: "default",
});

const imageModules = import.meta.glob(
  "../News/**/*.{jpg,jpeg,png,webp,gif,JPG,JPEG,PNG,WEBP,GIF}",
  { eager: true, query: "?url", import: "default" },
);

const windows1252 = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
};

function repairText(value) {
  if (!value || !/[ÃÂâÄÅ]/.test(value)) return value || "";
  try {
    const bytes = Uint8Array.from(value, (character) =>
      windows1252[character] ?? character.charCodeAt(0),
    );
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

function flattenUnique(modules) {
  const records = Object.values(modules).flat();
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

const mediaRecords = flattenUnique(mediaModules);
const mediaById = new Map(mediaRecords.map((item) => [item.id, item]));
const imageByArchivePath = new Map();

Object.entries(imageModules).forEach(([path, url]) => {
  const normalized = path.replaceAll("\\", "/");
  const yearIndex = normalized.search(/\/20\d{2}\//);
  if (yearIndex >= 0) {
    imageByArchivePath.set(
      decodeURIComponent(normalized.slice(yearIndex + 1)).toLowerCase(),
      url,
    );
  }
});

function resolveMedia(media) {
  if (!media?.src) return null;
  const archivePath = decodeURIComponent(media.src.replace(/^\/media\//, "")).toLowerCase();
  return imageByArchivePath.get(archivePath) || null;
}

function conciseTitle(value) {
  return repairText(value).split("\n").find(Boolean)?.trim() || "PITF news";
}

export const newsItems = flattenUnique(newsModules)
  .map((item) => {
    const copy = item.content?.en || item.content?.sq || item.content?.bs || {};
    const mediaImages = item.mediaIds
      ?.map((id) => mediaById.get(id))
      .filter((entry) => entry?.type === "image" && resolveMedia(entry))
      .map((entry) => resolveMedia(entry)) || [];
    return {
      ...item,
      title: conciseTitle(copy.title),
      summary: repairText(copy.summary || ""),
      body: repairText(copy.body || ""),
      imageSrc: mediaImages[0] || null,
      mediaImages,
    };
  })
  .filter((item) => item.title)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
