# PITF import and API verification

Final verification: 21 August 2026. Source data: the existing React frontend, all connected PITF news/media manifests, SQL Server database `PITF`, and managed files under `backend/wwwroot/uploads`. The React frontend was not changed.

## Summary

The public API now uses explicit DTOs only; no endpoint serializes EF entities. All public routes return cycle-free, frontend-ready JSON with `sq`, `en`, and `bs` translation maps where the source contains them. Missing translations, posters, awards, recaps, and archive files remain null/empty rather than being invented.

The historical structure pass is idempotent. It created festival days from explicit `festivalDayNumber` values, activities only from explicit activity categories, galleries from gallery news and `editionDayMedia.js`, and edition recap links only for recap paths actually used by the frontend. Media records are reused by GUID and SHA-256.

Managed media remains exact: **1,744 originals + 5,043 variants = 6,787 physical files**. There are no missing managed files, orphan variants, or duplicate SHA-256 originals.

## Editions and structured content

| Year | Edition | News | Days | Activities | Program | Galleries | Sponsors | Awards | Edition recap |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 2017 | 1 | 35 | 6 | 20 | 0 | 6 | 0 | 0 | Yes |
| 2018 | 2 | 45 | 8 | 23 | 0 | 6 | 0 | 0 | No source file |
| 2019 | 3 | 55 | 6 | 25 | 0 | 6 | 0 | 0 | No source file |
| 2020 | 4 | 23 | 4 | 10 | 0 | 3 | 0 | 0 | No source file |
| 2021 | 5 | 19 | 6 | 2 | 0 | 0 | 0 | 0 | No source file |
| 2022 | 6 | 45 | 7 | 17 | 0 | 10 | 0 | 0 | No edition recap source file |
| 2023 | 7 | 50 | 7 | 20 | 0 | 13 | 0 | 0 | Yes |
| 2024 | 8 | 70 | 7 | 33 | 0 | 11 | 0 | 0 | Yes |
| 2025 | 9 | 58 | 6 | 20 | 0 | 14 | 0 | 0 | Yes |
| 2026 | 10 | 27 | 6 | 13 | 6 | 6 | 5 | 0 | Yes |

The 2026 activity total is now 13: the original six program-linked performance activities plus seven other source-backed activities from connected news. Historical program rows remain zero because the supplied historical sources do not contain reliable structured fields for company, director, venue, and schedule. That information remains preserved in news translations.

Awards remain zero. Award articles and media exist, but their prose does not provide a consistent, explicit award/recipient schema that can be imported without interpretation. No recipients were inferred.

Edition recap media is linked for editions 1, 7, 8, 9, and 10, matching the actual recap map in `EditionDetailPage.jsx`. Day recap videos are reusable ordered items in day galleries. Editions without a real edition-level recap path return `recapMedia: null`.

## News and thumbnail behavior

- Unique imported news: **427**.
- News-media relationships: **1,547**.
- External-only news: **27**; each response includes `isExternalOnly`, `externalUrl`, and `externalTarget`.
- External-only YouTube URLs: **15**; all 15 resolve a usable card thumbnail. One has an attached image, correctly selected ahead of YouTube by priority.
- Card priority: manual cover, attached image, video poster, YouTube thumbnail, then null.
- Local video-only posts have no source posters. They return null rather than a video file as an image URL.
- News without any resolvable card image: **75**. This includes historical video-only posts and missing-local-media posts; clients can safely display the PITF fallback visual.
- All 427 news detail routes were read-tested successfully; errors: **0**.

The full language/year and source-count audit remains valid from the initial verification: missing translations were not filled. The 2025 manifests duplicate the same 58 slugs, and the database unique slug constraint correctly stores 58 records.

## Media integrity and API contract

| Check | Result |
|---|---:|
| Media records | 1,744 |
| Image variants | 5,043 |
| Physical managed files | 6,787 |
| Missing originals | 0 |
| Missing variants | 0 |
| Duplicate SHA-256 groups | 0 |
| Orphan media variants | 0 |
| Orphan news-media rows | 0 |
| Orphan gallery-media rows | 0 |
| Gallery-media relationships | 302 |
| Virtual folders | 93 |

Public and admin media DTOs return ID, type, original URL, thumbnail/medium/large URLs, video poster, metadata, dimensions, folder, variants, and reusable relationship identifiers. They do not return `StorageKey`, local Windows paths, or `wwwroot` paths. Public media listing is paginated and filterable by type.

The 2025 linked-media discrepancy is valid reuse: it has 205 relationship rows and 199 distinct media IDs. The six additional rows attach already-managed media to another news item. Relationship rows across all years total exactly 1,547.

## Missing historical files

The original audit found **567 declared manifest media rows whose declared source paths do not exist**. These remain unresolved unless the prepared files are supplied; no replacements were manufactured. The full per-file/year/news/path analysis remains in [IMPORT-VERIFICATION-MISSING-MEDIA.md](IMPORT-VERIFICATION-MISSING-MEDIA.md).

