"""Idempotently fill missing Albanian/English PITF translations using local Argos models.

The script never changes a non-empty translation and never touches Bosnian rows.
It also normalizes translatable JSON leaves into the Translation table using stable
field paths such as ``content.title`` and ``configuration.subtitle``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import ctranslate2
import pyodbc
import sentencepiece as spm


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".translation-tools"
OUTPUT = ROOT / "Translation" / "output"
LANGUAGES = ("sq", "en")
MOJIBAKE = ("â€", "Ã", "Å", "Ä", "Â")
HTML_RE = re.compile(r"<[^>]*>")
URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>'\"]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", re.I)
DATE_TIME_RE = re.compile(r"\b(?:\d{1,2}[:.]\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])([ \t]+)")
NEWLINE_RE = re.compile(r"(\r\n|\n|\r)")
QUOTED_RE = re.compile(r"“[^”\r\n]{1,160}”|‘[^’\r\n]{1,160}’|\"[^\"\r\n]{1,160}\"")
TITLE_NAME_RE = re.compile(
    r"\b(?:[A-ZÇËŠŽĆĐ][\wÇËçëŠšŽžĆćĐđ’'-]+[ \t]+){1,4}"
    r"[A-ZÇËŠŽĆĐ][\wÇËçëŠšŽžĆćĐđ’'-]+\b"
)
GENERIC_NAME_ENDINGS = {
    "award", "awards", "ceremony", "choice", "college", "conference", "day", "director",
    "edition", "festival", "jury", "media", "night", "play", "program", "stage", "students",
    "student", "theater", "theatre", "workshop", "botimi", "ceremonia", "dita", "festivali",
    "juri", "programi", "shfaqja", "teatri",
}


@dataclass
class Candidate:
    entity_type: str
    entity_id: str
    target_language: str
    field: str
    source_language: str
    source: str
    label: str
    mode: str = "translate"
    existing_empty_id: str | None = None
    target: str | None = None
    repaired_source: bool = False

    @property
    def key(self) -> tuple[str, str, str, str]:
        return self.entity_type, self.entity_id, self.target_language, self.field


class OfflineTranslator:
    def __init__(self, source: str, target: str, protected_terms: Iterable[str], cache: dict[str, str]):
        package = TOOLS / "models" / f"{source}_{target}" / f"translate-{source}_{target}-1_9"
        if not package.exists():
            raise RuntimeError(f"Missing offline model: {package}")
        self.source = source
        self.target = target
        self.processor = spm.SentencePieceProcessor(model_file=str(package / "sentencepiece.model"))
        self.translator = ctranslate2.Translator(str(package / "model"), device="cpu", inter_threads=4)
        self.cache = cache
        protected = [p for p in protected_terms if len(p.strip()) >= 2]
        alternatives = [re.escape(p) for p in sorted(set(protected), key=len, reverse=True)]
        base = [
            HTML_RE.pattern,
            URL_RE.pattern,
            DATE_TIME_RE.pattern,
            r"&(?:#\d+|#x[0-9a-f]+|[a-z]+);",
            # Argos' low-resource SQ model can hallucinate glyphs for typography.
            # Keep punctuation byte-for-byte and translate only the surrounding text.
            r"[.!?,;:…—–\-“”‘’\"()\[\]{}/|&#*]",
        ]
        self.protected_patterns = base + alternatives

    @staticmethod
    def _likely_proper_phrases(value: str) -> list[str]:
        phrases = [m.group(0) for m in QUOTED_RE.finditer(value)]
        for match in TITLE_NAME_RE.finditer(value):
            phrase = match.group(0)
            words = phrase.split()
            last = re.sub(r"[^\wÇËçëŠšŽžĆćĐđ]", "", words[-1]).lower()
            if phrase.isupper() or last in GENERIC_NAME_ENDINGS:
                continue
            phrases.append(phrase)
        return phrases

    @staticmethod
    def _repair_mojibake(value: str) -> tuple[str, bool]:
        if not any(marker in value for marker in MOJIBAKE):
            return value, False
        try:
            repaired = value.encode("cp1252").decode("utf-8")
            if sum(value.count(m) for m in MOJIBAKE) > sum(repaired.count(m) for m in MOJIBAKE):
                return repaired, True
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        return value, False

    def _pieces(self, value: str) -> tuple[list[tuple[str, str]], bool]:
        value, repaired = self._repair_mojibake(value)
        dynamic = [re.escape(p) for p in self._likely_proper_phrases(value)]
        protected_re = re.compile("(" + "|".join(dynamic + self.protected_patterns) + ")", re.I)
        pieces: list[tuple[str, str]] = []
        for protected_part in protected_re.split(value):
            if not protected_part:
                continue
            if protected_re.fullmatch(protected_part):
                pieces.append(("raw", protected_part))
                continue
            for line_part in NEWLINE_RE.split(protected_part):
                if not line_part:
                    continue
                if NEWLINE_RE.fullmatch(line_part):
                    pieces.append(("raw", line_part))
                    continue
                for sentence_part in SENTENCE_SPLIT_RE.split(line_part):
                    if not sentence_part:
                        continue
                    if sentence_part.isspace():
                        pieces.append(("raw", sentence_part))
                        continue
                    leading = sentence_part[: len(sentence_part) - len(sentence_part.lstrip())]
                    trailing = sentence_part[len(sentence_part.rstrip()) :]
                    core = sentence_part.strip()
                    if leading:
                        pieces.append(("raw", leading))
                    if core:
                        pieces.extend(("unit", unit) for unit in self._split_long(core))
                    if trailing:
                        pieces.append(("raw", trailing))
        return pieces, repaired

    def _split_long(self, text: str, max_tokens: int = 180) -> list[str]:
        tokens = self.processor.encode(text, out_type=str)
        if len(tokens) <= max_tokens:
            return [text]
        words = text.split(" ")
        chunks: list[str] = []
        current: list[str] = []
        for word in words:
            trial = " ".join(current + [word])
            if current and len(self.processor.encode(trial, out_type=str)) > max_tokens:
                chunks.append(" ".join(current))
                current = [word]
            else:
                current.append(word)
        if current:
            chunks.append(" ".join(current))
        return chunks

    def translate_many(self, candidates: list[Candidate]) -> None:
        layouts: dict[int, list[tuple[str, str]]] = {}
        units: dict[str, str] = {}
        for index, candidate in enumerate(candidates):
            pieces, repaired = self._pieces(candidate.source)
            candidate.repaired_source = repaired
            layouts[index] = pieces
            for kind, value in pieces:
                if kind != "unit" or not re.search(r"[A-Za-zÀ-ž]", value):
                    continue
                key = self._cache_key(value)
                if key not in self.cache:
                    units[key] = value

        missing = list(units.items())
        for offset in range(0, len(missing), 64):
            batch = missing[offset : offset + 64]
            token_batch = [self.processor.encode(text, out_type=str) for _, text in batch]
            results = self.translator.translate_batch(
                token_batch, beam_size=4, batch_type="tokens", max_batch_size=64
            )
            for (key, _), result in zip(batch, results):
                # The Argos 1.9 packages use a shared SentencePiece vocabulary whose
                # decoder leaves some U+2581 word markers behind on Windows.
                self.cache[key] = "".join(result.hypotheses[0]).replace("▁", " ").strip()
            print(f"{self.source}->{self.target}: {min(offset + 64, len(missing))}/{len(missing)} segments", flush=True)

        for index, candidate in enumerate(candidates):
            output: list[str] = []
            for kind, value in layouts[index]:
                if kind == "unit" and re.search(r"[A-Za-zÀ-ž]", value):
                    output.append(self.cache[self._cache_key(value)])
                else:
                    output.append(value)
            candidate.target = "".join(output)

    def _cache_key(self, text: str) -> str:
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return f"argos-1.9:{self.source}:{self.target}:{digest}"


def json_leaves(value, path: str = ""):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            yield from json_leaves(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from json_leaves(child, f"{path}[{index}]")
    elif isinstance(value, str):
        yield path, value


def is_meaningful_text(value: str) -> bool:
    return bool(value.strip() and re.search(r"[A-Za-zÀ-ž]", value))


def should_copy(entity_type: str, field: str, value: str) -> bool:
    final_key = re.sub(r"\[\d+\]$", "", field.rsplit(".", 1)[-1]).lower()
    if entity_type == "ProgramItem" and field == "title":
        return True
    if final_key in {"name", "url", "href", "target", "slug", "state"}:
        return True
    if value.startswith(("/", "#", "http://", "https://", "www.")):
        return True
    return not is_meaningful_text(value)


def label_maps(cursor) -> dict[tuple[str, str], str]:
    result: dict[tuple[str, str], str] = {}
    queries = {
        "News": "SELECT CAST(Id AS nvarchar(36)), CONCAT(YEAR([Date]), '/', Slug) FROM News",
        "Edition": "SELECT CAST(Id AS nvarchar(36)), CONCAT([Year], '/', Slug) FROM Editions",
        "ProgramItem": "SELECT CAST(Id AS nvarchar(36)), Slug FROM ProgramItems",
        "PageContent": "SELECT CAST(Id AS nvarchar(36)), CONCAT(PageKey, '/', SectionKey) FROM PageContents",
        "HomepageSection": "SELECT CAST(Id AS nvarchar(36)), [Key] FROM HomepageSections",
        "NavigationItem": "SELECT CAST(Id AS nvarchar(36)), [Key] FROM NavigationItems",
        "Sponsor": "SELECT CAST(Id AS nvarchar(36)), Name FROM Sponsors",
        "SiteSetting": "SELECT CAST(Id AS nvarchar(36)), [Key] FROM SiteSettings",
        "ExternalLink": "SELECT CAST(Id AS nvarchar(36)), Url FROM ExternalLinks",
    }
    for entity_type, query in queries.items():
        for entity_id, label in cursor.execute(query).fetchall():
            result[(entity_type, entity_id.lower())] = str(label)
    return result


def collect_candidates(cursor) -> tuple[list[Candidate], dict, str]:
    rows = cursor.execute(
        "SELECT CAST(Id AS nvarchar(36)), EntityType, CAST(EntityId AS nvarchar(36)), "
        "LanguageCode, Field, Value FROM Translations"
    ).fetchall()
    labels = label_maps(cursor)
    existing: dict[tuple[str, str, str, str], tuple[str, str]] = {}
    bs_material: list[str] = []
    for row_id, entity_type, entity_id, language, field, value in rows:
        key = entity_type, entity_id.lower(), language.lower(), field
        existing[key] = (row_id.lower(), value or "")
        if language.lower() == "bs":
            bs_material.append("\x1f".join((row_id.lower(), entity_type, entity_id.lower(), field, value or "")))
    bs_hash = hashlib.sha256("\x1e".join(sorted(bs_material)).encode("utf-8")).hexdigest()
    candidates: list[Candidate] = []

    def add(entity_type: str, entity_id: str, language: str, field: str, source_language: str, source: str, label: str, mode: str | None = None):
        entity_id = entity_id.lower()
        target_key = entity_type, entity_id, language, field
        target_existing = existing.get(target_key)
        if target_existing and target_existing[1].strip():
            return
        if not source or not source.strip():
            return
        candidate = Candidate(
            entity_type, entity_id, language, field, source_language, source, label,
            mode or ("copy" if should_copy(entity_type, field, source) else "translate"),
            target_existing[0] if target_existing else None,
        )
        candidates.append(candidate)
        existing[target_key] = (candidate.existing_empty_id or "pending", "__pending__")

    pair_groups: dict[tuple[str, str, str], dict[str, str]] = defaultdict(dict)
    for (_, entity_type, entity_id, language, field, value) in rows:
        if language.lower() in LANGUAGES and value and value.strip():
            pair_groups[(entity_type, entity_id.lower(), field)][language.lower()] = value
    for (entity_type, entity_id, field), pair in pair_groups.items():
        if "sq" in pair and "en" not in pair:
            add(entity_type, entity_id, "en", field, "sq", pair["sq"], labels.get((entity_type, entity_id), entity_id))
        elif "en" in pair and "sq" not in pair:
            add(entity_type, entity_id, "sq", field, "en", pair["en"], labels.get((entity_type, entity_id), entity_id))

    structured = [
        ("PageContent", "SELECT CAST(Id AS nvarchar(36)), CONCAT(PageKey, '/', SectionKey), ContentJson FROM PageContents", "content"),
        ("HomepageSection", "SELECT CAST(Id AS nvarchar(36)), [Key], ConfigurationJson FROM HomepageSections", "configuration"),
    ]
    for entity_type, query, prefix in structured:
        for entity_id, label, raw_json in cursor.execute(query).fetchall():
            try:
                content = json.loads(raw_json or "{}")
            except json.JSONDecodeError:
                continue
            for path, value in json_leaves(content):
                if not is_meaningful_text(value):
                    continue
                field = f"{prefix}.{path}"
                add(entity_type, entity_id, "en", field, "en", value, label, "copy")
                add(entity_type, entity_id, "sq", field, "en", value, label)

    for entity_id, key, value in cursor.execute(
        "SELECT CAST(Id AS nvarchar(36)), [Key], Value FROM SiteSettings WHERE Value IS NOT NULL"
    ).fetchall():
        if key.startswith("social.") or not is_meaningful_text(value):
            continue
        add("SiteSetting", entity_id, "en", "value", "en", value, key, "copy")
        copy = key in {"site.name", "site.shortName", "contact.location"}
        add("SiteSetting", entity_id, "sq", "value", "en", value, key, "copy" if copy else "translate")

    for entity_id, label, url in cursor.execute(
        "SELECT CAST(Id AS nvarchar(36)), Label, Url FROM ExternalLinks WHERE NULLIF(LTRIM(RTRIM(Label)), '') IS NOT NULL"
    ).fetchall():
        if label.strip() == url.strip() or URL_RE.fullmatch(label.strip()):
            continue
        add("ExternalLink", entity_id, "en", "label", "en", label, url, "copy")
        add("ExternalLink", entity_id, "sq", "label", "en", label, url)

    official_ministry = "Ministria e Kulturës, Rinisë dhe Sportit"
    for entity_id, name in cursor.execute("SELECT CAST(Id AS nvarchar(36)), Name FROM Sponsors").fetchall():
        add("Sponsor", entity_id, "en", "name", "en", name, name, "copy")
        if name == "Ministry of Culture, Youth and Sport":
            add("Sponsor", entity_id, "sq", "name", "en", official_ministry, name, "copy")
        else:
            add("Sponsor", entity_id, "sq", "name", "en", name, name, "copy")

    return candidates, existing, bs_hash


def protected_terms(cursor) -> list[str]:
    terms: set[str] = {
        "Prishtina International Theater Festival", "Prishtina International Theatre Festival",
        "AAB Theater", "AAB Theatre", "AAB College", "Kolegji AAB", "Teatri AAB",
        "Burbuqe Berisha", "Faruk Begolli",
    }
    queries = [
        "SELECT Name FROM Sponsors",
        "SELECT Country FROM ProgramItems WHERE Country IS NOT NULL",
        "SELECT Company FROM ProgramItems WHERE Company IS NOT NULL",
        "SELECT Director FROM ProgramItems WHERE Director IS NOT NULL",
        "SELECT Venue FROM ProgramItems WHERE Venue IS NOT NULL",
        "SELECT Venue FROM FestivalActivities WHERE Venue IS NOT NULL",
        "SELECT Recipient FROM Awards",
        "SELECT Person FROM Awards WHERE Person IS NOT NULL",
        "SELECT Value FROM SiteSettings WHERE [Key] IN ('site.name','site.shortName','contact.location')",
    ]
    for query in queries:
        for (value,) in cursor.execute(query).fetchall():
            if value and len(value.strip()) >= 2:
                terms.add(value.strip())
                repaired, changed = OfflineTranslator._repair_mojibake(value.strip())
                if changed:
                    terms.add(repaired)
    for (title,) in cursor.execute(
        "SELECT t.Value FROM Translations t JOIN ProgramItems p ON p.Id=t.EntityId "
        "WHERE t.EntityType='ProgramItem' AND t.Field='title'"
    ).fetchall():
        if title:
            terms.add(title.strip())
    return list(terms)


def validate(candidate: Candidate) -> str | None:
    target = candidate.target or ""
    if not target.strip():
        return "translator returned empty text"
    if candidate.mode == "copy" and target != candidate.source:
        return "exact-copy field changed"
    if [m.group(0) for m in HTML_RE.finditer(candidate.source)] != [m.group(0) for m in HTML_RE.finditer(target)]:
        return "HTML tag sequence changed"
    if URL_RE.findall(candidate.source) != URL_RE.findall(target):
        return "URL/email sequence changed"
    if len(NEWLINE_RE.findall(candidate.source)) != len(NEWLINE_RE.findall(target)):
        return "paragraph/newline structure changed"
    return None


def apply_candidates(connection, candidates: list[Candidate]) -> tuple[list[Candidate], list[dict]]:
    inserted: list[Candidate] = []
    unsafe: list[dict] = []
    cursor = connection.cursor()
    for candidate in candidates:
        issue = validate(candidate)
        if issue:
            unsafe.append({"entityType": candidate.entity_type, "entityId": candidate.entity_id, "label": candidate.label,
                           "field": candidate.field, "targetLanguage": candidate.target_language, "reason": issue})
            continue
        if candidate.existing_empty_id:
            cursor.execute(
                "UPDATE Translations SET Value=? WHERE Id=CONVERT(uniqueidentifier, ?) "
                "AND NULLIF(LTRIM(RTRIM(Value)), '') IS NULL",
                candidate.target, candidate.existing_empty_id,
            )
        else:
            cursor.execute(
                "INSERT INTO Translations (Id,EntityType,EntityId,LanguageCode,Field,Value) "
                "VALUES (NEWID(),?,CONVERT(uniqueidentifier, ?),?,?,?)",
                candidate.entity_type, candidate.entity_id, candidate.target_language, candidate.field, candidate.target,
            )
        inserted.append(candidate)
    connection.commit()
    return inserted, unsafe


def write_report(started: str, inserted: list[Candidate], unsafe: list[dict], before_count: int, after_count: int,
                 bs_before: str, bs_after: str, cache: dict[str, str]):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    by_direction = Counter(f"{c.source_language}->{c.target_language}" for c in inserted if c.mode == "translate")
    by_entity = Counter(c.entity_type for c in inserted)
    translated = [c for c in inserted if c.mode == "translate"]
    copied = [c for c in inserted if c.mode == "copy"]
    payload = {
        "startedAt": started,
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "translationRowsBefore": before_count,
        "translationRowsAfter": after_count,
        "rowsAddedOrFilled": len(inserted),
        "machineTranslatedFields": len(translated),
        "normalizedOrExactCopiedFields": len(copied),
        "distinctItemsChanged": len({(c.entity_type, c.entity_id) for c in inserted}),
        "byDirection": dict(by_direction),
        "byEntityType": dict(by_entity),
        "unsafe": unsafe,
        "bsUnchanged": bs_before == bs_after,
        "bsChecksumBefore": bs_before,
        "bsChecksumAfter": bs_after,
        "cacheEntries": len(cache),
        "inserted": [c.__dict__ for c in inserted],
    }
    (OUTPUT / "translation-backfill-report.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUTPUT / "translation-cache.jsonl").open("w", encoding="utf-8") as handle:
        for key, value in sorted(cache.items()):
            handle.write(json.dumps({"key": key, "value": value}, ensure_ascii=False) + "\n")

    lines = [
        "# SQ/EN Translation Backfill Report", "", f"Completed: {payload['completedAt']}", "",
        "## Summary", "",
        f"- Translation rows before: **{before_count:,}**",
        f"- Translation rows after: **{after_count:,}**",
        f"- Missing/empty fields filled: **{len(inserted):,}**",
        f"- Machine-translated fields: **{len(translated):,}**",
        f"- Normalized or exact-copied fields: **{len(copied):,}**",
        f"- Distinct content items changed: **{payload['distinctItemsChanged']:,}**",
        f"- Unsafe/untranslated fields: **{len(unsafe):,}**",
        f"- Existing BS rows unchanged: **{'YES' if payload['bsUnchanged'] else 'NO'}**", "",
        "No non-empty translation was overwritten. Program/play titles, organization/person names, venues, URLs,",
        "dates, times, HTML tags, and paragraph breaks were protected. Machine translations should still receive",
        "normal editorial review before publication because Albanian is a lower-resource machine-translation pair.", "",
        "## Fields filled by direction", "",
    ]
    for key, count in sorted(by_direction.items()):
        lines.append(f"- {key}: **{count:,}**")
    lines += ["", "## Fields filled by entity", ""]
    for key, count in sorted(by_entity.items()):
        lines.append(f"- {key}: **{count:,}**")
    lines += ["", "## Could not safely translate", ""]
    if unsafe:
        lines += ["| Entity | Item | Field | Language | Reason |", "|---|---|---|---|---|"]
        for item in unsafe:
            safe_label = str(item["label"]).replace("|", "\\|")
            lines.append(f"| {item['entityType']} | {safe_label} | `{item['field']}` | {item['targetLanguage']} | {item['reason']} |")
    else:
        lines.append("None. All candidates passed structural safeguards.")
    lines += ["", "## Audit artifacts", "",
              "- Full inserted-field inventory: `Translation/output/translation-backfill-report.json`",
              "- Reusable local translation cache: `Translation/output/translation-cache.jsonl`",
              "- Offline model/runtime directory: `.translation-tools/` (git-ignored)", ""]
    (ROOT / "TRANSLATION-BACKFILL.md").write_text("\n".join(lines), encoding="utf-8")


def bs_checksum(cursor) -> str:
    rows = cursor.execute(
        "SELECT CAST(Id AS nvarchar(36)),EntityType,CAST(EntityId AS nvarchar(36)),Field,Value "
        "FROM Translations WHERE LanguageCode='bs'"
    ).fetchall()
    material = ["\x1f".join(str(value or "").lower() if i in (0, 2) else str(value or "") for i, value in enumerate(row)) for row in rows]
    return hashlib.sha256("\x1e".join(sorted(material)).encode("utf-8")).hexdigest()


def load_cache() -> dict[str, str]:
    path = OUTPUT / "translation-cache.jsonl"
    if not path.exists():
        return {}
    cache: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            item = json.loads(line)
            cache[item["key"]] = item["value"]
    return cache


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default=r".\SQLEXPRESS")
    parser.add_argument("--database", default="PITF")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--retranslate-generated", action="store_true",
                        help="Regenerate only machine rows recorded by this backfill; never touches older rows")
    args = parser.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    connection = pyodbc.connect(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={args.server};DATABASE={args.database};"
        "Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes"
    )
    cursor = connection.cursor()
    if args.retranslate_generated:
        report_path = OUTPUT / "translation-backfill-report.json"
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        historical_types = {"News", "FestivalActivity", "FestivalDay", "Gallery"}
        candidates = [Candidate(**item) for item in payload["inserted"]
                      if item.get("mode") == "translate" and item.get("entity_type") in historical_types]
        terms = protected_terms(cursor)
        cache = load_cache()
        for source, target in (("sq", "en"), ("en", "sq")):
            direction = [c for c in candidates if c.source_language == source and c.target_language == target]
            if direction:
                OfflineTranslator(source, target, terms, cache).translate_many(direction)
        unsafe = [(c, validate(c)) for c in candidates]
        unsafe = [(c, issue) for c, issue in unsafe if issue]
        if unsafe:
            raise RuntimeError(f"Refusing retranslation; {len(unsafe)} fields failed validation")
        for candidate in candidates:
            cursor.execute(
                "UPDATE Translations SET Value=? WHERE EntityType=? AND EntityId=CONVERT(uniqueidentifier, ?) "
                "AND LanguageCode=? AND Field=?",
                candidate.target, candidate.entity_type, candidate.entity_id, candidate.target_language, candidate.field,
            )
        connection.commit()
        refreshed = {c.key: c for c in candidates}
        for item in payload["inserted"]:
            key = (item["entity_type"], item["entity_id"], item["target_language"], item["field"])
            if key in refreshed:
                item["target"] = refreshed[key].target
                item["repaired_source"] = refreshed[key].repaired_source
        payload["historicalFieldsRetranslatedWithPunctuationProtection"] = len(candidates)
        report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        with (OUTPUT / "translation-cache.jsonl").open("w", encoding="utf-8") as handle:
            for key, value in sorted(cache.items()):
                handle.write(json.dumps({"key": key, "value": value}, ensure_ascii=False) + "\n")
        print(json.dumps({"retranslated": len(candidates), "unsafe": 0}, ensure_ascii=False))
        return 0
    before_count = cursor.execute("SELECT COUNT(*) FROM Translations").fetchval()
    candidates, _, bs_before = collect_candidates(cursor)
    terms = protected_terms(cursor)
    cache = load_cache()
    print(f"Candidates: {len(candidates)}; protected terms: {len(terms)}", flush=True)

    for candidate in candidates:
        if candidate.mode == "copy":
            candidate.target = candidate.source
    for source, target in (("sq", "en"), ("en", "sq")):
        direction = [c for c in candidates if c.mode == "translate" and c.source_language == source and c.target_language == target]
        if direction:
            OfflineTranslator(source, target, terms, cache).translate_many(direction)

    if args.dry_run:
        unsafe = []
        for candidate in candidates:
            issue = validate(candidate)
            if issue:
                unsafe.append({"entityType": candidate.entity_type, "entityId": candidate.entity_id, "label": candidate.label,
                               "field": candidate.field, "targetLanguage": candidate.target_language, "reason": issue})
        print(json.dumps({"candidates": len(candidates), "unsafe": unsafe}, ensure_ascii=False, indent=2))
        return 0 if not unsafe else 2

    inserted, unsafe = apply_candidates(connection, candidates)
    after_count = cursor.execute("SELECT COUNT(*) FROM Translations").fetchval()
    bs_after = bs_checksum(cursor)
    write_report(started, inserted, unsafe, before_count, after_count, bs_before, bs_after, cache)
    print(json.dumps({"filled": len(inserted), "unsafe": len(unsafe), "before": before_count,
                      "after": after_count, "bsUnchanged": bs_before == bs_after}, ensure_ascii=False))
    return 0 if bs_before == bs_after else 3


if __name__ == "__main__":
    sys.exit(main())
