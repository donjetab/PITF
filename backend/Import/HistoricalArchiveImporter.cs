using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Models;
using PITF.Api.Storage;
using SixLabors.ImageSharp;

namespace PITF.Api.Import;

public sealed class HistoricalArchiveImporter(
    ApplicationDbContext db,
    IMediaStorageService storage,
    IImageVariantService imageVariants,
    IWebHostEnvironment environment)
{
    private readonly Dictionary<string, List<Media>> mediaBySourceId = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, MediaFolder> folders = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Media> mediaByPath = new(StringComparer.OrdinalIgnoreCase);

    public async Task<ImportSummary> RunAsync(string newsRoot, CancellationToken ct)
    {
        var frontendRoot = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "frontend"));
        if (!Directory.Exists(newsRoot)) throw new DirectoryNotFoundException(newsRoot);
        await EnsureReferenceContentAsync(frontendRoot, ct);
        await LoadExistingMediaAsync(ct);

        var mediaJsonFiles = Directory.EnumerateFiles(newsRoot, "media-*.json", SearchOption.AllDirectories).OrderBy(x => x).ToArray();
        var newsJsonFiles = Directory.EnumerateFiles(newsRoot, "news-*.json", SearchOption.AllDirectories).OrderBy(x => x).ToArray();
        var sourceMediaReferences = 0;
        foreach (var file in mediaJsonFiles)
            sourceMediaReferences += await ImportMediaManifestAsync(file, ct);

        var sourceNewsRecords = 0;
        foreach (var file in newsJsonFiles)
            sourceNewsRecords += await ImportNewsManifestAsync(file, ct);

        var publicAssets = Path.Combine(frontendRoot, "public", "assets");
        var extraFiles = await ImportTreeAsync(publicAssets, "Frontend content", null, ct);
        var archiveFiles = await ImportUnregisteredTreeAsync(newsRoot, "PITF archive", ct);
        await db.SaveChangesAsync(ct);
        await RepairJfifImagesAsync(ct);
        await LinkFrontendContentMediaAsync(ct);

        return new ImportSummary(
            newsJsonFiles.Length, mediaJsonFiles.Length, sourceNewsRecords, sourceMediaReferences,
            await db.News.CountAsync(ct), await db.Media.CountAsync(ct), await db.MediaFolders.CountAsync(ct),
            await db.Set<NewsMedia>().CountAsync(ct), await db.Translations.CountAsync(ct), extraFiles + archiveFiles);
    }

    private async Task EnsureReferenceContentAsync(string frontendRoot, CancellationToken ct)
    {
        foreach (var language in new[] { ("sq", "Albanian", true, 1), ("en", "English", true, 2), ("bs", "Bosnian/Serbian/Croatian", false, 3) })
            if (!await db.Languages.AnyAsync(x => x.Code == language.Item1, ct)) db.Languages.Add(new Language { Code = language.Item1, Name = language.Item2, IsPublic = language.Item3, Order = language.Item4 });

        var settings = new Dictionary<string, string?> {
            ["site.name"]="Prishtina International Theatre Festival", ["site.shortName"]="PITF", ["contact.location"]="Prishtina, Kosovo",
            ["social.instagram"]="#", ["social.facebook"]="#", ["social.tiktok"]="#", ["footer.copyright"]="© 2026 Prishtina International Theatre Festival. All rights reserved."
        };
        foreach (var pair in settings)
        {
            var row = await db.SiteSettings.SingleOrDefaultAsync(x => x.Key == pair.Key, ct);
            if (row is null) db.SiteSettings.Add(new SiteSetting { Key = pair.Key, Value = pair.Value, Group = pair.Key.Split('.')[0] }); else row.Value = pair.Value;
        }
        var navigation = new[] { ("home", "Home", "/"), ("about", "About", "/about"), ("editions", "Editions", "/editions"), ("news", "News", "/news"), ("contact", "Contact", "/contact") };
        for (var i = 0; i < navigation.Length; i++)
        {
            var item = await db.NavigationItems.SingleOrDefaultAsync(x => x.Key == navigation[i].Item1, ct);
            if (item is null) { item = new NavigationItem { Key = navigation[i].Item1, Url = navigation[i].Item3, Order = i, Status = ContentStatus.Published, PublishedAt = DateTimeOffset.UtcNow }; db.Add(item); }
            await UpsertTranslationAsync("NavigationItem", item.Id, "en", "label", navigation[i].Item2, ct);
        }

        var pageSections = FrontendContent.Sections;
        foreach (var section in pageSections)
        {
            var row = await db.PageContents.SingleOrDefaultAsync(x => x.PageKey == section.Page && x.SectionKey == section.Section, ct);
            if (row is null) { row = new PageContent { PageKey = section.Page, SectionKey = section.Section }; db.Add(row); }
            row.ContentJson = section.Json; row.Order = section.Order; row.Status = ContentStatus.Published; row.PublishedAt ??= DateTimeOffset.UtcNow;
        }

        for (var number = 1; number <= 10; number++)
        {
            var year = 2016 + number;
            var edition = await db.Editions.SingleOrDefaultAsync(x => x.Number == number, ct);
            if (edition is null) { edition = new Edition { Number = number, Year = year, Slug = $"edition-{number}" }; db.Add(edition); }
            edition.Status = ContentStatus.Published; edition.PublishedAt ??= DateTimeOffset.UtcNow; edition.Order = number;
            if (number == 10) { edition.StartDate = new DateOnly(2026, 5, 18); edition.EndDate = new DateOnly(2026, 5, 23); }
            await UpsertTranslationAsync("Edition", edition.Id, "en", "title", Ordinal(number) + " Edition", ct);
            if (number == 10) await UpsertTranslationAsync("Edition", edition.Id, "en", "description", "A milestone edition. A decade of theatre.", ct);
        }
        await db.SaveChangesAsync(ct);
        await EnsureProgramAsync(ct);
        await EnsureSponsorsAsync(ct);
        await EnsureHomepageAsync(ct);
    }

    private async Task EnsureProgramAsync(CancellationToken ct)
    {
        var edition = await db.Editions.SingleAsync(x => x.Number == 10, ct);
        var rows = FrontendContent.Program;
        for (var i = 0; i < rows.Length; i++)
        {
            var p = rows[i]; var slug = Slugify(p.Title);
            var item = await db.ProgramItems.SingleOrDefaultAsync(x => x.EditionId == edition.Id && x.Slug == slug, ct);
            if (item is null) { item = new ProgramItem { EditionId = edition.Id, Slug = slug }; db.Add(item); }
            item.Country = p.Country; item.Company = p.Company; item.Director = p.Director; item.StartsAt = p.StartsAt; item.Venue = p.Venue; item.Order = i + 1; item.Status = ContentStatus.Published; item.PublishedAt ??= DateTimeOffset.UtcNow;
            var playTranslation = await db.PlayTranslations.SingleOrDefaultAsync(x => x.PlayId == item.Id && x.LanguageCode == "en", ct);
            if (playTranslation is null) db.PlayTranslations.Add(new PlayTranslation { PlayId = item.Id, LanguageCode = "en", Title = p.Title });
            else playTranslation.Title = p.Title;
            var date = DateOnly.FromDateTime(p.StartsAt.DateTime);
            var day = await db.FestivalDays.SingleOrDefaultAsync(x => x.EditionId == edition.Id && x.DayNumber == i + 1, ct);
            if (day is null) { day = new FestivalDay { EditionId = edition.Id, DayNumber = i + 1 }; db.Add(day); }
            day.Date = date; day.Order = i + 1;
            await UpsertTranslationAsync("FestivalDay", day.Id, "en", "title", $"Day {i + 1}", ct);
            await db.SaveChangesAsync(ct);
            if (!await db.FestivalActivities.AnyAsync(x => x.FestivalDayId == day.Id && x.ProgramItemId == item.Id, ct))
                db.FestivalActivities.Add(new FestivalActivity { FestivalDayId = day.Id, ProgramItemId = item.Id, Type = "performance", StartTime = TimeOnly.FromDateTime(p.StartsAt.DateTime), Venue = p.Venue, Order = 1 });
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureSponsorsAsync(CancellationToken ct)
    {
        var edition = await db.Editions.SingleAsync(x => x.Number == 10, ct);
        for (var i = 0; i < FrontendContent.Sponsors.Length; i++)
        {
            var name = FrontendContent.Sponsors[i]; var sponsor = await db.Sponsors.SingleOrDefaultAsync(x => x.Name == name, ct);
            if (sponsor is null) { sponsor = new Sponsor { Name = name, Status = ContentStatus.Published, PublishedAt = DateTimeOffset.UtcNow, Order = i }; db.Add(sponsor); }
            await db.SaveChangesAsync(ct);
            if (!await db.Set<SponsorEdition>().AnyAsync(x => x.SponsorId == sponsor.Id && x.EditionId == edition.Id, ct)) db.Add(new SponsorEdition { SponsorId = sponsor.Id, EditionId = edition.Id, Order = i });
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureHomepageAsync(CancellationToken ct)
    {
        var keys = new[] { "hero", "about", "featured-edition", "featured-program", "editions", "featured-news", "sponsors", "newsletter" };
        var configuration = new Dictionary<string, string>
        {
            ["featured-program"] = "{\"title\":\"Program\",\"linkText\":\"View full program\"}",
            ["editions"] = "{\"title\":\"All PITF Editions\"}",
            ["featured-news"] = "{\"title\":\"News\"}",
            ["sponsors"] = "{\"kicker\":\"Sponsors\",\"title\":\"Together for the art\",\"text\":\"PITF is organized by passionate individuals and institutions committed to the development and promotion of contemporary theatre in Kosovo and beyond.\"}"
        };
        for (var i = 0; i < keys.Length; i++)
        {
            var section = await db.HomepageSections.SingleOrDefaultAsync(x => x.Key == keys[i], ct);
            if (section is null) { section = new HomepageSection { Key = keys[i], IsVisible = true, SelectionMode = keys[i] == "featured-edition" ? "automatic" : "manual", Order = i, Status = ContentStatus.Published, PublishedAt = DateTimeOffset.UtcNow, ItemLimit = keys[i] == "featured-news" ? 3 : null }; db.HomepageSections.Add(section); }
            if (configuration.TryGetValue(keys[i], out var json)) section.ConfigurationJson = json;
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task<int> ImportMediaManifestAsync(string manifestPath, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await File.ReadAllBytesAsync(manifestPath, ct)); var count = 0;
        foreach (var item in doc.RootElement.EnumerateArray())
        {
            count++; var sourceId = item.GetProperty("id").GetString()!; var src = item.GetProperty("src").GetString()!;
            var local = ResolveManifestMediaPath(manifestPath, src);
            if (!File.Exists(local)) continue;
            var year = item.TryGetProperty("editionYear", out var yearNode) ? yearNode.GetInt32() : (int?)null;
            var media = await RegisterFileAsync(local, $"PITF archive/{year}", year, ct);
            media.Alt ??= Text(item, "alt"); media.Caption ??= Text(item, "caption"); media.Credit ??= Text(item, "credit");
            if (!mediaBySourceId.TryGetValue(sourceId, out var matches)) mediaBySourceId[sourceId] = matches = [];
            if (matches.All(x => x.Id != media.Id)) matches.Add(media);
        }
        await db.SaveChangesAsync(ct); return count;
    }

    private async Task<int> ImportNewsManifestAsync(string file, CancellationToken ct)
    {
        var bytes = await File.ReadAllBytesAsync(file, ct); var fingerprint = Convert.ToHexString(SHA256.HashData(bytes));
        var sourceKey = Path.GetFullPath(file).ToLowerInvariant();
        var run = await db.ImportRuns.SingleOrDefaultAsync(x => x.SourceKey == sourceKey && x.Fingerprint == fingerprint, ct);
        if (run?.Status == "Completed") return 0;
        if (run is null) { run = new ImportRun { SourceKey = sourceKey, Fingerprint = fingerprint }; db.Add(run); }
        run.StartedAt = DateTimeOffset.UtcNow; run.Status = "Running"; run.CompletedAt = null;
        using var doc = JsonDocument.Parse(bytes); var count = 0;
        foreach (var item in doc.RootElement.EnumerateArray())
        {
            count++; var year = item.GetProperty("editionYear").GetInt32(); var number = item.GetProperty("editionId").GetInt32();
            var edition = await db.Editions.SingleAsync(x => x.Year == year || x.Number == number, ct); var slug = item.GetProperty("slug").GetString()!;
            var news = await db.News.SingleOrDefaultAsync(x => x.Slug == slug, ct);
            if (news is null) { news = new News { EditionId = edition.Id, Slug = slug }; db.Add(news); }
            news.Date = DateOnly.Parse(item.GetProperty("date").GetString()!); news.Category = Text(item, "suggestedType"); news.Status = ContentStatus.Published; news.PublishedAt ??= news.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var links = item.TryGetProperty("externalLinks", out var linksNode) && linksNode.ValueKind == JsonValueKind.Array ? linksNode.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToArray() : [];
            var hasBody = false;
            if (item.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Object)
                foreach (var lang in new[] { "sq", "en", "bs" }) if (content.TryGetProperty(lang, out var copy) && copy.ValueKind == JsonValueKind.Object)
                    foreach (var field in new[] { "title", "summary", "body" }) if (copy.TryGetProperty(field, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrEmpty(value.GetString())) { await UpsertTranslationAsync("News", news.Id, lang, field, value.GetString()!, ct); if (field == "body") hasBody = true; }
            if (!hasBody && links.Length > 0) { news.ContentMode = ContentMode.External; news.ExternalUrl = links[0]; } else news.ContentMode = ContentMode.Internal;
            await db.SaveChangesAsync(ct);
            for (var i = 0; i < links.Length; i++) if (!await db.ExternalLinks.AnyAsync(x => x.NewsId == news.Id && x.Url == links[i], ct)) db.Add(new ExternalLink { OwnerType = "News", OwnerId = news.Id, NewsId = news.Id, Url = links[i], Label = links[i], Order = i });
            if (item.TryGetProperty("mediaIds", out var ids) && ids.ValueKind == JsonValueKind.Array)
            {
                var linked = (await db.Set<NewsMedia>().Where(x => x.NewsId == news.Id).Select(x => x.MediaId).ToListAsync(ct)).ToHashSet();
                foreach (var pending in db.ChangeTracker.Entries<NewsMedia>().Where(x => x.Entity.NewsId == news.Id)) linked.Add(pending.Entity.MediaId);
                var order = linked.Count;
                foreach (var idNode in ids.EnumerateArray())
                    if (idNode.GetString() is { } id && mediaBySourceId.TryGetValue(id, out var matches))
                        foreach (var media in matches)
                            if (linked.Add(media.Id)) db.Add(new NewsMedia { NewsId = news.Id, MediaId = media.Id, Order = order++ });
            }
        }
        await db.SaveChangesAsync(ct); run.Status = "Completed"; run.CompletedAt = DateTimeOffset.UtcNow; run.SummaryJson = JsonSerializer.Serialize(new { count }); await db.SaveChangesAsync(ct); return count;
    }

    private async Task LoadExistingMediaAsync(CancellationToken ct) { foreach (var media in await db.Media.Include(x => x.Variants).ToListAsync(ct)) mediaByPath[media.Sha256] = media; }
    private async Task RepairJfifImagesAsync(CancellationToken ct)
    {
        var rows = await db.Media.Include(x => x.Variants).Where(x => x.OriginalFilename.EndsWith(".jfif")).ToListAsync(ct);
        foreach (var media in rows)
        {
            media.Type = MediaType.Image; media.MimeType = "image/jpeg";
            var path = storage.ResolvePath(media.StorageKey); var info = await Image.IdentifyAsync(path, ct); media.Width = info.Width; media.Height = info.Height;
            if (media.Variants.Count == 0) foreach (var v in await imageVariants.CreateAsync(path, storage, ct)) db.MediaVariants.Add(new MediaVariant { MediaId = media.Id, Name = v.Name, StorageKey = v.File.Key, Url = v.File.Url, FileSize = v.File.Size, Width = v.Width, Height = v.Height });
        }
        await db.SaveChangesAsync(ct);
    }
    private async Task LinkFrontendContentMediaAsync(CancellationToken ct)
    {
        async Task<Media?> Find(string name, int? year = null) => await db.Media.Where(x => x.OriginalFilename == name && (year == null || x.Year == year)).OrderByDescending(x => x.UploadedAt).FirstOrDefaultAsync(ct);
        async Task<Media?> FindSource(string relative)
        {
            var path = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "frontend", "public", "assets", relative));
            if (!File.Exists(path)) return null;
            await using var stream = File.OpenRead(path); var hash = Convert.ToHexString(await SHA256.HashDataAsync(stream, ct)).ToLowerInvariant();
            return await db.Media.SingleOrDefaultAsync(x => x.Sha256 == hash, ct);
        }
        foreach (var link in new[] { ("home", "hero", "hero-background.jpg"), ("home", "about", "theatre-image.png"), ("home", "latest-edition", "latest-edition-pic.jpg"), ("about", "intro", "theatre-image.png"), ("about", "mission", "about-pic.jpg"), ("editions", "hero", "editions-header.jpg") })
        {
            var section = await db.PageContents.SingleAsync(x => x.PageKey == link.Item1 && x.SectionKey == link.Item2, ct);
            section.MediaId = (await FindSource(link.Item3))?.Id;
        }
        var pageCollections = new[]
        {
            ("about", "team", "team", new[] { "staff/Ilir_Tafa_2.png", "staff/Zijad Mehic.jpg", "staff/Ilir_Bytyqi.jpg", "staff/Doruntina_Alshiqi.jpg", "staff/Amir_Petrovci.jpg", "staff/Erona_Salihu.jpg" }),
            ("about", "team", "gallery", new[] { "editions/2025/6/499824273_1655174822091585_2121453102605215817_n.jpg", "editions/2025/3/1. konferenca/499872265_1652001795742221_460727051915085863_n.jpg", "editions/2025/4/1. konferenca/499379864_1652864748989259_4650697660084778118_n.jpg", "editions/2025/4/1. shfaqja/499707188_1653553642253703_6796878248362077324_n.jpg", "editions/2026/1/1. konferenca/700333838_1957968458478885_6656895177128198862_n.jpg", "editions/2026/2/1. shfaqja/702671234_1959705558305175_3508399858379615757_n.jpg" })
        };
        foreach (var collection in pageCollections)
        {
            var section = await db.PageContents.SingleAsync(x => x.PageKey == collection.Item1 && x.SectionKey == collection.Item2, ct);
            for (var order = 0; order < collection.Item4.Length; order++)
            {
                var media = await FindSource(collection.Item4[order]); if (media is null) continue;
                if (!await db.PageContentMedia.AnyAsync(x => x.PageContentId == section.Id && x.MediaId == media.Id, ct)) db.PageContentMedia.Add(new PageContentMedia { PageContentId = section.Id, MediaId = media.Id, Role = collection.Item3, Order = order });
            }
        }
        var sponsorFiles = new Dictionary<string, string> { ["Kolegji AAB"] = "Kolegji-AAB.png", ["Art Image"] = "Art-Image.png", ["ATV"] = "ATV.png", ["Ministry of Culture, Youth and Sport"] = "MKRS.png", ["PRIInvest"] = "priinvest.png" };
        foreach (var pair in sponsorFiles) (await db.Sponsors.SingleAsync(x => x.Name == pair.Key, ct)).LogoMediaId = (await Find(pair.Value))?.Id;
        foreach (var edition in await db.Editions.ToListAsync(ct))
        {
            edition.HeroMediaId = (await Find(edition.Number == 1 ? "banner - 2017.jpg" : $"{edition.Number}-banner.jpg", edition.Year))?.Id;
            edition.BackgroundMediaId = (await Find(edition.Number == 1 ? "logo - 2017.jpg" : $"{edition.Number}.jpg", edition.Year))?.Id;
        }
        var program = await db.ProgramItems.Where(x => x.Edition.Year == 2026).OrderBy(x => x.Order).ToListAsync(ct);
        for (var i = 0; i < Math.Min(5, program.Count); i++) program[i].PosterMediaId = (await Find($"{i + 1}.jpg", 2026))?.Id;
        await db.SaveChangesAsync(ct);
    }
    private async Task<Media> RegisterFileAsync(string path, string folderPath, int? year, CancellationToken ct)
    {
        await using var hashStream = File.OpenRead(path); var hash = Convert.ToHexString(await SHA256.HashDataAsync(hashStream, ct)).ToLowerInvariant();
        if (mediaByPath.TryGetValue(hash, out var existing)) return existing;
        await using var source = File.OpenRead(path); var saved = await storage.SaveAsync(source, Path.GetFileName(path), ct); var ext = Path.GetExtension(path).ToLowerInvariant();
        var type = ext is ".jpg" or ".jpeg" or ".jfif" or ".png" or ".webp" or ".gif" ? MediaType.Image : ext is ".mp4" or ".mov" or ".webm" ? MediaType.Video : MediaType.Document;
        var media = new Media { OriginalFilename = Path.GetFileName(path), StoredFilename = Path.GetFileName(saved.Key), StorageKey = saved.Key, Url = saved.Url, MimeType = Mime(ext), FileSize = saved.Size, Sha256 = saved.Sha256, Type = type, Year = year, Folder = await EnsureFolderAsync(folderPath, year, ct) };
        if (type == MediaType.Image)
        {
            var info = await Image.IdentifyAsync(storage.ResolvePath(saved.Key), ct); media.Width = info.Width; media.Height = info.Height;
            foreach (var v in await imageVariants.CreateAsync(storage.ResolvePath(saved.Key), storage, ct)) media.Variants.Add(new MediaVariant { Name = v.Name, StorageKey = v.File.Key, Url = v.File.Url, FileSize = v.File.Size, Width = v.Width, Height = v.Height });
        }
        db.Media.Add(media); mediaByPath[hash] = media; return media;
    }

    private async Task<MediaFolder> EnsureFolderAsync(string path, int? year, CancellationToken ct)
    {
        var parts = path.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries); MediaFolder? parent = null; var key = "";
        foreach (var part in parts) { key += "/" + part; if (!folders.TryGetValue(key, out var folder)) { folder = await db.MediaFolders.SingleOrDefaultAsync(x => x.ParentId == (parent == null ? null : parent.Id) && x.Name == part, ct) ?? new MediaFolder { Name = part, Parent = parent, Year = int.TryParse(part, out var y) ? y : year }; if (folder.Id == Guid.Empty) folder.Id = Guid.NewGuid(); if (db.Entry(folder).State == EntityState.Detached) db.Add(folder); folders[key] = folder; } parent = folder; }
        return parent!;
    }

    private async Task<int> ImportTreeAsync(string root, string folderRoot, int? year, CancellationToken ct)
    {
        if (!Directory.Exists(root)) return 0; var count = 0;
        foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories).Where(IsMediaFile)) { var relative = Path.GetRelativePath(root, Path.GetDirectoryName(file)!); var detected = DetectYear(file) ?? year; await RegisterFileAsync(file, $"{folderRoot}/{relative}", detected, ct); count++; if (count % 50 == 0) await db.SaveChangesAsync(ct); }
        return count;
    }
    private Task<int> ImportUnregisteredTreeAsync(string root, string folderRoot, CancellationToken ct) => ImportTreeAsync(root, folderRoot, null, ct);
    private async Task UpsertTranslationAsync(string entityType, Guid entityId, string language, string field, string value, CancellationToken ct) { var row = await db.Translations.SingleOrDefaultAsync(x => x.EntityType == entityType && x.EntityId == entityId && x.LanguageCode == language && x.Field == field, ct); if (row is null) db.Add(new Translation { EntityType = entityType, EntityId = entityId, LanguageCode = language, Field = field, Value = value }); else row.Value = value; }
    private static string ResolveManifestMediaPath(string manifest, string src) { var relative = Uri.UnescapeDataString(src.Replace("/media/", "").Replace('/', Path.DirectorySeparatorChar)); return Path.Combine(Path.GetDirectoryName(manifest)!, relative); }
    private static bool IsMediaFile(string path) => new[] { ".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm" }.Contains(Path.GetExtension(path).ToLowerInvariant());
    private static int? DetectYear(string path) => path.Replace('\\', '/').Split('/').Select(x => int.TryParse(x, out var y) && y is >= 2017 and <= 2026 ? y : 0).FirstOrDefault(x => x != 0) is var y && y != 0 ? y : null;
    private static string? Text(JsonElement item, string property) => item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static string Mime(string ext) => ext switch { ".jpg" or ".jpeg" or ".jfif" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", ".gif" => "image/gif", ".mp4" => "video/mp4", ".mov" => "video/quicktime", ".webm" => "video/webm", _ => "application/octet-stream" };
    private static string Ordinal(int n) => n + (n % 100 is 11 or 12 or 13 ? "th" : (n % 10) switch { 1 => "st", 2 => "nd", 3 => "rd", _ => "th" });
    private static string Slugify(string value) => string.Join('-', value.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(x => new string(x.Where(char.IsLetterOrDigit).ToArray())).Where(x => x.Length > 0));
}

public sealed record ImportSummary(int NewsManifests, int MediaManifests, int SourceNewsRows, int SourceMediaReferences, int DatabaseNews, int DatabaseMedia, int MediaFolders, int NewsMediaLinks, int Translations, int PhysicalFilesVisited);

internal static class FrontendContent
{
    public static readonly (string Page, string Section, int Order, string Json)[] Sections =
    [
        ("home","hero",1,"{\"titleParts\":[\"Prishtina\",\"International\",\"Theatre Festival\"],\"description\":\"A meeting place for diverse voices, captivating performances, workshops and dialogue.\",\"ctaText\":\"Discover more\",\"ctaUrl\":\"/about\"}"),
        ("home","about",2,"{\"kicker\":\"About PITF\",\"title\":\"A stage for dialogue. A festival for everyone.\",\"paragraphs\":[\"The International Theater Festival ‘Prishtina International Theater Festival’ was established in the premises of AAB Theater ‘Faruk Begolli’ in June 2017. This theater operates within the AAB College in Pristina.\",\"The first edition of this festival was held with the motto: ‘Don’t ask what your country can do for you — ask what you can do for your country…’ We are aiming to make this festival a traditional and original event.\"]}"),
        ("home","latest-edition",3,"{\"title\":\"Edition of PITF\",\"text\":\"The Prishtina International Theatre Festival celebrates its 10th edition in 2026, honouring a decade of bold stories, fearless artists, and deep connections across borders.\"}"),
        ("global","newsletter",1,"{\"kicker\":\"Join the journey\",\"title\":\"Be Part of The Theatre\",\"text\":\"Stay updated with the latest news, programs and announcements.\"}"),
        ("about","intro",1,"{\"eyebrow\":\"About PITF\",\"title\":\"A Stage for Dialogue — A Festival for Everyone\",\"paragraphs\":[\"The Prishtina International Theatre Festival ‘Burbuqe Berisha’ (PITF) is Kosovo's leading theatre festival and one of the most important cultural events in the region.\",\"Since its establishment, PITF has been dedicated to promoting contemporary theatre, encouraging artistic freedom, and building connections between artists and audiences from around the world.\"]}"),
        ("about","statistics",2,"{\"items\":[{\"value\":10,\"label\":\"Editions\",\"text\":\"A decade of theatre and cultural exchange.\"},{\"value\":20,\"suffix\":\"+\",\"label\":\"Countries\",\"text\":\"Artists and companies from around the world.\"},{\"value\":50,\"suffix\":\"+\",\"label\":\"Performances\",\"text\":\"Across main stage, off programs and special events.\"},{\"value\":5000,\"suffix\":\"+\",\"label\":\"Audience members\",\"text\":\"Uniting audiences through the power of live performance.\"}]}"),
        ("about","mission",3,"{\"eyebrow\":\"Our mission\",\"title\":\"Theatre as a space for Change\",\"text\":\"We believe in theatre as a space for dialogue, reflection and change. PITF brings compelling stories to life, inspires new perspectives and creates a meeting point for cultures.\"}"),
        ("about","team",4,"{\"title\":\"Our team\",\"intro\":\"Behind every edition is a passionate team that works year-round to bring the best of contemporary theatre to Prishtina.\",\"people\":[{\"name\":\"Ilir Tafa\",\"role\":\"Founder of PITF\"},{\"name\":\"Zijad Mehic\",\"role\":\"Festival Director\"},{\"name\":\"Ilir Bytyqi\",\"role\":\"Art Image Director\"},{\"name\":\"Doruntina Alshiqi\",\"role\":\"Artistic Director of PITF\"},{\"name\":\"Amir Petrovci\",\"role\":\"AAB Theatre ‘Faruk Begolli’ Organizer\"},{\"name\":\"Erona Salihu\",\"role\":\"PR & Communication Director\"}]}"),
        ("editions","hero",1,"{\"kicker\":\"10 Editions\",\"title\":\"One Evolving Stage\",\"text\":\"From its first edition in 2017 to its tenth anniversary in 2026, PITF has brought together artists, audiences and stories from across borders.\"}"),
        ("news","hero",1,"{\"title\":\"News\",\"text\":\"Festival stories, announcements and highlights from every PITF edition.\"}"),
        ("contact","main",1,"{\"title\":\"Contact\",\"state\":\"placeholder\"}")
    ];
    public static readonly ProgramSeed[] Program = [new("The Kanun of the Farm","Kosovo","Urban Theater","Xheraldina Krasniqi",new DateTimeOffset(2026,5,18,20,0,0,TimeSpan.Zero),"National Theatre of Kosovo"),new("Gideon’s Knot","Bosnia and Herzegovina","JU Pozorište mladih Sarajevo / Scene MESS","Selma Alispahić",new DateTimeOffset(2026,5,19,20,0,0,TimeSpan.Zero),"National Theatre of Kosovo"),new("Chicken","North Macedonia","Vortex Theater / Skopje Comedy Theater","Teodora Siljanoska",new DateTimeOffset(2026,5,20,20,0,0,TimeSpan.Zero),"National Theatre of Kosovo"),new("The Fortress","Italy","AteliercuncheON researchtheatre","Andrea Benaglio",new DateTimeOffset(2026,5,21,20,0,0,TimeSpan.Zero),"National Theatre of Kosovo"),new("Buongiorno","Montenegro","Teuta Theater","Edina Mustafiq Avdiu",new DateTimeOffset(2026,5,22,18,0,0,TimeSpan.Zero),"National Theatre of Kosovo"),new("Guest Play","Kosovo","‘Faruk Begolli’ Theatre, AAB College",null,new DateTimeOffset(2026,5,23,20,0,0,TimeSpan.Zero),"National Theatre of Kosovo")];
    public static readonly string[] Sponsors = ["Kolegji AAB","Art Image","ATV","Ministry of Culture, Youth and Sport","PRIInvest"];
}
internal sealed record ProgramSeed(string Title,string Country,string Company,string? Director,DateTimeOffset StartsAt,string Venue);