The 13 affected 2024 articles with no usable local media are API-safe: `coverMedia` and `cardThumbnailUrl` are null unless an external YouTube URL can resolve a thumbnail. They do not cause a failed list/detail response.

## Frontend content coverage

| Current page/area | Backend source now available | Remaining static and reason |
|---|---|---|
| `/` | `PageContent`, `HomepageSection`, explicit program selections, edition resolution, sponsors, managed hero/about media | Layout, animation, icons, and ornamental effects are UI design assets |
| `/about` | Intro, statistics, mission, team copy, all six team portraits, all six gallery photos, newsletter, managed primary images | Statistic icons and animation are UI design assets |
| `/editions` | Ten edition DTOs, translations, identity/hero media, page hero content | Visual palette/layout logic is presentation behavior |
| `/editions/:editionSlug` | Edition translations/media, recap, days, activities, program, news, galleries, sponsors, awards | Missing source facts return empty/null |
| `/news` | Hero content, paginated translated cards, filters by edition ID, resolved thumbnails | Search UI and fallback artwork are presentation behavior |
| `/news/:newsSlug` | Translated title/summary/body, ordered reusable media, links and relations | None of the editable article content must remain static |
| `/contact` | Source placeholder page content and location/settings | Real email, phone, address body, and reservation URL do not exist in supplied source data |
| Navigation | Five managed links plus translation maps and editions endpoint | Language switch UI and brand rendering are UI behavior |
| Footer | Managed settings, navigation, social placeholder values, copyright | SVG social icons, brand mark, and decorative image are structural design assets |

`PageContentMedia` now explicitly relates the About team portraits and gallery photographs to the About content while preserving media reuse. It does not depend on filenames or physical folders.

## Homepage configuration

Eight ordered, publishable sections exist: hero, about, featured-edition, featured-program, editions, featured-news, sponsors, and newsletter. Every response includes section visibility, order, selection mode, item limit, selected edition, and configuration JSON.

- Featured edition is `automatic` and currently resolves to published 2026. Changing the mode to `manual` plus `SelectedEditionId` overrides it; it is not permanently tied to newest year.
- Featured program has six explicit `HomepageSelection` rows matching the six items currently rendered by React.
- Featured news is configurable but initially hidden because the current homepage does not render a news section. When visible, explicit selections/order are honored; if none exist, its configurable item limit is used.
- Hero, About preview, sponsors, editions, and newsletter/CTA are included in one homepage response.

## 2026 structured program

The six source program items preserve dates, times, venues, countries, companies, directors, translations, and five real posters. `Guest Play` has no poster and no director because the frontend source contains neither; both remain null. Its company is preserved as Faruk Begolli Theatre, AAB College.

## Database integrity and migrations

Zero-count checks after the final import:

- orphan variants, news-media, gallery-media, and page-content-media rows;
- duplicate news/edition slugs;
- duplicate translation identities;
- invalid news-edition and homepage-section relationships;
- duplicate physical originals by SHA-256.

Homepage selection references are valid. Content relationships use GUID foreign keys and never virtual or physical folder paths. Publication filtering is enforced in public services. Media folders can change without changing content relationships.

Migrations:

1. `20260821065636_InitialFoundation`
2. `20260821091500_AddPageContentMedia`

Both are recorded in `__EFMigrationsHistory`.

## Public endpoint verification

| Endpoint | Result |
|---|---|
| `GET /api/health` | 200 |
| `GET /api/public/homepage` | 200, complete aggregate |
| `GET /api/public/about` | 200, page media collections included |
| `GET /api/public/editions` | 200, ten DTOs |
| `GET /api/public/editions/{slug}` | 200 for all ten editions |
| `GET /api/public/news` | 200, paginated DTOs |
| `GET /api/public/news/{slug}` | 200 for all 427 slugs |
| `GET /api/public/site` | 200 |
| `GET /api/public/contact` | 200 |
| `GET /api/public/navigation` | 200 |
| `GET /api/public/footer` | 200 |
| `GET /api/public/media` | 200, paginated/filterable |
| `GET /api/public/media/{id}` | 200 for valid IDs |

No tested response exposed a physical path or storage key. No public endpoint produced HTTP 500 or an EF object cycle.

## Final status

| Area | Status |
|---|---|
| Public DTOs and cycle safety | **READY** |
| Homepage aggregate/editorial controls | **READY** |
| News cards, external behavior, YouTube thumbnails | **READY** |
| Media API, variants, reuse, folders | **READY** |
| Database and managed-file integrity | **READY** |
| Frontend content represented by backend data | **READY** |
| Historical days/activities/galleries supported by explicit source | **READY** |
| Historical structured program/award facts absent from source | **MISSING DATA** |
| 567 declared but absent archive files | **MISSING DATA** |
| Real contact details/reservation URL absent from source | **MISSING DATA** |

**Backend/API status: READY. It is safe to begin replacing the frontend static content service with the API, provided the frontend implements its existing fallback visual for null historical thumbnails.**
