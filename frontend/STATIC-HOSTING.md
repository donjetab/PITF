# Static hosting on GitHub Pages

The regular commands (`npm.cmd run dev` and `npm.cmd run build`) still use the existing database-backed public API. Static mode changes only the data source and routing; the pages and content mapping are shared.

## Export current public content

Start the backend with its database available, then run from `frontend`:

```powershell
npm.cmd run export:static
npm.cmd run dev:static
```

The exporter reads only public endpoints, including every edition and news archive page. Only the 12 newest news articles (the first unfiltered news page) include details and translated article slugs. All remaining news cards are display-only, with no “Read more” link or article-detail export. Later pagination pages never link to details. Filtering can show older display-only cards on the first page; filtering does not export additional details. Homepage and edition news cards open only when they belong to the same 12 exported articles. Normal API mode keeps all articles clickable.

The exporter writes `public/static-content/content.json` and copies the referenced uploads into `public/uploads`. Keep these files in Git so GitHub can build without your backend. Export again whenever you want to update the published snapshot. If the backend is elsewhere, set `$env:STATIC_API_URL = 'https://your-api.example'` before exporting.

`public/uploads` is generated and stale files there are removed on export; do not put hand-maintained assets in it. Image originals use their display variant. Videos of 100 MiB or larger use their poster image in the static snapshot, because GitHub rejects files that large; the database and backend originals are unchanged. Smaller videos are included. If an export is interrupted, `npm.cmd run export:static -- --resume` reuses the ignored local response cache; use the normal export command to get fresh data.

## Publish

Commit the source, workflow, snapshot, and copied media, then push to `main` or `master`. In your repository's Settings → Pages, select **GitHub Actions** as the source. The included workflow builds and deploys `frontend/dist`, with the repository's correct base path. No backend or database is deployed.

Static routes use hashes (`/PITF_Web/#/news`) so links can be opened and refreshed on GitHub Pages. Admin routes are disabled in static mode. Contact uses the existing mail client flow; newsletter submission currently has no storage integration in either mode.

To check a production build locally:

```powershell
npm.cmd run build:static
npm.cmd run preview
```

## Return to the database-backed API

Deploy the normal `npm.cmd run build` output alongside the backend (with the existing `/api` and `/uploads` routes). Do not set `VITE_CONTENT_SOURCE=static`. The normal build restores browser routing and admin access automatically. You can then delete `public/static-content`, `public/uploads`, `.env.static`, the exporter, and the Pages workflow. No page components or database code need to change. Keep the small source adapter, or remove its static branch later.

GitHub Pages deployment guidance: https://vite.dev/guide/static-deploy#github-pages
