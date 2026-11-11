using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.DTOs;
using PITF.Api.Models;

namespace PITF.Api.Services;

public sealed class PublicContentService(ApplicationDbContext db)
{
    private static readonly string[] Languages = ["sq", "en", "bs"];
    private static bool IsPublic(PublishableEntity x) => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow);

    private async Task<Dictionary<Guid, Dictionary<string, Dictionary<string, string>>>> TranslationsAsync(string type, IEnumerable<Guid> ids, CancellationToken ct)
    {
        var set = ids.Distinct().ToArray();
        if (set.Length == 0) return [];
        var rows = await db.Translations.AsNoTracking().Where(x => x.EntityType == type && set.Contains(x.EntityId) && Languages.Contains(x.LanguageCode)).ToListAsync(ct);
        return rows.GroupBy(x => x.EntityId).ToDictionary(g => g.Key, g => g.GroupBy(x => x.LanguageCode)
            .ToDictionary(l => l.Key, l => l.ToDictionary(x => x.Field, x => x.Value)));
    }

    private static Dictionary<string, Dictionary<string, string>> T(Dictionary<Guid, Dictionary<string, Dictionary<string, string>>> all, Guid id)
        => all.TryGetValue(id, out var value) ? value : [];

    private async Task<Dictionary<Guid, Dictionary<string, Dictionary<string, string>>>> PlayTranslationsAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var set = ids.Distinct().ToArray();
        if (set.Length == 0) return [];
        var rows = await db.PlayTranslations.AsNoTracking().Where(x => set.Contains(x.PlayId) && Languages.Contains(x.LanguageCode)).ToListAsync(ct);
        return rows.GroupBy(x => x.PlayId).ToDictionary(g => g.Key, g => g.ToDictionary(x => x.LanguageCode, x => new Dictionary<string, string>
        {
            ["title"] = x.Title ?? "", ["country"] = x.Country ?? "", ["company"] = x.Company ?? "",
            ["description"] = x.Description ?? "", ["synopsis"] = x.Synopsis ?? ""
        }.Where(f => !string.IsNullOrWhiteSpace(f.Value)).ToDictionary()));
    }

    private static JsonElement Json(string value)
    {
        try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(value) ? "{}" : value).RootElement.Clone(); }
        catch (JsonException) { return JsonDocument.Parse("{}").RootElement.Clone(); }
    }

    public static MediaDto? MapMedia(Media? media, IReadOnlyList<string>? relationships = null)
    {
        if (media is null) return null;
        var variants = media.Variants.OrderBy(x => x.Width).Select(x => new MediaVariantDto(x.Name, x.Url, x.Width, x.Height, x.FileSize, x.MimeType)).ToList();
        string? Variant(string name) => variants.FirstOrDefault(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Url;
        return new MediaDto(media.Id, media.Type.ToString().ToLowerInvariant(), media.Url, Variant("thumbnail"), Variant("medium"),
            Variant("large"), media.PosterUrl, media.Alt, media.Caption, media.Credit, media.Width, media.Height,
            media.DurationSeconds, media.FileSize, media.MimeType,
            media.Folder is null ? null : new MediaFolderDto(media.Folder.Id, media.Folder.Name, media.Folder.Year, media.Folder.ParentId),
            variants, relationships ?? [], media.OriginalFilename, media.UploadedAt, media.Year, media.EditionId,
            media.Category, media.Tags, media.FestivalDayId, media.ProgramItemId);
    }

    private static (MediaDto? Cover, string? Url, string? Source) ResolveCover(News news, IReadOnlyDictionary<Guid, Media>? selectedCovers = null)
    {
        Media? manual = null;
        if (news.CoverMediaId.HasValue) {
            selectedCovers?.TryGetValue(news.CoverMediaId.Value, out manual);
            manual ??= news.Media.Select(x => x.Media).FirstOrDefault(x => x.Id == news.CoverMediaId);
        }
        if (manual is not null) { var dto = MapMedia(manual); return (dto, dto?.MediumUrl ?? dto?.ThumbnailUrl ?? dto?.OriginalUrl, "manual-cover"); }
        var image = news.Media.OrderBy(x => x.Order).Select(x => x.Media).FirstOrDefault(x => x.Type == MediaType.Image);
        if (image is not null) { var dto = MapMedia(image); return (dto, dto?.MediumUrl ?? dto?.ThumbnailUrl ?? dto?.OriginalUrl, "attached-image"); }
        var video = news.Media.OrderBy(x => x.Order).Select(x => x.Media).FirstOrDefault(x => x.Type == MediaType.Video);
        if (video is not null) return (MapMedia(video), string.IsNullOrWhiteSpace(video.PosterUrl) ? null : video.PosterUrl, string.IsNullOrWhiteSpace(video.PosterUrl) ? "attached-video" : "video-poster");
        var youtube = YouTubeThumbnail(news.ExternalUrl);
        return youtube is null ? (null, null, null) : (null, youtube, "youtube");
    }

    private static string? YouTubeThumbnail(string? raw)
    {
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri)) return null;
        var host = uri.Host.ToLowerInvariant();
        string? id = null;
        if (host is "youtu.be" or "www.youtu.be") id = uri.AbsolutePath.Trim('/').Split('/').FirstOrDefault();
        else if (host.EndsWith("youtube.com", StringComparison.Ordinal))
        {
            if (uri.AbsolutePath.Equals("/watch", StringComparison.OrdinalIgnoreCase))
                id = uri.Query.TrimStart('?').Split('&').Select(x => x.Split('=', 2)).FirstOrDefault(x => x.Length == 2 && x[0] == "v")?.ElementAtOrDefault(1);
            else if (uri.AbsolutePath.StartsWith("/shorts/") || uri.AbsolutePath.StartsWith("/embed/") || uri.AbsolutePath.StartsWith("/live/")) id = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(1);
        }
        return string.IsNullOrWhiteSpace(id) ? null : $"https://i.ytimg.com/vi/{Uri.UnescapeDataString(id)}/hqdefault.jpg";
    }

    private async Task<List<Media>> MediaByIdsAsync(IEnumerable<Guid?> ids, CancellationToken ct)
    {
        var set = ids.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToArray();
        return set.Length == 0 ? [] : await db.Media.AsNoTracking().Include(x => x.Variants).Include(x => x.Folder).Where(x => set.Contains(x.Id)).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<EditionSummaryDto>> EditionsAsync(CancellationToken ct)
    {
        var editions = await db.Editions.AsNoTracking().Where(x => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow)).OrderBy(x => x.Order).ThenBy(x => x.Number).ToListAsync(ct);
        var tr = await TranslationsAsync(nameof(Edition), editions.Select(x => x.Id), ct);
        var media = (await MediaByIdsAsync(editions.SelectMany(x => new Guid?[] { x.HeroMediaId, x.DetailHeaderMediaId, x.BackgroundMediaId }), ct)).ToDictionary(x => x.Id);
        return editions.Select(x => new EditionSummaryDto(x.Id, x.Number, x.Year, x.StartDate, x.EndDate, x.Slug, x.PrimaryColor, x.SecondaryColor, x.Order, T(tr, x.Id),
            x.HeroMediaId.HasValue && media.TryGetValue(x.HeroMediaId.Value, out var hero) ? MapMedia(hero) : null,
            x.DetailHeaderMediaId.HasValue && media.TryGetValue(x.DetailHeaderMediaId.Value, out var detailHeader) ? MapMedia(detailHeader) : null,
            x.BackgroundMediaId.HasValue && media.TryGetValue(x.BackgroundMediaId.Value, out var bg) ? MapMedia(bg) : null)).ToList();
    }

    private async Task<IReadOnlyList<ProgramDto>> ProgramAsync(IQueryable<ProgramItem> query, CancellationToken ct)
    {
        var rows = await query.AsNoTracking().Include(x => x.Credits).Where(x => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow)).OrderBy(x => x.Order).ToListAsync(ct);
        var tr = await PlayTranslationsAsync(rows.Select(x => x.Id), ct);
        var media = (await MediaByIdsAsync(rows.SelectMany(x => new Guid?[] { x.PosterMediaId, x.TrailerMediaId }), ct)).ToDictionary(x => x.Id);
        return rows.Select(x => new ProgramDto(x.Id, x.Slug, x.ParticipationType, x.Country, x.Company, x.Director, JsonSerializer.Serialize(x.Credits.OrderBy(c => c.Order).Select(c => new { role = c.Role, name = c.Name })), x.StartsAt, x.Venue,
            x.Status.ToString(), x.PublishedAt, x.Order, T(tr, x.Id),
            x.PosterMediaId.HasValue && media.TryGetValue(x.PosterMediaId.Value, out var poster) ? MapMedia(poster) : null,
            x.TrailerMediaId.HasValue && media.TryGetValue(x.TrailerMediaId.Value, out var trailer) ? MapMedia(trailer) : null)).ToList();
    }

    private async Task<List<News>> NewsRowsAsync(IQueryable<News> query, CancellationToken ct) => await query.AsNoTracking().AsSplitQuery()
        .Include(x => x.Media).ThenInclude(x => x.Media).ThenInclude(x => x.Variants)
        .Include(x => x.Media).ThenInclude(x => x.Media).ThenInclude(x => x.Folder)
        .Where(x => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow)).ToListAsync(ct);

    private async Task<IReadOnlyList<NewsCardDto>> CardsAsync(List<News> rows, CancellationToken ct)
    {
        var tr = await TranslationsAsync(nameof(News), rows.Select(x => x.Id), ct);
        var selectedCovers = (await MediaByIdsAsync(rows.Select(x => x.CoverMediaId), ct)).ToDictionary(x => x.Id);
        return rows.Select(x => { var cover = ResolveCover(x, selectedCovers); return new NewsCardDto(x.Id, x.EditionId, x.Slug, x.Date, x.Category,
            x.ContentMode.ToString().ToLowerInvariant(), x.ExternalUrl, x.ExternalTarget, x.ContentMode == ContentMode.External,
            T(tr, x.Id), cover.Cover, cover.Url, cover.Source); }).ToList();
    }

    public async Task<PagedResultDto<NewsCardDto>> NewsAsync(Guid? editionId, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.News.Where(x => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow));
        if (editionId.HasValue) query = query.Where(x => x.EditionId == editionId);
        var total = await query.CountAsync(ct);
        var rows = await NewsRowsAsync(query.OrderByDescending(x => x.Date).ThenByDescending(x => x.PublishedAt).Skip((page - 1) * pageSize).Take(pageSize), ct);
        return new(page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize), await CardsAsync(rows, ct));
    }

    public async Task<NewsDetailDto?> NewsDetailAsync(string slug, CancellationToken ct)
    {
        var translatedId = await db.Translations.AsNoTracking()
            .Where(x => x.EntityType == nameof(News) && x.Field == "slug" && x.Value == slug)
            .Select(x => (Guid?)x.EntityId).FirstOrDefaultAsync(ct);
        var rows = await NewsRowsAsync(db.News.Where(x => x.Slug == slug || (translatedId.HasValue && x.Id == translatedId.Value)), ct); var row = rows.SingleOrDefault(); if (row is null) return null;
        var card = (await CardsAsync(rows, ct)).Single();
        var links = await db.ExternalLinks.AsNoTracking().Where(x => x.NewsId == row.Id).OrderBy(x => x.Order).Select(x => new LinkDto(x.Label, x.Url, x.Target)).ToListAsync(ct);
        return new NewsDetailDto(card, row.FestivalDayId, row.ActivityId, row.ProgramItemId, row.Status.ToString(), row.PublishedAt, row.Order,
            row.Media.OrderBy(x => x.Order).Select(x => MapMedia(x.Media)!).ToList(), links);
    }

    public async Task<EditionDetailDto?> EditionAsync(string slug, CancellationToken ct)
    {
        var edition = await db.Editions.AsNoTracking().SingleOrDefaultAsync(x => x.Slug == slug && x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow), ct);
        if (edition is null) return null;
        var summary = (await EditionsAsync(ct)).Single(x => x.Id == edition.Id);
        var recap = (await MediaByIdsAsync([edition.RecapMediaId], ct)).SingleOrDefault();
        var days = await db.FestivalDays.AsNoTracking().Where(x => x.EditionId == edition.Id).OrderBy(x => x.Order).ThenBy(x => x.DayNumber).ToListAsync(ct);
        var activities = await db.FestivalActivities.AsNoTracking().Where(x => days.Select(d => d.Id).Contains(x.FestivalDayId)).OrderBy(x => x.Order).ToListAsync(ct);
        var dayTr = await TranslationsAsync(nameof(FestivalDay), days.Select(x => x.Id), ct); var activityTr = await TranslationsAsync(nameof(FestivalActivity), activities.Select(x => x.Id), ct);
        static IReadOnlyList<Guid> DayMediaIds(string json) { try { return JsonSerializer.Deserialize<List<Guid>>(json) ?? []; } catch (JsonException) { return []; } }
        var dayIds = days.Select(d => d.Id).ToArray();
        var classifiedMemories = await db.Media.AsNoTracking()
            .Where(m => m.Type == MediaType.Image && m.Category == "after-party" && m.FestivalDayId.HasValue && dayIds.Contains(m.FestivalDayId.Value))
            .OrderBy(m => m.UploadedAt).ThenBy(m => m.OriginalFilename)
            .Select(m => new { DayId = m.FestivalDayId!.Value, m.Id })
            .ToListAsync(ct);
        IReadOnlyList<Guid> MemoriesFor(FestivalDay day) => DayMediaIds(day.MemoriesMediaIdsJson)
            .Concat(classifiedMemories.Where(m => m.DayId == day.Id).Select(m => m.Id)).Distinct().ToList();
        var dayMediaIds = days.SelectMany(d => DayMediaIds(d.ConferenceMediaIdsJson).Concat(DayMediaIds(d.PlayMediaIdsJson)).Concat(MemoriesFor(d)).Select(id => (Guid?)id).Append(d.HeaderMediaId).Append(d.RecapMediaId));
        var dayMedia = (await MediaByIdsAsync(dayMediaIds, ct)).ToDictionary(x => x.Id);
        List<MediaDto> DayMedia(string json) => DayMediaIds(json).Where(dayMedia.ContainsKey).Select(id => MapMedia(dayMedia[id])!).ToList();
        var dayDtos = days.Select(d => new FestivalDayDto(d.Id, d.Date, d.DayNumber, d.Order, d.IsPageEnabled,
            d.IsHeaderVisible, d.IsConferenceVisible, d.IsPlayVisible, d.IsRecapVisible, d.IsMemoriesVisible || MemoriesFor(d).Count > 0,
            d.RecapYoutubeUrl,
            T(dayTr, d.Id), activities.Where(a => a.FestivalDayId == d.Id)
            .Select(a => new ActivityDto(a.Id, a.Type, a.StartTime, a.EndTime, a.Venue, a.Order, a.ProgramItemId, T(activityTr, a.Id))).ToList(),
            d.HeaderMediaId.HasValue && dayMedia.TryGetValue(d.HeaderMediaId.Value, out var header) ? MapMedia(header) : null,
            d.RecapMediaId.HasValue && dayMedia.TryGetValue(d.RecapMediaId.Value, out var dayRecap) ? MapMedia(dayRecap) : null,
            DayMedia(d.ConferenceMediaIdsJson), DayMedia(d.PlayMediaIdsJson), MemoriesFor(d).Where(dayMedia.ContainsKey).Select(id => MapMedia(dayMedia[id])!).ToList())).ToList();
        var program = await ProgramAsync(db.ProgramItems.Where(x => x.EditionId == edition.Id), ct);
        var newsRows = await NewsRowsAsync(db.News.Where(x => x.EditionId == edition.Id).OrderByDescending(x => x.Date).ThenBy(x => x.Order).Take(3), ct); var news = await CardsAsync(newsRows, ct);
        var galleries = await GalleriesAsync(edition.Id, ct); var sponsors = await SponsorsAsync(edition.Id, ct); var awards = await AwardsAsync(edition.Id, ct);
        var editionTr = await TranslationsAsync(nameof(Edition), [edition.Id], ct);
        var recapTr = T(editionTr, edition.Id).ToDictionary(x => x.Key, x => x.Value.Where(f => f.Key.StartsWith("recap", StringComparison.OrdinalIgnoreCase)).ToDictionary());
        return new(summary, MapMedia(recap), recapTr, dayDtos, program, news, galleries, sponsors, awards);
    }

    private async Task<IReadOnlyList<GalleryDto>> GalleriesAsync(Guid editionId, CancellationToken ct)
    {
        var rows = await db.Galleries.AsNoTracking().Include(x => x.Media).ThenInclude(x => x.Media).ThenInclude(x => x.Variants).Include(x => x.Media).ThenInclude(x => x.Media).ThenInclude(x => x.Folder)
            .Where(x => x.EditionId == editionId && x.Status == ContentStatus.Published).OrderBy(x => x.Order).ToListAsync(ct);
        var tr = await TranslationsAsync(nameof(Gallery), rows.Select(x => x.Id), ct); var covers = (await MediaByIdsAsync(rows.Select(x => x.CoverMediaId), ct)).ToDictionary(x => x.Id);
        return rows.Select(x => new GalleryDto(x.Id, x.EditionId, x.FestivalDayId, x.ActivityId, x.ProgramItemId, x.Status.ToString(), x.Order, T(tr, x.Id),
            x.CoverMediaId.HasValue && covers.TryGetValue(x.CoverMediaId.Value, out var cover) ? MapMedia(cover) : null,
            x.Media.OrderBy(m => m.Order).Select(m => MapMedia(m.Media)!).ToList())).ToList();
    }

    private async Task<IReadOnlyList<SponsorDto>> SponsorsAsync(Guid editionId, CancellationToken ct)
    {
        var rows = await db.Sponsors.AsNoTracking().Include(x => x.Editions).Where(x => x.Status == ContentStatus.Published && x.Editions.Any(e => e.EditionId == editionId)).ToListAsync(ct);
        var logos = (await MediaByIdsAsync(rows.Select(x => x.LogoMediaId), ct)).ToDictionary(x => x.Id);
        return rows.OrderBy(x => x.Editions.Single(e => e.EditionId == editionId).Order).Select(x => new SponsorDto(x.Id, x.Name, x.Url, x.Category, x.Order,
            x.LogoMediaId.HasValue && logos.TryGetValue(x.LogoMediaId.Value, out var logo) ? MapMedia(logo) : null)).ToList();
    }

    private async Task<IReadOnlyList<SponsorDto>> HomepageSponsorsAsync(CancellationToken ct)
    {
        var rows = await db.Sponsors.AsNoTracking().Where(x => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow)).OrderBy(x => x.Order).ToListAsync(ct);
        var logos = (await MediaByIdsAsync(rows.Select(x => x.LogoMediaId), ct)).ToDictionary(x => x.Id);
        return rows.Select(x => new SponsorDto(x.Id, x.Name, x.Url, x.Category, x.Order,
            x.LogoMediaId.HasValue && logos.TryGetValue(x.LogoMediaId.Value, out var logo) ? MapMedia(logo) : null)).ToList();
    }

    private async Task<IReadOnlyList<AwardDto>> AwardsAsync(Guid editionId, CancellationToken ct)
    {
        var rows = await db.Awards.AsNoTracking().Where(x => x.EditionId == editionId && x.Status == ContentStatus.Published).OrderBy(x => x.Order).ToListAsync(ct);
        var tr = await TranslationsAsync(nameof(Award), rows.Select(x => x.Id), ct); var media = (await MediaByIdsAsync(rows.Select(x => x.MediaId), ct)).ToDictionary(x => x.Id);
        var playIds = rows.Where(x => x.ProgramItemId.HasValue).Select(x => x.ProgramItemId!.Value).Distinct().ToArray();
        var plays = await db.ProgramItems.AsNoTracking().Include(x => x.Translations).Where(x => playIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        string Recipient(Award award) { if (!string.IsNullOrWhiteSpace(award.Person)) return award.Person; if (!string.IsNullOrWhiteSpace(award.Recipient)) return award.Recipient; if (!award.ProgramItemId.HasValue || !plays.TryGetValue(award.ProgramItemId.Value, out var play)) return ""; return play.Translations.FirstOrDefault(x => x.LanguageCode == "en")?.Title ?? play.Translations.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Title))?.Title ?? play.Slug; }
        return rows.Select(x => new AwardDto(x.Id, x.AwardType, Recipient(x), x.Person, x.Country, x.ProgramItemId, x.Order, T(tr, x.Id),
            x.MediaId.HasValue && media.TryGetValue(x.MediaId.Value, out var m) ? MapMedia(m) : null)).ToList();
    }

    public async Task<IReadOnlyList<PageContentDto>> PagesAsync(string? pageKey, CancellationToken ct)
    {
        var rows = await db.PageContents.AsNoTracking().Include(x => x.MediaItems).ThenInclude(x => x.Media).ThenInclude(x => x.Variants).Include(x => x.MediaItems).ThenInclude(x => x.Media).ThenInclude(x => x.Folder).Where(x => x.Status == ContentStatus.Published && (pageKey == null || x.PageKey == pageKey)).OrderBy(x => x.Order).ToListAsync(ct);
        var tr = await TranslationsAsync(nameof(PageContent), rows.Select(x => x.Id), ct); var media = (await MediaByIdsAsync(rows.Select(x => x.MediaId), ct)).ToDictionary(x => x.Id);
        return rows.Select(x => new PageContentDto(x.Id, x.PageKey, x.SectionKey, x.Order, Json(x.ContentJson),
            x.MediaId.HasValue && media.TryGetValue(x.MediaId.Value, out var m) ? MapMedia(m) : null,
            x.MediaItems.OrderBy(i => i.Order).Select(i => new ContentMediaDto(i.Role, i.Order, MapMedia(i.Media)!)).ToList(), T(tr, x.Id))).ToList();
    }

    public async Task<object> SiteAsync(CancellationToken ct)
    {
        var settings = await db.SiteSettings.AsNoTracking().Where(x => !x.IsCritical).OrderBy(x => x.Group).ThenBy(x => x.Key).Select(x => new { x.Key, x.Value, x.ValueType, x.Group }).ToListAsync(ct);
        return new { settings, navigation = await NavigationAsync(ct), pages = await PagesAsync(null, ct) };
    }

    public async Task<IReadOnlyList<NavigationDto>> NavigationAsync(CancellationToken ct)
    {
        var rows = await db.NavigationItems.AsNoTracking().Where(x => x.Status == ContentStatus.Published).OrderBy(x => x.Order).ToListAsync(ct);
        var tr = await TranslationsAsync(nameof(NavigationItem), rows.Select(x => x.Id), ct);
        return rows.Select(x => new NavigationDto(x.Id, x.Key, x.Url, x.Target, x.ParentId, x.Order, T(tr, x.Id))).ToList();
    }

    public async Task<MediaDto?> MediaAsync(Guid id, CancellationToken ct)
    {
        var media = await db.Media.AsNoTracking().Include(x => x.Variants).Include(x => x.Folder).SingleOrDefaultAsync(x => x.Id == id, ct); if (media is null) return null;
        var relationships = new List<string>();
        relationships.AddRange(await db.Set<NewsMedia>().Where(x => x.MediaId == id).Select(x => "news:" + x.NewsId).ToListAsync(ct));
        relationships.AddRange(await db.Set<GalleryMedia>().Where(x => x.MediaId == id).Select(x => "gallery:" + x.GalleryId).ToListAsync(ct));
        relationships.AddRange(await db.PageContents.Where(x => x.MediaId == id).Select(x => "page:" + x.Id).ToListAsync(ct));
        relationships.AddRange(await db.PageContentMedia.Where(x => x.MediaId == id).Select(x => "page:" + x.PageContentId).ToListAsync(ct));
        return MapMedia(media, relationships);
    }

    public async Task<PagedResultDto<MediaDto>> MediaListAsync(int page, int pageSize, string? type, CancellationToken ct)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Media.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<MediaType>(type, true, out var parsed)) query = query.Where(x => x.Type == parsed);
        var total = await query.CountAsync(ct);
        var rows = await query.Include(x => x.Variants).Include(x => x.Folder).OrderByDescending(x => x.UploadedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new(page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize), rows.Select(x => MapMedia(x)!).ToList());
    }

    public async Task<HomepageDto> HomepageAsync(CancellationToken ct)
    {
        var sections = await db.HomepageSections.AsNoTracking().Include(x => x.Selections).Where(x => x.Status == ContentStatus.Published).OrderBy(x => x.Order).ToListAsync(ct);
        var sectionDtos = sections.Select(x => new HomepageSectionDto(x.Id, x.Key, x.IsVisible, x.Order, x.SelectionMode, x.SelectedEditionId, x.ItemLimit, Json(x.ConfigurationJson))).ToList();
        var featuredSection = sections.FirstOrDefault(x => x.Key == "featured-edition");
        Guid? editionId = featuredSection?.SelectionMode == "manual" ? featuredSection.SelectedEditionId : await db.Editions.Where(x => x.Status == ContentStatus.Published && (!x.PublishedAt.HasValue || x.PublishedAt <= DateTimeOffset.UtcNow)).OrderByDescending(x => x.Year).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        var editions = await EditionsAsync(ct);
        var edition = editionId.HasValue ? editions.FirstOrDefault(x => x.Id == editionId.Value) : null;
        var featuredEdition = edition is null ? null : new FeaturedEditionDto(edition);
        var programSection = sections.FirstOrDefault(x => x.Key == "featured-program");
        var programIds = programSection?.Selections.Where(x => x.EntityType == nameof(ProgramItem)).OrderBy(x => x.Order).Select(x => x.EntityId).ToArray() ?? [];
        IReadOnlyList<ProgramDto> program = [];
        if (editionId.HasValue)
        {
            var selectedProgramIds = programIds.Length == 0
                ? []
                : await db.ProgramItems.AsNoTracking()
                    .Where(x => x.EditionId == editionId.Value && programIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToArrayAsync(ct);
            program = selectedProgramIds.Length > 0
                ? (await ProgramAsync(db.ProgramItems.Where(x => selectedProgramIds.Contains(x.Id)), ct)).OrderBy(x => Array.IndexOf(programIds, x.Id)).ToList()
                : await ProgramAsync(db.ProgramItems.Where(x => x.EditionId == editionId.Value), ct);
        }
        var newsSection = sections.FirstOrDefault(x => x.Key == "featured-news"); var newsIds = newsSection?.Selections.Where(x => x.EntityType == nameof(News)).OrderBy(x => x.Order).Select(x => x.EntityId).ToArray() ?? [];
        IReadOnlyList<NewsCardDto> news = [];
        if (newsSection?.IsVisible == true) { var rows = newsIds.Length > 0 ? await NewsRowsAsync(db.News.Where(x => newsIds.Contains(x.Id)), ct) : await NewsRowsAsync(db.News.OrderByDescending(x => x.Date).Take(newsSection.ItemLimit ?? 3), ct); news = (await CardsAsync(rows, ct)).OrderBy(x => newsIds.Length == 0 ? 0 : Array.IndexOf(newsIds, x.Id)).ToList(); }
        var homePages = await PagesAsync("home", ct);
        return new(sectionDtos, homePages.Where(x => x.SectionKey == "hero").ToList(), homePages.Where(x => x.SectionKey == "about").ToList(),
            featuredEdition, program, news, editions, await HomepageSponsorsAsync(ct),
            (await PagesAsync("global", ct)).Where(x => x.SectionKey.Contains("newsletter", StringComparison.OrdinalIgnoreCase) || x.SectionKey.Contains("cta", StringComparison.OrdinalIgnoreCase)).ToList());
    }
}
