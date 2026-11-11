# PITF backend foundation

## Content map

Frontend routes inspected: `/`, `/about`, `/editions`, `/editions/:editionSlug`, `/news`, `/news/:newsSlug`, and `/contact`.

- Home: hero, about preview, latest/selected edition, program preview, edition carousel, news, sponsors, newsletter/CTA -> `HomepageSection`, `HomepageSelection`, `PageContent`, and related content entities.
- About: page heading/copy, statistics, staff and images -> `PageContent`, `Translation`, and `Media`.
- Editions listing: headings, edition identity, descriptions, logos and banners -> `PageContent`, `Edition`, `Translation`, and `Media`.
- Edition detail: edition hero/recap, days, activities, program, day galleries, recap videos and news -> `Edition`, `FestivalDay`, `FestivalActivity`, `ProgramItem`, `Gallery`, `News`, and reusable `Media`.
- News listing/detail: headings, filters, article copy, external links, cover and gallery -> `PageContent`, `News`, `Translation`, `ExternalLink`, and `NewsMedia`.
- Contact: currently a placeholder -> `PageContent` and `SiteSetting`; there is no real contact-page body to migrate yet.
- Global navigation/footer/social/contact/newsletter -> `NavigationItem`, `SiteSetting`, `PageContent`, and translations.

Content assets identified for managed media import include hero/about/theatre photographs, edition logos and banners, program covers, edition day photographs and recap videos, sponsor logos, and staff portraits. UI-only assets remain frontend-owned: fonts, icons, smoke/decorative textures, side masks, and ornamental graphics.

The historical archive currently contains connected JSON for 2018–2026 except 2017, including split 2024/2025 sources, plus corresponding image/video folders. The edition asset tree also contains 2017 content. Missing translation values remain absent.

## Storage

Original uploads live below `backend/wwwroot/uploads/YYYY/MM`. Database folder membership is virtual and independent of the physical key. Images retain originals and receive `large`, `medium`, and `thumbnail` WebP variants. `IMediaStorageService` isolates content logic from local disk for a future cloud implementation.

Content editors accept uploads directly through their media chooser, including photographs for a new play. Uploads inherit the editor's edition, year, day, performance and image category. Saving an edition creates both `Editions/<year>` and `News/<year>` folders; edition-linked folders survive empty-folder cleanup. Standalone news uses the article date's year. Other website content uses the `Website` folder.

New uploads are tracked in `uploadedMediaIds`. On the first content save, selected uploads receive the newly created edition/day/play IDs and final folder and year, including changes made to the form after uploading. Existing selected assets keep their original classification; photographs explicitly attached to a play join that play's collection. Uploads save immediately and remain in Media Library if the editor is cancelled. Contextual uploads retain independent media records even for identical files to avoid reclassifying another content item's image; choosing an existing asset reuses it. Unclassified library uploads still support SHA-256 deduplication.

## API

- `GET /api/health`
- `POST /api/auth/login`; `POST /api/auth/users` (SuperAdmin)
- `GET /api/public/site`, `/homepage`, `/editions`, `/editions/{slug}`, `/news`, `/news/{slug}`
- `GET|POST|PUT /api/admin/editions`
- `GET|POST|PUT /api/admin/news`
- `GET|POST /api/admin/folders`
- `GET|PUT /api/admin/homepage`
- `GET|POST /api/admin/media`, `PATCH /api/admin/media/{id}`
- `POST /api/admin/import/pitf`

Swagger is available at `/swagger`. Public endpoints filter publication status; admin write endpoints use Editor/Admin/SuperAdmin policy boundaries.

## Migration

`InitialFoundation` creates Identity, translations, all content/media entities, join tables, indexes, unique constraints, and deletion rules.

## Remaining migration limitations

The current importer loads connected news text, language variants, editions, and external links. Registering/copying every archive media file and parsing all frontend JavaScript content modules into database rows still needs a second import pass; existing source files remain untouched and no fake records are generated. The frontend continues to use its current static content service in this phase, so its visual behavior is not changed.
