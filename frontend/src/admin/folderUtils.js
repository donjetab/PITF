export function folderOptions(folders = []) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const cache = new Map();

  function pathFor(folder, visiting = new Set()) {
    if (cache.has(folder.id)) return cache.get(folder.id);
    if (visiting.has(folder.id)) return folder.name;
    const next = new Set(visiting).add(folder.id);
    const parent = folder.parentId ? byId.get(folder.parentId) : null;
    const path = parent ? `${pathFor(parent, next)} / ${folder.name}` : folder.name;
    cache.set(folder.id, path);
    return path;
  }

  return folders
    .map((folder) => ({ ...folder, path: pathFor(folder) }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

export function folderPath(folders, id, fallback = "Root") {
  return folderOptions(folders).find((folder) => folder.id === id)?.path || fallback;
}
