using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Models;

namespace PITF.Api.Import;

public sealed class OrganizedMediaImporter(ApplicationDbContext db)
{
    private static readonly HashSet<string> MediaExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm" };

    public async Task<OrganizedMediaImportSummary> RunAsync(string root, CancellationToken ct)
    {
        root = Path.GetFullPath(root);
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException(root);

        var editions = await db.Editions.ToDictionaryAsync(x => x.Year, ct);
        var days = (await db.FestivalDays.ToListAsync(ct)).ToDictionary(x => (x.EditionId, x.DayNumber));
        var program = await db.ProgramItems.OrderBy(x => x.Order).ToListAsync(ct);
        var news = await db.News.ToDictionaryAsync(x => x.Slug, StringComparer.OrdinalIgnoreCase, ct);
        var mediaRows = await db.Media.ToListAsync(ct);
        var mediaByHash = mediaRows.ToDictionary(x => x.Sha256.ToLowerInvariant(), StringComparer.OrdinalIgnoreCase);
        var occurrences = new List<MediaOccurrence>();
        var unreadable = new List<string>();

        foreach (var path in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
                     .Where(x => MediaExtensions.Contains(Path.GetExtension(x))).OrderBy(x => x))
        {
            try
            {
                var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
                var hash = await HashAsync(path, ct);
                occurrences.Add(ParseOccurrence(path, relative, hash));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                unreadable.Add(Path.GetRelativePath(root, path));
            }
        }

        var grouped = occurrences.GroupBy(x => x.Hash, StringComparer.OrdinalIgnoreCase).ToList();
        var unmatched = grouped.Where(x => !mediaByHash.ContainsKey(x.Key)).SelectMany(x => x).Select(x => x.RelativePath).ToList();
        var editionRoot = await EnsureFolderAsync("Editions", null, null, null, ct);
        var newsRoot = await EnsureFolderAsync("News", null, null, null, ct);
        var editionFolders = new Dictionary<int, MediaFolder>();
        var newsFolders = new Dictionary<int, MediaFolder>();
        var relabeled = 0;

        foreach (var group in grouped.Where(x => mediaByHash.ContainsKey(x.Key)))
        {
            var media = mediaByHash[group.Key];
            var primary = group.Where(x => x.Kind == "edition").OrderBy(x => x.RelativePath).FirstOrDefault()
                          ?? group.OrderBy(x => x.RelativePath).First();
            if (primary.Year is { } year)
            {
                if (primary.Kind == "edition" && editions.TryGetValue(year, out var edition))
                {
                    if (!editionFolders.TryGetValue(year, out var folder)) editionFolders[year] = folder = await EnsureFolderAsync(year.ToString(), editionRoot.Id, year, edition.Id, ct);
                    media.FolderId = folder.Id; media.Year = year; media.EditionId = edition.Id; media.Category = primary.Category;
                    if (primary.DayNumber is { } dayNumber && days.TryGetValue((edition.Id, dayNumber), out var day)) media.FestivalDayId = day.Id;
                    if (primary.Category == "performance" && primary.DayNumber is { } programDay)
                        media.ProgramItemId = program.FirstOrDefault(x => x.EditionId == edition.Id && x.Order == programDay)?.Id;
                    media.Tags = MergeTags(media.Tags, primary.DayNumber is { } n ? $"day-{n}" : null, primary.DetailTag);
                }
                else
                {
                    if (!newsFolders.TryGetValue(year, out var folder)) newsFolders[year] = folder = await EnsureFolderAsync(year.ToString(), newsRoot.Id, year, editions.GetValueOrDefault(year)?.Id, ct);
                    media.FolderId = folder.Id; media.Year ??= year; media.EditionId ??= editions.GetValueOrDefault(year)?.Id;
                }
            }
            relabeled++;
        }
        await db.SaveChangesAsync(ct);

        var linksBySlug = new Dictionary<string, List<Media>>(StringComparer.OrdinalIgnoreCase);
        void AddLink(string? slug, Media media)
        {
            slug = CleanSlug(slug); if (string.IsNullOrWhiteSpace(slug)) return;
            if (!linksBySlug.TryGetValue(slug, out var list)) linksBySlug[slug] = list = [];
            if (list.All(x => x.Id != media.Id)) list.Add(media);
        }
        foreach (var occurrence in occurrences.Where(x => x.Kind == "news" && mediaByHash.ContainsKey(x.Hash)).OrderBy(x => x.RelativePath))
            AddLink(occurrence.NewsSlug, mediaByHash[occurrence.Hash]);

        var workbookPath = Path.Combine(root, "News-Pics-Locations.xlsx");
        var spreadsheetRows = File.Exists(workbookPath) ? ReadLocationWorkbook(workbookPath) : [];
        var editionOccurrences = occurrences.Where(x => x.Kind == "edition" && mediaByHash.ContainsKey(x.Hash)).ToList();
        foreach (var row in spreadsheetRows)
            foreach (var location in row.Locations.Replace("\r", "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                foreach (var occurrence in MatchLocation(editionOccurrences, row.Year, location)) AddLink(row.Slug, mediaByHash[occurrence.Hash]);

        var synchronizedNews = 0; var linkedMedia = new HashSet<Guid>();
        foreach (var pair in linksBySlug)
        {
            if (!news.TryGetValue(pair.Key, out var article) || pair.Value.Count == 0) continue;
            var existing = await db.Set<NewsMedia>().Where(x => x.NewsId == article.Id).ToListAsync(ct);
            db.RemoveRange(existing);
            for (var index = 0; index < pair.Value.Count; index++)
            {
                db.Add(new NewsMedia { NewsId = article.Id, MediaId = pair.Value[index].Id, Order = index, Role = index == 0 ? "cover" : "gallery" });
                linkedMedia.Add(pair.Value[index].Id);
            }
            if (!pair.Value.Any(x => x.Id == article.CoverMediaId)) article.CoverMediaId = pair.Value.FirstOrDefault(x => x.Type == MediaType.Image)?.Id;
            synchronizedNews++;
        }
        foreach (var media in mediaRows.Where(x => linkedMedia.Contains(x.Id))) media.Tags = MergeTags(media.Tags, "news");
        await db.SaveChangesAsync(ct);

        var emptyFoldersRemoved = await RemoveEmptyFoldersAsync(ct);
        var unmatchedHashes = grouped.Count(x => !mediaByHash.ContainsKey(x.Key));
        return new OrganizedMediaImportSummary(
            occurrences.Count, grouped.Count, occurrences.Count - grouped.Count, grouped.Count - unmatchedHashes,
            unmatched.Count, unreadable.Count, relabeled, synchronizedNews, linkedMedia.Count, emptyFoldersRemoved,
            unmatched.Take(25).ToArray(), unreadable.Take(25).ToArray());
    }

    private async Task<MediaFolder> EnsureFolderAsync(string name, Guid? parentId, int? year, Guid? editionId, CancellationToken ct)
    {
        var folder = await db.MediaFolders.FirstOrDefaultAsync(x => x.ParentId == parentId && x.Name == name, ct);
        if (folder is not null) { folder.Year ??= year; folder.EditionId ??= editionId; return folder; }
        folder = new MediaFolder { Id = Guid.NewGuid(), Name = name, ParentId = parentId, Year = year, EditionId = editionId };
        db.MediaFolders.Add(folder); await db.SaveChangesAsync(ct); return folder;
    }

    private async Task<int> RemoveEmptyFoldersAsync(CancellationToken ct)
    {
        var removed = 0;
        while (true)
        {
            var empty = await db.MediaFolders.Where(folder =>
                !db.Media.Any(media => media.FolderId == folder.Id) &&
                !db.MediaFolders.Any(child => child.ParentId == folder.Id) &&
                folder.Name != "Editions" && folder.Name != "News").ToListAsync(ct);
            if (empty.Count == 0) return removed;
            db.MediaFolders.RemoveRange(empty); removed += empty.Count; await db.SaveChangesAsync(ct);
        }
    }

    private static MediaOccurrence ParseOccurrence(string fullPath, string relative, string hash)
    {
        var parts = relative.Split('/', StringSplitOptions.RemoveEmptyEntries); var kind = parts.FirstOrDefault()?.ToLowerInvariant() ?? "other";
        var year = parts.Length > 1 && int.TryParse(parts[1], out var parsedYear) ? parsedYear : (int?)null;
        int? day = null; if (kind == "editions" && parts.Length > 2 && int.TryParse(parts[2], out var parsedDay)) day = parsedDay;
        var metadataStart = kind == "editions" && day.HasValue ? 3 : 2;
        var directories = string.Join(' ', parts.Skip(metadataStart).SkipLast(1));
        var categorySource = directories + " " + Path.GetFileNameWithoutExtension(fullPath);
        var category = Category(categorySource); var detail = DetailTag(directories, category);
        var slug = kind == "news" && parts.Length > 2 ? parts[2] : null;
        return new(fullPath, relative, hash, kind == "editions" ? "edition" : kind, year, day, category, detail, slug);
    }

    private static IEnumerable<MediaOccurrence> MatchLocation(IEnumerable<MediaOccurrence> rows, int year, string location)
    {
        var lower = location.ToLowerInvariant(); if (!lower.Contains("edition")) return [];
        var category = Category(lower); int? day = null;
        var tokens = lower.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var token in tokens.SkipWhile(x => !x.Contains(year.ToString())).Skip(1))
            if (Regex.Match(token, @"\b(\d{1,2})(?:st|nd|rd|th)?\b") is { Success: true } match) { day = int.Parse(match.Groups[1].Value); break; }
        var qualifier = DetailTag(string.Join(' ', tokens.Skip(2)), category);
        var matches = rows.Where(x => x.Year == year && (day == null || x.DayNumber == day) && x.Category == category);
        if (!string.IsNullOrWhiteSpace(qualifier))
        {
            var narrowed = matches.Where(x => Normalize(x.RelativePath).Contains(Normalize(qualifier))).ToList();
            if (narrowed.Count > 0) return narrowed;
        }
        return matches;
    }

    private static string Category(string value)
    {
        var normalized = Normalize(value);
        if (normalized.Contains("afterparty")) return "after-party";
        if (normalized.Contains("konferenca") || normalized.Contains("conference")) return "press-conference";
        if (normalized.Contains("shfaqja") || normalized.Contains("performance")) return "performance";
        if (normalized.Contains("hapja") || normalized.Contains("opening")) return "opening-ceremony";
        if (normalized.Contains("mbyllja") || normalized.Contains("closing")) return "closing-ceremony";
        if (normalized.Contains("recap")) return "recap";
        if (normalized.Contains("ceremonia") || normalized.Contains("award") || normalized.Contains("cmime")) return "awards";
        return "other";
    }

    private static string? DetailTag(string value, string category)
    {
        if (category != "performance") return null;
        var cleaned = Regex.Replace(value, @"(?i)\b\d+\.?\s*|shfaqja|performance|edition|current|recap", " ");
        cleaned = Regex.Replace(cleaned, @"[^\p{L}\p{N}-]+", " ").Trim();
        return cleaned.Length is > 2 and < 80 ? cleaned.ToLowerInvariant() : null;
    }

    private static string? MergeTags(string? existing, params string?[] values)
    {
        var tags = (existing ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        foreach (var value in values.Where(x => !string.IsNullOrWhiteSpace(x))) if (!tags.Contains(value!, StringComparer.OrdinalIgnoreCase)) tags.Add(value!);
        return tags.Count == 0 ? null : string.Join(", ", tags);
    }

    private static async Task<string> HashAsync(string path, CancellationToken ct)
    {
        var readablePath = OperatingSystem.IsWindows() && !path.StartsWith(@"\\?\") ? @"\\?\" + path : path;
        await using var stream = new FileStream(readablePath, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 128, FileOptions.Asynchronous | FileOptions.SequentialScan);
        return Convert.ToHexString(await SHA256.HashDataAsync(stream, ct)).ToLowerInvariant();
    }

    private static string Normalize(string value) => new(value.Normalize().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    private static string? CleanSlug(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Replace('\\', '/').TrimEnd('/').Split('/').LastOrDefault();

    private static List<LocationRow> ReadLocationWorkbook(string path)
    {
        using var zip = ZipFile.OpenRead(path); XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        XDocument Read(string name) { using var stream = zip.GetEntry(name)!.Open(); return XDocument.Load(stream); }
        var shared = Read("xl/sharedStrings.xml").Descendants(ns + "si").Select(x => string.Concat(x.Descendants(ns + "t").Select(t => t.Value))).ToList();
        string? Cell(XElement row, string column)
        {
            var cell = row.Elements(ns + "c").FirstOrDefault(x => ((string?)x.Attribute("r"))?.StartsWith(column, StringComparison.Ordinal) == true);
            var raw = cell?.Element(ns + "v")?.Value; if (raw is null) return null;
            return (string?)cell?.Attribute("t") == "s" && int.TryParse(raw, out var index) ? shared[index] : raw;
        }
        return Read("xl/worksheets/sheet1.xml").Descendants(ns + "row").Select(row => new { Year = Cell(row, "B"), Slug = Cell(row, "C"), Locations = Cell(row, "D") })
            .Where(x => int.TryParse(x.Year, out _) && !string.IsNullOrWhiteSpace(x.Slug) && !string.IsNullOrWhiteSpace(x.Locations))
            .Select(x => new LocationRow(int.Parse(x.Year!), CleanSlug(x.Slug)!, x.Locations!)).ToList();
    }

    private sealed record MediaOccurrence(string FullPath, string RelativePath, string Hash, string Kind, int? Year, int? DayNumber, string Category, string? DetailTag, string? NewsSlug);
    private sealed record LocationRow(int Year, string Slug, string Locations);
}

public sealed record OrganizedMediaImportSummary(int FilesScanned, int UniqueFiles, int DuplicateCopiesIgnored, int ExistingFilesMatched,
    int UnmatchedFiles, int UnreadableFiles, int MediaRelabeled, int NewsSynchronized, int MediaLinkedToNews, int EmptyFoldersRemoved,
    IReadOnlyList<string> UnmatchedExamples, IReadOnlyList<string> UnreadableExamples);
