# SQ/EN Translation Backfill Report

Completed: 2026-08-21T09:56:57.003609+00:00

## Summary

- Translation rows before: **1,444**
- Translation rows after: **2,394**
- Missing/empty fields filled: **950**
- Machine-translated fields: **833**
- Normalized or exact-copied fields: **117**
- Machine fields given source-grounded editorial refinements: **62**
- Distinct content items changed: **552**
- Unsafe/untranslated fields: **0**
- Existing BS rows unchanged: **YES**

No translation that existed before this run was overwritten. Program/play titles, known organization/person
names, venues, URLs, dates, times, HTML tags, typography, and paragraph breaks were protected. A second local
pass regenerated 766 historical fields with stricter punctuation, quoted play-title, and likely proper-name
protection; the final scan found zero replacement characters, arrow artifacts, tokenizer markers, or
unexpected musical-symbol artifacts.

The 62 source-grounded refinements cover public UI wording and two duplicated PITF 2018 schedule bodies. The
remaining historical machine translations should still receive normal editorial review before publication
because Albanian is a lower-resource machine-translation pair.

## Fields filled by direction

- en->sq: **342**
- sq->en: **491**

## Fields filled by entity

- Edition: **11**
- FestivalActivity: **201**
- FestivalDay: **63**
- Gallery: **19**
- HomepageSection: **14**
- NavigationItem: **5**
- News: **511**
- PageContent: **102**
- ProgramItem: **6**
- SiteSetting: **8**
- Sponsor: **10**

## Could not safely translate

None. All candidates passed structural safeguards.

Empty or non-linguistic source values were intentionally not invented: the database currently has no Award
records and no Media alt/caption source text; 75 external-link labels are URLs, and social settings currently
contain only `#` placeholders. Sponsor brands, person names, play names, credits, venues, URLs, dates, and times
were retained rather than treated as prose.

## Audit artifacts

- Full inserted-field inventory: `Translation/output/translation-backfill-report.json`
- Reusable local translation cache: `Translation/output/translation-cache.jsonl`
- Offline model/runtime directory: `.translation-tools/` (git-ignored)
- Repeatable UI review corrections: `Translation/refine_ui_translations.sql`
