import { mkdir, readFile, writeFile, copyFile, stat, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = new URL(process.env.STATIC_API_URL || "http://localhost:5136");
const responses = {};
const uploads = new Set();
const cache = path.join(root, '.static-export-cache');
await mkdir(cache, { recursive: true });
async function get(endpoint) {
  const cacheFile = path.join(cache, Buffer.from(origin.origin + endpoint).toString('base64url') + '.json');
  if (process.argv.includes('--resume')) {
    try { const data = JSON.parse(await readFile(cacheFile, 'utf8')); responses[endpoint] = data; return data; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  console.log(`Exporting ${endpoint}`);
  const response = await fetch(new URL(endpoint, origin), { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  const data = await response.json();
  responses[endpoint] = data;
  await writeFile(cacheFile, JSON.stringify(data));
  return data;
}

// Only public endpoints are exported: never authentication or admin records.
await Promise.all(["homepage", "about", "site", "contact", "editions"].map(name => get(`/api/public/${name}`)));
const editions = responses["/api/public/editions"];
for (let index = 0; index < editions.length; index += 4) {
  await Promise.all(editions.slice(index, index + 4).map(edition => get(`/api/public/editions/${encodeURIComponent(edition.slug)}`)));
}
const articles = [];
for (let page = 1, totalPages = 1; page <= totalPages; page++) {
  const result = await get(`/api/public/news?page=${page}&pageSize=100`);
  totalPages = result.totalPages;
  articles.push(...result.items);
}
async function exportArticle(article) {
  const detail = await get(`/api/public/news/${encodeURIComponent(article.slug)}`);
  for (const translation of Object.values(article.translations || {})) {
    if (translation.slug) responses[`/api/public/news/${encodeURIComponent(translation.slug)}`] = detail;
  }
}
// Only the first screen of news opens details in the static preview.
const detailArticles = articles.slice(0, 12);
const detailArticleIds = new Set(detailArticles.map(article => article.id));
for (let index = 0; index < detailArticles.length; index += 8) {
  await Promise.all(detailArticles.slice(index, index + 8).map(exportArticle));
}

function collect(value) {
  if (typeof value === "string") {
    // Include URLs embedded in rich HTML as well as media DTO properties.
    for (const match of value.matchAll(/(?:https?:\/\/[^\s"'<>]+)?\/uploads\/[^\s"'<>?#)]+/g)) {
      const url = new URL(match[0], origin);
      if (url.origin !== origin.origin) throw new Error(`External upload URL needs review: ${url.origin}`);
      uploads.add(url.pathname);
    }
  } else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
}
// Keep display variants, replacing oversized videos with their poster in static mode.
const postersOnly = new Set();
async function prepare(value) {
  if (Array.isArray(value)) return Promise.all(value.map(prepare));
  if (!value || typeof value !== 'object') return value;
  if (value.type === 'video' && value.fileSize >= 100 * 1024 * 1024) {
    postersOnly.add(value.originalUrl);
    const poster = value.videoPosterUrl || value.thumbnailUrl || null;
    return { ...value, type: 'image', originalUrl: poster, largeUrl: poster, mediumUrl: poster, thumbnailUrl: poster, variants: [] };
  }
  const copy = { ...value };
  // News cards appear in the archive, homepage, editions, and article details.
  if (copy.id && typeof copy.isExternalOnly === 'boolean' && copy.translations) {
    copy.staticDetailAvailable = detailArticleIds.has(copy.id);
    if (!copy.staticDetailAvailable) {
      // Display-only cards need their thumbnail, title, date, and summary.
      copy.coverMedia = null;
      copy.translations = Object.fromEntries(Object.entries(copy.translations).map(([language, translation]) => [language, { ...translation, body: '' }]));
    }
  }
  if (copy.type === 'image' && copy.originalUrl) {
    copy.originalUrl = copy.largeUrl || copy.mediumUrl || copy.originalUrl;
    copy.variants = [];
  }
  return Object.fromEntries(await Promise.all(Object.entries(copy).map(async ([key, item]) => [key, await prepare(item)])));
}
const preparedResponses = await prepare(responses);
collect(preparedResponses);
const expectedFiles = new Set([...uploads].map(url => path.resolve(root, 'public', '.' + decodeURIComponent(url))));
const generatedUploadsRoot = path.resolve(root, 'public/uploads');
// This directory contains only this export's generated copies. Prune stale copies.
async function prune(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })) {
    const target = path.resolve(directory, entry.name);
    if (!target.startsWith(generatedUploadsRoot + path.sep)) throw new Error('Invalid generated upload path');
    if (entry.isDirectory()) await prune(target);
    else if (!expectedFiles.has(target)) await unlink(target);
  }
}
await prune(generatedUploadsRoot);
let bytes = 0;
for (const url of uploads) {
  const relative = decodeURIComponent(url.slice("/uploads/".length));
  const destination = path.resolve(root, "public/uploads", relative);
  const directory = path.resolve(root, "public/uploads") + path.sep;
  if (!destination.startsWith(directory)) throw new Error(`Invalid media path: ${url}`);
  await mkdir(path.dirname(destination), { recursive: true });
  const source = path.resolve(root, "../backend/wwwroot/uploads", relative);
  const existing = await stat(destination).catch(() => null);
  const sourceInfo = await stat(source).catch(() => null);
  if (existing && sourceInfo && existing.size === sourceInfo.size) {
    bytes += existing.size;
    continue;
  }
  try {
    await copyFile(source, destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Missing media ${url}: HTTP ${response.status}`);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }
  const size = (await stat(destination)).size;
  if (size >= 100 * 1024 * 1024) throw new Error(`Media exceeds GitHub's 100 MiB file limit: ${url}`);
  bytes += size;
}
// Normalize absolute local upload URLs so the hosted site never calls localhost.
const serialized = JSON.stringify({ exportedAt: new Date().toISOString(), postersOnly: [...postersOnly], responses: preparedResponses }, null, 2)
  .replaceAll(origin.origin + "/uploads/", "/uploads/");
await mkdir(path.join(root, "public/static-content"), { recursive: true });
await writeFile(path.join(root, "public/static-content/content.json"), serialized + "\n");
console.log(`Exported ${Object.keys(responses).length} public responses and ${uploads.size} media files (${(bytes / 1024 / 1024).toFixed(1)} MiB).`);
for (const url of postersOnly) console.log(`Poster used for oversized video: ${url}`);
if (bytes > 950 * 1024 * 1024) throw new Error("Export is too large for a safe GitHub Pages deployment. Reduce media before committing.");
