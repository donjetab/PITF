using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Models;

namespace PITF.Api.Import;

public sealed class StructuredContentImporter(ApplicationDbContext db, IWebHostEnvironment environment)
{
    private static readonly Dictionary<string, string> ActivityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["performance"] = "performance", ["press-conference"] = "press-conference", ["afterparty"] = "afterparty",
        ["opening"] = "opening-ceremony", ["awards"] = "award-ceremony"
    };

    public async Task<StructuredImportSummary> RunAsync(string newsRoot, CancellationToken ct)
    {
        // The historical importer runs immediately before this pass in the same scope.
        // Its tracked graph is complete and must not compete with this idempotent relationship pass.
        db.ChangeTracker.Clear();
        var sourceRows = await ReadNewsSourcesAsync(newsRoot, ct);
        var daysCreated = await EnsureDaysAndActivitiesAsync(sourceRows, ct);
        var galleriesCreated = await EnsureGalleriesAsync(sourceRows, ct);
        var recapsLinked = await LinkEditionRecapsAsync(ct);
        var selectionsCreated = await EnsureHomepageSelectionsAsync(ct);
        return new(daysCreated.Days, daysCreated.Activities, galleriesCreated, recapsLinked, selectionsCreated);
    }

    private static async Task<List<SourceNews>> ReadNewsSourcesAsync(string newsRoot, CancellationToken ct)
    {
        var rows = new Dictionary<string, SourceNews>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in Directory.EnumerateFiles(newsRoot, "news-*.json", SearchOption.AllDirectories).OrderBy(x => x))
        {
            using var document = JsonDocument.Parse(await File.ReadAllBytesAsync(file, ct));
            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (!item.TryGetProperty("festivalDayNumber", out var dayNode) || dayNode.ValueKind != JsonValueKind.Number) continue;
                var row = new SourceNews(item.GetProperty("slug").GetString()!, item.GetProperty("editionYear").GetInt32(), dayNode.GetInt32(),
                    DateOnly.Parse(item.GetProperty("date").GetString()!), item.TryGetProperty("suggestedType", out var type) ? type.GetString() : null);
                rows.TryAdd(row.Slug, row);
            }
        }
        return rows.Values.ToList();
    }

    private async Task<(int Days, int Activities)> EnsureDaysAndActivitiesAsync(List<SourceNews> sources, CancellationToken ct)
    {
        var editions = await db.Editions.ToDictionaryAsync(x => x.Year, ct); var daysCreated = 0; var activitiesCreated = 0;
        foreach (var group in sources.GroupBy(x => new { x.Year, x.DayNumber }))
        {
            if (!editions.TryGetValue(group.Key.Year, out var edition)) continue;
            var day = await db.FestivalDays.SingleOrDefaultAsync(x => x.EditionId == edition.Id && x.DayNumber == group.Key.DayNumber, ct);
            if (day is null)
            {
                day = new FestivalDay { EditionId = edition.Id, DayNumber = group.Key.DayNumber, Date = group.Min(x => x.Date), Order = group.Key.DayNumber };
                db.FestivalDays.Add(day); daysCreated++;
            }
            await UpsertTranslationAsync(nameof(FestivalDay), day.Id, "en", "title", $"Day {group.Key.DayNumber}", ct);
        }
        await db.SaveChangesAsync(ct);

        var newsBySlug = await db.News.Include(x => x.Media).ToDictionaryAsync(x => x.Slug, StringComparer.OrdinalIgnoreCase, ct);
        var days = await db.FestivalDays.ToDictionaryAsync(x => (x.EditionId, x.DayNumber), ct);
        foreach (var source in sources)
        {
            if (!newsBySlug.TryGetValue(source.Slug, out var news) || !news.EditionId.HasValue || !days.TryGetValue((news.EditionId.Value, source.DayNumber), out var day)) continue;
            news.FestivalDayId = day.Id;
            if (source.Type is null || !ActivityTypes.TryGetValue(source.Type, out var type)) continue;
            FestivalActivity? activity = null;
            if (type == "performance") activity = await db.FestivalActivities.FirstOrDefaultAsync(x => x.FestivalDayId == day.Id && x.Type == "performance" && x.ProgramItemId != null, ct);
            if (activity is null && news.ActivityId.HasValue) activity = await db.FestivalActivities.FindAsync([news.ActivityId.Value], ct);
            if (activity is null)
            {
                var nextOrder = await db.FestivalActivities.CountAsync(x => x.FestivalDayId == day.Id, ct) + 1;
                activity = new FestivalActivity { FestivalDayId = day.Id, Type = type, Order = nextOrder };
                db.FestivalActivities.Add(activity); activitiesCreated++;
            }
            news.ActivityId = activity.Id;
            var translations = await db.Translations.AsNoTracking().Where(x => x.EntityType == nameof(News) && x.EntityId == news.Id).ToListAsync(ct);
            foreach (var translation in translations) await UpsertTranslationAsync(nameof(FestivalActivity), activity.Id, translation.LanguageCode, translation.Field, translation.Value, ct);
        }
        await db.SaveChangesAsync(ct);
        return (daysCreated, activitiesCreated);
    }

    private async Task<int> EnsureGalleriesAsync(List<SourceNews> sources, CancellationToken ct)
    {
        var created = 0;
        var galleryNews = sources.Where(x => string.Equals(x.Type, "gallery", StringComparison.OrdinalIgnoreCase)).Select(x => x.Slug).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var news = await db.News.AsNoTracking().Include(x => x.Media).Where(x => galleryNews.Contains(x.Slug)).ToListAsync(ct);
        foreach (var item in news)
        {
            var ordered = item.Media.OrderBy(x => x.Order).ToList();
            var sourceCoverId = ordered.FirstOrDefault()?.MediaId;
            var gallery = await db.Galleries.Include(x => x.Media).FirstOrDefaultAsync(x => x.ActivityId == item.ActivityId && x.FestivalDayId == item.FestivalDayId && x.EditionId == item.EditionId && x.Order == item.Order && x.CoverMediaId == sourceCoverId, ct);
            if (gallery is null)
            {
                gallery = new Gallery { EditionId = item.EditionId, FestivalDayId = item.FestivalDayId, ActivityId = item.ActivityId, Status = ContentStatus.Published, PublishedAt = item.PublishedAt, Order = item.Order };
                db.Galleries.Add(gallery); created++;
            }
            gallery.CoverMediaId ??= sourceCoverId;
            foreach (var link in ordered) if (gallery.Media.All(x => x.MediaId != link.MediaId)) gallery.Media.Add(new GalleryMedia { MediaId = link.MediaId, Order = link.Order });
            var translations = await db.Translations.AsNoTracking().Where(x => x.EntityType == nameof(News) && x.EntityId == item.Id && x.Field == "title").ToListAsync(ct);
            foreach (var translation in translations) await UpsertTranslationAsync(nameof(Gallery), gallery.Id, translation.LanguageCode, "title", translation.Value, ct);
        }

        var dataPath = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "frontend", "src", "data", "editionDayMedia.js"));
        if (File.Exists(dataPath))
        {
            var script = await File.ReadAllTextAsync(dataPath, ct); var start = script.IndexOf('{'); var end = script.LastIndexOf('}');
            using var document = JsonDocument.Parse(script[start..(end + 1)]);
            var editions = await db.Editions.AsNoTracking().ToDictionaryAsync(x => x.Year, ct);
            foreach (var yearNode in document.RootElement.EnumerateObject())
            {
                if (!int.TryParse(yearNode.Name, out var year) || !editions.TryGetValue(year, out var edition)) continue;
                foreach (var dayNode in yearNode.Value.EnumerateObject())
                {
                    if (!int.TryParse(dayNode.Name, out var dayNumber)) continue;
                    var day = await db.FestivalDays.SingleOrDefaultAsync(x => x.EditionId == edition.Id && x.DayNumber == dayNumber, ct); if (day is null) continue;
                    var galleryOrder = 1000 + dayNumber;
                    var gallery = await db.Galleries.Include(x => x.Media).FirstOrDefaultAsync(x => x.EditionId == edition.Id && x.FestivalDayId == day.Id && x.ActivityId == null && x.ProgramItemId == null && x.Order == galleryOrder, ct);
                    if (gallery is null)
                    {
                        var legacy = await db.Galleries.Include(x => x.Media).Where(x => x.EditionId == edition.Id && x.FestivalDayId == day.Id && x.ActivityId == null && x.ProgramItemId == null && x.Order == dayNumber).ToListAsync(ct);
                        gallery = legacy.FirstOrDefault(x => !db.Translations.Any(t => t.EntityType == nameof(Gallery) && t.EntityId == x.Id));
                        if (gallery is not null) gallery.Order = galleryOrder;
                        else { gallery = new Gallery { EditionId = edition.Id, FestivalDayId = day.Id, Status = ContentStatus.Published, PublishedAt = edition.PublishedAt, Order = galleryOrder }; db.Galleries.Add(gallery); created++; }
                    }
                    var paths = new List<string>();
                    if (dayNode.Value.TryGetProperty("images", out var images)) paths.AddRange(images.EnumerateArray().Select(x => x.GetString()).Where(x => x is not null)!);
                    if (dayNode.Value.TryGetProperty("recap", out var recap) && recap.ValueKind == JsonValueKind.String && recap.GetString() is { } recapPath) paths.Add(recapPath);
                    var order = 0;
                    foreach (var path in paths)
                    {
                        var media = await FindFrontendMediaAsync(path, ct); if (media is null || gallery.Media.Any(x => x.MediaId == media.Id)) continue;
                        gallery.Media.Add(new GalleryMedia { MediaId = media.Id, Order = order++ }); gallery.CoverMediaId ??= media.Type == MediaType.Image ? media.Id : null;
                    }
                }
            }
        }
        await db.SaveChangesAsync(ct); return created;
    }

    private async Task<int> LinkEditionRecapsAsync(CancellationToken ct)
    {
        var paths = new Dictionary<int, string> { [1] = "/assets/editions/2017/recap.mp4", [7] = "/assets/editions/2023/2023-recap.mp4", [8] = "/assets/editions/2024/recap.mp4", [9] = "/assets/editions/2025/recap.mp4", [10] = "/assets/editions/2026/3/recap/recap.mp4" };
        var count = 0;
        foreach (var pair in paths)
        {
            var edition = await db.Editions.SingleAsync(x => x.Number == pair.Key, ct); var media = await FindFrontendMediaAsync(pair.Value, ct);
            if (media is null) continue; if (edition.RecapMediaId != media.Id) { edition.RecapMediaId = media.Id; count++; }
        }
        await db.SaveChangesAsync(ct); return count;
    }

    private async Task<int> EnsureHomepageSelectionsAsync(CancellationToken ct)
    {
        var created = 0; var programSection = await db.HomepageSections.Include(x => x.Selections).SingleAsync(x => x.Key == "featured-program", ct);
        var program = await db.ProgramItems.Where(x => x.Edition.Year == 2026 && x.Status == ContentStatus.Published).OrderBy(x => x.Order).ToListAsync(ct);
        foreach (var item in program) if (programSection.Selections.All(x => x.EntityType != nameof(ProgramItem) || x.EntityId != item.Id))
        {
            db.HomepageSelections.Add(new HomepageSelection { HomepageSectionId = programSection.Id, EntityType = nameof(ProgramItem), EntityId = item.Id, Order = item.Order });
            created++;
        }
        var newsSection = await db.HomepageSections.SingleAsync(x => x.Key == "featured-news", ct); newsSection.IsVisible = false;
        await db.SaveChangesAsync(ct); return created;
    }

    private async Task<Media?> FindFrontendMediaAsync(string publicPath, CancellationToken ct)
    {
        var relative = Uri.UnescapeDataString(publicPath).TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var path = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "frontend", "public", relative));
        if (!File.Exists(path)) return null;
        await using var stream = File.OpenRead(path); var sha = Convert.ToHexString(await SHA256.HashDataAsync(stream, ct)).ToLowerInvariant();
        return await db.Media.SingleOrDefaultAsync(x => x.Sha256 == sha, ct);
    }

    private async Task UpsertTranslationAsync(string entityType, Guid id, string language, string field, string value, CancellationToken ct)
    {
        var row = await db.Translations.SingleOrDefaultAsync(x => x.EntityType == entityType && x.EntityId == id && x.LanguageCode == language && x.Field == field, ct);
        if (row is null) db.Translations.Add(new Translation { EntityType = entityType, EntityId = id, LanguageCode = language, Field = field, Value = value }); else row.Value = value;
    }

    private sealed record SourceNews(string Slug, int Year, int DayNumber, DateOnly Date, string? Type);
}

public sealed record StructuredImportSummary(int FestivalDaysCreated, int ActivitiesCreated, int GalleriesCreated, int EditionRecapsLinked, int HomepageSelectionsCreated);
