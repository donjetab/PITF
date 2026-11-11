const TOKEN_KEY = "pitf_admin_token";

export const authStore = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(value) { if (value) localStorage.setItem(TOKEN_KEY, value); else localStorage.removeItem(TOKEN_KEY); },
  clear() { localStorage.removeItem(TOKEN_KEY); },
};

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authStore.token) headers.set("Authorization", `Bearer ${authStore.token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    authStore.clear();
    if (!location.pathname.endsWith("/admin/login")) location.assign("/admin/login");
  }
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { const data = await response.json(); message = data.message || data.title || message; } catch { /* response has no JSON body */ }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const adminApi = {
  login: (email, password) => api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => api("/api/auth/me"),
  dashboard: () => api("/api/admin/manage/dashboard"),
  list: (resource) => api(`/api/admin/manage/${resource}`),
  save: (resource, item) => api(`/api/admin/manage/${resource}${item.id ? `/${item.id}` : ""}`, { method: item.id ? "PUT" : "POST", body: JSON.stringify(item.payload) }),
  remove: (resource, id) => api(`/api/admin/manage/${resource}/${id}`, { method: "DELETE" }),
  media: (params = {}) => api(`/api/admin/media?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null))}`),
  mediaItem: (id) => api(`/api/admin/media/${id}`),
  upload: (files, metadata = {}) => {
    const body = new FormData();
    [...files].forEach((file) => body.append("files", file));
    Object.entries(metadata).forEach(([key, value]) => { if (value !== "" && value != null) body.append(key, value); });
    return api("/api/admin/media/upload", { method: "POST", body });
  },
  updateMedia: (id, payload) => api(`/api/admin/media/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteMedia: (id) => api(`/api/admin/media/${id}`, { method: "DELETE" }),
  bulkMove: (ids, folderId) => api("/api/admin/media/bulk-move", { method: "POST", body: JSON.stringify({ ids, folderId: folderId || null }) }),
  bulkDelete: (ids) => api("/api/admin/media/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
  folders: () => api("/api/admin/media/folders"),
  cleanupFolders: () => api("/api/admin/media/folders/cleanup", { method: "POST" }),
  saveFolder: (folder) => api(`/api/admin/media/folders${folder.id ? `/${folder.id}` : ""}`, { method: folder.id ? "PUT" : "POST", body: JSON.stringify(folder) }),
  deleteFolder: (id) => api(`/api/admin/media/folders/${id}`, { method: "DELETE" }),
  users: () => api("/api/auth/users"),
  saveUser: (user) => api(`/api/auth/users${user.id ? `/${user.id}` : ""}`, { method: user.id ? "PUT" : "POST", body: JSON.stringify(user) }),
  resetPassword: (id, password) => api(`/api/auth/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  deleteUser: (id) => api(`/api/auth/users/${id}`, { method: "DELETE" }),
};

export function absoluteMediaUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
