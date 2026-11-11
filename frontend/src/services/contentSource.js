export const isStatic = import.meta.env.VITE_CONTENT_SOURCE === "static";

export function assetUrl(path) {
  return path?.startsWith("/assets/") || path?.startsWith("/uploads/")
    ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path;
}

function resolveAssets(value) {
  if (typeof value === "string") return assetUrl(value);
  if (Array.isArray(value)) return value.map(resolveAssets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssets(item)]));
  return value;
}

let staticRequest;
export async function readStaticContent(path) {
  staticRequest ??= fetch(`${import.meta.env.BASE_URL}static-content/content.json`).then(async (response) => {
    if (!response.ok) throw new Error("Static content is missing. Run npm.cmd run export:static while the backend is running.");
    return resolveAssets(await response.json());
  });
  const data = await staticRequest;
  if (!Object.hasOwn(data.responses, path)) throw new Error(`Static content not found: ${path}`);
  return data.responses[path];
}
