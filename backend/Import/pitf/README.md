# PITF archive import

The importer first checks this folder recursively for `news-YYYY-connected.json` files. Place each year under `backend/import/pitf/YYYY/` together with its `media-YYYY.json` and the matching `YYYY/<news-slug>/...` media folders.

When this folder is empty, the development endpoint falls back to the archive already present at `frontend/src/News`. Import is initiated with `POST /api/admin/import/pitf` by an Admin or SuperAdmin. Completed files are fingerprinted in `ImportRuns`, so an unchanged file is skipped on subsequent runs. Existing editions, news slugs, translations, and external URLs are upserted rather than duplicated.
