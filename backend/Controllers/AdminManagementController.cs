using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Models;
using PITF.Api.Services;

namespace PITF.Api.Controllers;

[ApiController, Route("api/admin/manage"), Authorize(Policy = "ContentWrite")]
public sealed class AdminManagementController(ApplicationDbContext db) : ControllerBase
{
    private static readonly string[] TranslationLanguages = ["sq", "en", "bs"];

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct) => Ok(new
    {
        editions = await db.Editions.CountAsync(ct), news = await db.News.CountAsync(ct), media = await db.Media.CountAsync(ct),
        program = await db.ProgramItems.CountAsync(ct), days = await db.FestivalDays.CountAsync(ct), activities = await db.FestivalActivities.CountAsync(ct),
        galleries = await db.Galleries.CountAsync(ct), sponsors = await db.Sponsors.CountAsync(ct), awards = await db.Awards.CountAsync(ct),
        drafts = await db.News.CountAsync(x => x.Status == ContentStatus.Draft, ct) + await db.ProgramItems.CountAsync(x => x.Status == ContentStatus.Draft, ct),
        recentNews = await db.News.AsNoTracking().OrderByDescending(x => x.Date).Take(6).Select(x => new { x.Id, x.Slug, x.Date, status = x.Status.ToString() }).ToListAsync(ct)
    });

    [HttpGet("{resource}")]
    public async Task<IActionResult> List(string resource, CancellationToken ct)
    {
        resource = resource.ToLowerInvariant();
        return resource switch
        {
            "editions" => Ok(await Editions(ct)), "days" => Ok(await Days(ct)), "activities" => Ok(await Activities(ct)),
            "program" => Ok(await Program(ct)), "news" => Ok(await News(ct)), "galleries" => Ok(await Galleries(ct)),
            "sponsors" => Ok(await Sponsors(ct)), "awards" => Ok(await Awards(ct)), "pages" => Ok(await Pages(ct)),
            "navigation" => Ok(await Navigation(ct)), "settings" => Ok(await Settings(ct)), "languages" => Ok(await Languages(ct)),
            "homepage" => Ok(await Homepage(ct)), _ => NotFound(new { message = $"Unknown admin resource '{resource}'." })
        };
    }

    [HttpPost("{resource}")]
    public Task<IActionResult> Create(string resource, AdminSaveRequest request, CancellationToken ct) => Save(resource, null, request, ct);

    [HttpPut("{resource}/{id:guid}")]
    public Task<IActionResult> Update(string resource, Guid id, AdminSaveRequest request, CancellationToken ct) => Save(resource, id, request, ct);

    [HttpDelete("{resource}/{id:guid}")]
    public async Task<IActionResult> Delete(string resource, Guid id, CancellationToken ct)
    {
        try
        {
            resource = resource.ToLowerInvariant();
            if (resource == "languages" && !IsAdministrator()) return Forbid();
            if (resource == "settings" && !IsAdministrator())
            {
                var setting = await db.SiteSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
                if (setting?.IsCritical == true) return Forbid();
            }
            switch (resource)
            {
                case "editions": await StageEditionDeletion(id, ct); break;
                case "days": db.Remove(await db.FestivalDays.FindAsync([id], ct) ?? throw new Missing()); break;
                case "activities": db.Remove(await db.FestivalActivities.FindAsync([id], ct) ?? throw new Missing()); break;
                case "program": db.Remove(await db.ProgramItems.FindAsync([id], ct) ?? throw new Missing()); break;
                case "news":
                    var news = await db.News.FindAsync([id], ct) ?? throw new Missing();
                    db.Set<NewsMedia>().RemoveRange(db.Set<NewsMedia>().Where(x => x.NewsId == id)); db.ExternalLinks.RemoveRange(db.ExternalLinks.Where(x => x.NewsId == id)); db.Remove(news); break;
                case "galleries": db.Remove(await db.Galleries.FindAsync([id], ct) ?? throw new Missing()); break;
                case "sponsors": db.Remove(await db.Sponsors.FindAsync([id], ct) ?? throw new Missing()); break;
                case "awards": db.Remove(await db.Awards.FindAsync([id], ct) ?? throw new Missing()); break;
                case "pages": db.Remove(await db.PageContents.FindAsync([id], ct) ?? throw new Missing()); break;
                case "navigation": db.Remove(await db.NavigationItems.FindAsync([id], ct) ?? throw new Missing()); break;
                case "settings": db.Remove(await db.SiteSettings.FindAsync([id], ct) ?? throw new Missing()); break;
                case "languages": db.Remove(await db.Languages.FindAsync([id], ct) ?? throw new Missing()); break;
                case "homepage": db.Remove(await db.HomepageSections.FindAsync([id], ct) ?? throw new Missing()); break;
                default: return NotFound(new { message = "Unknown resource." });
            }
            if (resource != "editions") db.Translations.RemoveRange(db.Translations.Where(x => x.EntityId == id));
            await db.SaveChangesAsync(ct); return NoContent();
        }
        catch (Missing) { return NotFound(); }
        catch (DbUpdateException) { return Conflict(new { message = "This item is still referenced by other content and cannot be deleted." }); }
    }

    private async Task StageEditionDeletion(Guid editionId, CancellationToken ct)
    {
        var edition = await db.Editions.FindAsync([editionId], ct) ?? throw new Missing();
        var dayIds = await db.FestivalDays.Where(x => x.EditionId == editionId).Select(x => x.Id).ToArrayAsync(ct);
        var activityIds = await db.FestivalActivities.Where(x => dayIds.Contains(x.FestivalDayId)).Select(x => x.Id).ToArrayAsync(ct);
        var programIds = await db.ProgramItems.Where(x => x.EditionId == editionId).Select(x => x.Id).ToArrayAsync(ct);
        var newsIds = await db.News.Where(x => x.EditionId == editionId ||
            (x.FestivalDayId.HasValue && dayIds.Contains(x.FestivalDayId.Value)) ||
            (x.ActivityId.HasValue && activityIds.Contains(x.ActivityId.Value)) ||
            (x.ProgramItemId.HasValue && programIds.Contains(x.ProgramItemId.Value)))
            .Select(x => x.Id).ToArrayAsync(ct);
        var galleryIds = await db.Galleries.Where(x => x.EditionId == editionId ||
            (x.FestivalDayId.HasValue && dayIds.Contains(x.FestivalDayId.Value)) ||
            (x.ActivityId.HasValue && activityIds.Contains(x.ActivityId.Value)) ||
            (x.ProgramItemId.HasValue && programIds.Contains(x.ProgramItemId.Value)))
            .Select(x => x.Id).ToArrayAsync(ct);
        var awardIds = await db.Awards.Where(x => x.EditionId == editionId ||
            (x.ProgramItemId.HasValue && programIds.Contains(x.ProgramItemId.Value)))
            .Select(x => x.Id).ToArrayAsync(ct);
        var relatedIds = dayIds.Concat(activityIds).Concat(programIds).Concat(newsIds).Concat(galleryIds).Concat(awardIds).Append(editionId).ToArray();

        db.Set<NewsMedia>().RemoveRange(db.Set<NewsMedia>().Where(x => newsIds.Contains(x.NewsId)));
        db.Set<GalleryMedia>().RemoveRange(db.Set<GalleryMedia>().Where(x => galleryIds.Contains(x.GalleryId)));
        db.ExternalLinks.RemoveRange(db.ExternalLinks.Where(x =>
            (x.NewsId.HasValue && newsIds.Contains(x.NewsId.Value)) || relatedIds.Contains(x.OwnerId)));
        db.HomepageSelections.RemoveRange(db.HomepageSelections.Where(x => relatedIds.Contains(x.EntityId)));
        db.Translations.RemoveRange(db.Translations.Where(x => relatedIds.Contains(x.EntityId)));

        var homepageSections = await db.HomepageSections.Where(x => x.SelectedEditionId == editionId).ToListAsync(ct);
        foreach (var section in homepageSections) section.SelectedEditionId = null;
        var mediaFolders = await db.MediaFolders.Where(x => x.EditionId == editionId).ToListAsync(ct);
        foreach (var folder in mediaFolders) folder.EditionId = null;
        var media = await db.Media.Where(x => x.EditionId == editionId ||
            (x.FestivalDayId.HasValue && dayIds.Contains(x.FestivalDayId.Value)) ||
            (x.ProgramItemId.HasValue && programIds.Contains(x.ProgramItemId.Value))).ToListAsync(ct);
        foreach (var item in media)
        {
            if (item.EditionId == editionId) item.EditionId = null;
            if (item.FestivalDayId.HasValue && dayIds.Contains(item.FestivalDayId.Value)) item.FestivalDayId = null;
            if (item.ProgramItemId.HasValue && programIds.Contains(item.ProgramItemId.Value)) item.ProgramItemId = null;
        }

        db.News.RemoveRange(db.News.Where(x => newsIds.Contains(x.Id)));
        db.Galleries.RemoveRange(db.Galleries.Where(x => galleryIds.Contains(x.Id)));
        db.Awards.RemoveRange(db.Awards.Where(x => awardIds.Contains(x.Id)));
        db.FestivalActivities.RemoveRange(db.FestivalActivities.Where(x => activityIds.Contains(x.Id)));
        db.FestivalDays.RemoveRange(db.FestivalDays.Where(x => dayIds.Contains(x.Id)));
        db.ProgramItems.RemoveRange(db.ProgramItems.Where(x => programIds.Contains(x.Id)));
        db.Editions.Remove(edition);
    }

    private async Task<IActionResult> Save(string resource, Guid? id, AdminSaveRequest request, CancellationToken ct)
    {
        try
        {
            resource = resource.ToLowerInvariant(); var v = request.Values;
            if (resource == "languages" && !IsAdministrator()) return Forbid();
            if (resource == "settings" && !IsAdministrator())
            {
                var existingCritical = id.HasValue && await db.SiteSettings.AsNoTracking().AnyAsync(x => x.Id == id && x.IsCritical, ct);
                if (existingCritical || Bool(v, "isCritical")) return Forbid();
            }
            (Entity Entity, string TranslationType) result = resource switch
            {
                "editions" => (await SaveEdition(id, v, ct), nameof(Edition)), "days" => (await SaveDay(id, v, ct), nameof(FestivalDay)),
                "activities" => (await SaveActivity(id, v, ct), nameof(FestivalActivity)), "program" => (await SaveProgram(id, v, request, ct), nameof(ProgramItem)),
                "news" => (await SaveNews(id, v, request, ct), nameof(News)), "galleries" => (await SaveGallery(id, v, request, ct), nameof(Gallery)),
                "sponsors" => (await SaveSponsor(id, v, request, ct), nameof(Sponsor)), "awards" => (await SaveAward(id, v, ct), nameof(Award)),
                "pages" => (await SavePage(id, v, request, ct), nameof(PageContent)), "navigation" => (await SaveNavigation(id, v, ct), nameof(NavigationItem)),
                "settings" => (await SaveSetting(id, v, ct), nameof(SiteSetting)), "languages" => (await SaveLanguage(id, v, ct), nameof(Language)),
                "homepage" => (await SaveHomepage(id, v, request, ct), nameof(HomepageSection)), _ => throw new ArgumentException("Unknown resource.")
            };
            await OrganizeUploads(resource, result.Entity, request, ct);
            if (resource == "program") await SyncPlayTranslations(result.Entity.Id, request.Translations, ct);
            else await SyncTranslations(result.TranslationType, result.Entity.Id, request.Translations, ct);
            await db.SaveChangesAsync(ct);
            return id.HasValue ? Ok(new { id = result.Entity.Id }) : Created($"/api/admin/manage/{resource}/{result.Entity.Id}", new { id = result.Entity.Id });
        }
        catch (Missing) { return NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateException ex) { return Conflict(new { message = ex.InnerException?.Message ?? ex.Message }); }
    }

    private async Task OrganizeUploads(string resource, Entity entity, AdminSaveRequest request, CancellationToken ct)
    {
        Guid? editionId = entity is Edition ? entity.Id : GuidVal(request.Values, "editionId");
        Guid? dayId = entity is FestivalDay ? entity.Id : GuidVal(request.Values, "festivalDayId");
        Guid? playId = entity is ProgramItem ? entity.Id : GuidVal(request.Values, "programItemId");
        int? year = entity is Edition edition ? edition.Year : null;
        if (dayId.HasValue && entity is not FestivalDay)
            editionId ??= await db.FestivalDays.Where(x => x.Id == dayId).Select(x => (Guid?)x.EditionId).SingleOrDefaultAsync(ct);
        if (editionId.HasValue && !year.HasValue)
            year = await db.Editions.Where(x => x.Id == editionId).Select(x => (int?)x.Year).SingleOrDefaultAsync(ct);
        if (resource == "news" && !year.HasValue) year = Date(request.Values, "date")?.Year;
        if (entity is Edition)
        {
            await MediaOrganization.FolderAsync(db, "editions", year, editionId, ct);
            await MediaOrganization.FolderAsync(db, "news", year, editionId, ct);
        }
        var selected = request.MediaIds.ToHashSet();
        foreach (var field in request.Values.EnumerateObject())
        {
            if (field.Name.EndsWith("MediaId") && Guid.TryParse(field.Value.ToString(), out var mediaId)) selected.Add(mediaId);
            if (field.Name.EndsWith("MediaIdsJson")) selected.UnionWith(JsonSerializer.Deserialize<List<Guid>>(MediaIdsJson(request.Values, field.Name)) ?? []);
        }
        var ids = request.UploadedMediaIds.Where(selected.Contains).ToArray();
        if (ids.Length > 0)
        {
            var folder = await MediaOrganization.FolderAsync(db, resource, year, editionId, ct);
            foreach (var media in await db.Media.Where(x => ids.Contains(x.Id)).ToListAsync(ct))
            {
                media.EditionId = editionId; media.Year = year; media.FestivalDayId = dayId;
                media.ProgramItemId = playId; media.FolderId = folder.Id;
            }
        }
        if (entity is ProgramItem)
            foreach (var media in await db.Media.Where(x => request.MediaIds.Contains(x.Id)).ToListAsync(ct))
            { media.ProgramItemId = entity.Id; media.EditionId = editionId; media.Year = year; }
    }

    private async Task<Dictionary<Guid, Dictionary<string, Dictionary<string, string>>>> T(string type, IEnumerable<Guid> ids, CancellationToken ct)
    {
        var set = ids.Distinct().ToArray(); if (set.Length == 0) return [];
        var rows = await db.Translations.AsNoTracking().Where(x => x.EntityType == type && set.Contains(x.EntityId) && TranslationLanguages.Contains(x.LanguageCode)).ToListAsync(ct);
        return rows.GroupBy(x => x.EntityId).ToDictionary(g => g.Key, g => g.GroupBy(x => x.LanguageCode).ToDictionary(l => l.Key, l => l.ToDictionary(x => x.Field, x => x.Value)));
    }
    private static Dictionary<string, Dictionary<string, string>> Tr(Dictionary<Guid, Dictionary<string, Dictionary<string, string>>> all, Guid id) => all.GetValueOrDefault(id) ?? [];
    private static object Row(Guid id, object values, Dictionary<string, Dictionary<string, string>>? translations = null, IEnumerable<Guid>? mediaIds = null, IEnumerable<Guid>? editionIds = null, object? links = null, object? selections = null)
        => new { id, values, translations = translations ?? [], mediaIds = mediaIds ?? [], editionIds = editionIds ?? [], links, selections };

    private async Task<object> Editions(CancellationToken ct)
    {
        var x = await db.Editions.AsNoTracking().OrderByDescending(e => e.Year).ToListAsync(ct);
        var t = await T(nameof(Edition), x.Select(e => e.Id), ct);
        var mediaIds = x.SelectMany(e => new[] { e.HeroMediaId, e.DetailHeaderMediaId, e.BackgroundMediaId }).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();
        var media = await db.Media.AsNoTracking().Include(m => m.Variants).Where(m => mediaIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);

        string? PreviewUrl(Guid? id, params string[] preferredVariants)
        {
            if (!id.HasValue || !media.TryGetValue(id.Value, out var item)) return null;
            foreach (var variantName in preferredVariants)
            {
                var variant = item.Variants.FirstOrDefault(v => v.Name.Equals(variantName, StringComparison.OrdinalIgnoreCase));
                if (variant is not null) return variant.Url;
            }
            return item.Url;
        }

        return new
        {
            items = x.Select(e => Row(e.Id, new
            {
                e.Number,
                e.Year,
                e.StartDate,
                e.EndDate,
                e.Slug,
                e.PrimaryColor,
                e.SecondaryColor,
                status = e.Status.ToString(),
                e.PublishedAt,
                e.Order,
                e.HeroMediaId,
                e.DetailHeaderMediaId,
                e.BackgroundMediaId,
                e.RecapMediaId,
                heroMediaUrl = PreviewUrl(e.HeroMediaId, "medium", "large", "thumbnail"),
                identityMediaUrl = PreviewUrl(e.BackgroundMediaId, "thumbnail", "medium", "large")
            }, Tr(t, e.Id)))
        };
    }
    private async Task<object> Days(CancellationToken ct)
    {
        var days = await db.FestivalDays.AsNoTracking().OrderByDescending(e => e.Date).ToListAsync(ct);
        var translations = await T(nameof(FestivalDay), days.Select(e => e.Id), ct);
        var dayIds = days.Select(e => e.Id).ToArray();
        var classifiedMemories = await db.Media.AsNoTracking()
            .Where(media => media.Type == MediaType.Image && media.Category == "after-party" && media.FestivalDayId.HasValue && dayIds.Contains(media.FestivalDayId.Value))
            .OrderBy(media => media.UploadedAt).ThenBy(media => media.OriginalFilename)
            .Select(media => new { DayId = media.FestivalDayId!.Value, media.Id })
            .ToListAsync(ct);

        IReadOnlyList<Guid> ParseIds(string json) { try { return JsonSerializer.Deserialize<List<Guid>>(json) ?? []; } catch (JsonException) { return []; } }
        string MemoriesJson(FestivalDay day) => JsonSerializer.Serialize(ParseIds(day.MemoriesMediaIdsJson)
            .Concat(classifiedMemories.Where(media => media.DayId == day.Id).Select(media => media.Id)).Distinct());

        return new { items = days.Select(day => Row(day.Id, new { day.EditionId, day.Date, day.DayNumber, day.Order, day.IsPageEnabled, day.IsHeaderVisible, day.IsConferenceVisible, day.IsPlayVisible, day.IsRecapVisible, isMemoriesVisible = day.IsMemoriesVisible || classifiedMemories.Any(media => media.DayId == day.Id), day.HeaderMediaId, day.RecapMediaId, day.RecapYoutubeUrl, day.ConferenceMediaIdsJson, day.PlayMediaIdsJson, memoriesMediaIdsJson = MemoriesJson(day) }, Tr(translations, day.Id))) };
    }
    private async Task<object> Activities(CancellationToken ct) { var x = await db.FestivalActivities.AsNoTracking().OrderBy(e => e.FestivalDayId).ThenBy(e => e.Order).ToListAsync(ct); var t = await T(nameof(FestivalActivity), x.Select(e => e.Id), ct); return new { items = x.Select(e => Row(e.Id, new { e.FestivalDayId, e.Type, e.StartTime, e.EndTime, e.Venue, e.Order, e.ProgramItemId }, Tr(t, e.Id))) }; }
    private async Task<object> Program(CancellationToken ct) { var x = await db.ProgramItems.AsNoTracking().Include(e => e.Credits).Include(e => e.Translations).OrderByDescending(e => e.StartsAt).ToListAsync(ct); return new { items = x.Select(e => Row(e.Id, new { e.EditionId, e.Slug, e.ParticipationType, e.Country, e.Company, e.Director, credits = JsonSerializer.Serialize(e.Credits.OrderBy(c => c.Order).Select(c => new { role = c.Role, name = c.Name })), e.StartsAt, e.Venue, e.PosterMediaId, e.TrailerMediaId, status = e.Status.ToString(), e.PublishedAt, e.Order }, PlayTranslationDictionary(e.Translations))) }; }
    private async Task<object> News(CancellationToken ct)
    {
        var articles = await db.News.AsNoTracking().OrderByDescending(e => e.Date).ThenByDescending(e => e.PublishedAt).ToListAsync(ct);
        var translations = await T(nameof(News), articles.Select(e => e.Id), ct);
        var joins = await db.Set<NewsMedia>().AsNoTracking().OrderBy(m => m.Order).ToListAsync(ct);
        var links = await db.ExternalLinks.AsNoTracking().Where(e => e.NewsId != null).OrderBy(e => e.Order).ToListAsync(ct);
        var mediaIds = articles.Where(e => e.CoverMediaId.HasValue).Select(e => e.CoverMediaId!.Value).Concat(joins.Select(e => e.MediaId)).Distinct().ToList();
        var media = await db.Media.AsNoTracking().Where(m => mediaIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);
        var variants = await db.MediaVariants.AsNoTracking().Where(v => mediaIds.Contains(v.MediaId) && (v.Name == "thumbnail" || v.Name == "medium")).ToListAsync(ct);

        string? MediaPreview(Guid id) => variants.FirstOrDefault(v => v.MediaId == id && v.Name == "thumbnail")?.Url
            ?? variants.FirstOrDefault(v => v.MediaId == id && v.Name == "medium")?.Url
            ?? (media.TryGetValue(id, out var item) ? item.PosterUrl ?? item.Url : null);

        string? CoverUrl(News article)
        {
            if (article.CoverMediaId.HasValue) return MediaPreview(article.CoverMediaId.Value);
            var attached = joins.Where(j => j.NewsId == article.Id).Select(j => j.MediaId).FirstOrDefault(id => media.TryGetValue(id, out var item) && item.Type == MediaType.Image);
            if (attached != Guid.Empty) return MediaPreview(attached);
            var video = joins.Where(j => j.NewsId == article.Id).Select(j => j.MediaId).FirstOrDefault(id => media.TryGetValue(id, out var item) && item.Type == MediaType.Video && !string.IsNullOrWhiteSpace(item.PosterUrl));
            return video == Guid.Empty ? null : MediaPreview(video);
        }

        return new { items = articles.Select(article => Row(article.Id, new { article.EditionId, article.FestivalDayId, article.ActivityId, article.ProgramItemId, article.Date, article.Slug, article.Category, contentMode = article.ContentMode.ToString(), article.ExternalUrl, article.ExternalTarget, article.CoverMediaId, coverMediaUrl = CoverUrl(article), status = article.Status.ToString(), article.PublishedAt, article.Order }, Tr(translations, article.Id), joins.Where(m => m.NewsId == article.Id).Select(m => m.MediaId), links: links.Where(l => l.NewsId == article.Id).Select(l => new { l.Label, l.Url, l.Target, l.Order }))) };
    }
    private async Task<object> Galleries(CancellationToken ct)
    {
        var galleries = await db.Galleries.AsNoTracking().OrderBy(e => e.Order).ToListAsync(ct);
        var translations = await T(nameof(Gallery), galleries.Select(e => e.Id), ct);
        var links = await db.Set<GalleryMedia>().AsNoTracking().OrderBy(m => m.Order).ToListAsync(ct);
        var mediaIds = links.Select(x => x.MediaId).Concat(galleries.Where(x => x.CoverMediaId.HasValue).Select(x => x.CoverMediaId!.Value)).Distinct().ToList();
        var media = await db.Media.AsNoTracking().Where(x => mediaIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var thumbnails = await db.MediaVariants.AsNoTracking().Where(x => mediaIds.Contains(x.MediaId) && (x.Name == "thumbnail" || x.Name == "medium")).ToListAsync(ct);
        string? PreviewUrl(Guid id) => thumbnails.FirstOrDefault(x => x.MediaId == id && x.Name == "thumbnail")?.Url ?? thumbnails.FirstOrDefault(x => x.MediaId == id && x.Name == "medium")?.Url ?? (media.TryGetValue(id, out var item) ? item.PosterUrl ?? item.Url : null);
        string? Title(Guid id) { var text = Tr(translations, id); foreach (var language in new[] { "en", "sq", "bs" }) if (text.TryGetValue(language, out var fields) && fields.TryGetValue("title", out var title) && !string.IsNullOrWhiteSpace(title)) return title; return null; }
        var items = galleries.Select((gallery, index) => { var galleryLinks = links.Where(x => x.GalleryId == gallery.Id).ToList(); var previewIds = (gallery.CoverMediaId.HasValue ? new[] { gallery.CoverMediaId.Value } : Array.Empty<Guid>()).Concat(galleryLinks.Select(x => x.MediaId)).Distinct().Take(4); var displayName = Title(gallery.Id) ?? $"Memories gallery {index + 1}"; return Row(gallery.Id, new { gallery.EditionId, gallery.FestivalDayId, gallery.ActivityId, gallery.ProgramItemId, gallery.CoverMediaId, displayName, mediaCount = galleryLinks.Count, previewMediaUrls = previewIds.Select(PreviewUrl).Where(x => !string.IsNullOrWhiteSpace(x)), status = gallery.Status.ToString(), gallery.PublishedAt, gallery.Order }, Tr(translations, gallery.Id), galleryLinks.Select(x => x.MediaId)); }).ToList();
        return new { items };
    }
    private async Task<object> Sponsors(CancellationToken ct) { var x = await db.Sponsors.AsNoTracking().OrderBy(e => e.Order).ToListAsync(ct); var t = await T(nameof(Sponsor), x.Select(e => e.Id), ct); var joins = await db.Set<SponsorEdition>().AsNoTracking().ToListAsync(ct); return new { items = x.Select(e => Row(e.Id, new { e.Name, e.LogoMediaId, e.Url, e.Category, status = e.Status.ToString(), e.PublishedAt, e.Order }, Tr(t, e.Id), editionIds: joins.Where(j => j.SponsorId == e.Id).OrderBy(j => j.Order).Select(j => j.EditionId))) }; }
    private async Task<object> Awards(CancellationToken ct)
    {
        var x = await db.Awards.AsNoTracking().OrderByDescending(e => e.Edition.Year).ThenBy(e => e.Order).ThenBy(e => e.AwardType).ToListAsync(ct);
        var t = await T(nameof(Award), x.Select(e => e.Id), ct);
        var playIds = x.Where(e => e.ProgramItemId.HasValue).Select(e => e.ProgramItemId!.Value).Distinct().ToArray();
        var plays = await db.ProgramItems.AsNoTracking().Include(p => p.Translations).Where(p => playIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        string Recipient(Award award)
        {
            if (!string.IsNullOrWhiteSpace(award.Person)) return award.Person;
            if (!string.IsNullOrWhiteSpace(award.Recipient)) return award.Recipient;
            if (!award.ProgramItemId.HasValue || !plays.TryGetValue(award.ProgramItemId.Value, out var play)) return "";
            return play.Translations.FirstOrDefault(row => row.LanguageCode == "en")?.Title
                ?? play.Translations.FirstOrDefault(row => !string.IsNullOrWhiteSpace(row.Title))?.Title
                ?? play.Slug;
        }
        return new { items = x.Select(e => Row(e.Id, new { e.EditionId, e.AwardType, Recipient = Recipient(e), e.Person, e.ProgramItemId, e.Country, e.MediaId, status = e.Status.ToString(), e.PublishedAt, e.Order }, Tr(t, e.Id))) };
    }
    private async Task<object> Pages(CancellationToken ct) { var x = await db.PageContents.AsNoTracking().OrderBy(e => e.PageKey).ThenBy(e => e.Order).ToListAsync(ct); var t = await T(nameof(PageContent), x.Select(e => e.Id), ct); var media = await db.PageContentMedia.AsNoTracking().OrderBy(m => m.Order).ToListAsync(ct); return new { items = x.Select(e => { var attached = media.Where(m => m.PageContentId == e.Id).ToList(); return Row(e.Id, new { e.PageKey, e.SectionKey, e.ContentJson, e.MediaId, mediaRoles = attached.Select(m => m.Role), status = e.Status.ToString(), e.PublishedAt, e.Order }, Tr(t, e.Id), attached.Select(m => m.MediaId)); }) }; }
    private async Task<object> Navigation(CancellationToken ct) { var x = await db.NavigationItems.AsNoTracking().OrderBy(e => e.Order).ToListAsync(ct); var t = await T(nameof(NavigationItem), x.Select(e => e.Id), ct); return new { items = x.Select(e => Row(e.Id, new { e.Key, e.Url, e.Target, e.ParentId, status = e.Status.ToString(), e.PublishedAt, e.Order }, Tr(t, e.Id))) }; }
    private async Task<object> Settings(CancellationToken ct) { var x = await db.SiteSettings.AsNoTracking().OrderBy(e => e.Group).ThenBy(e => e.Key).ToListAsync(ct); var t = await T(nameof(SiteSetting), x.Select(e => e.Id), ct); return new { items = x.Select(e => Row(e.Id, new { e.Key, e.Value, e.ValueType, e.IsCritical, e.Group }, Tr(t, e.Id))) }; }
    private async Task<object> Languages(CancellationToken ct) { var x = await db.Languages.AsNoTracking().OrderBy(e => e.Order).ToListAsync(ct); return new { items = x.Select(e => Row(e.Id, new { e.Code, e.Name, e.IsPublic, e.IsActive, e.Order })) }; }
    private async Task<object> Homepage(CancellationToken ct) { var x = await db.HomepageSections.AsNoTracking().Include(e => e.Selections).OrderBy(e => e.Order).ToListAsync(ct); var t = await T(nameof(HomepageSection), x.Select(e => e.Id), ct); return new { items = x.Select(e => Row(e.Id, new { e.Key, e.IsVisible, e.SelectionMode, e.SelectedEditionId, e.ItemLimit, e.ConfigurationJson, status = e.Status.ToString(), e.PublishedAt, e.Order }, Tr(t, e.Id), selections: e.Selections.OrderBy(s => s.Order).Select(s => new { s.EntityType, s.EntityId, s.Order }))) }; }

    private async Task<Edition> SaveEdition(Guid? id, JsonElement v, CancellationToken ct) { var x = await FindOrNew(db.Editions, id, ct); x.Number = Int(v, "number"); x.Year = Int(v, "year"); x.StartDate = Date(v, "startDate"); x.EndDate = Date(v, "endDate"); x.Slug = Req(v, "slug"); x.PrimaryColor = Color(v, "primaryColor"); x.SecondaryColor = Color(v, "secondaryColor"); Publish(x, v); x.HeroMediaId = GuidVal(v, "heroMediaId"); x.DetailHeaderMediaId = GuidVal(v, "detailHeaderMediaId"); x.BackgroundMediaId = GuidVal(v, "backgroundMediaId"); x.RecapMediaId = GuidVal(v, "recapMediaId"); return x; }
    private async Task<FestivalDay> SaveDay(Guid? id, JsonElement v, CancellationToken ct) { var x = await FindOrNew(db.FestivalDays, id, ct); x.EditionId = GuidVal(v, "editionId") ?? throw new ArgumentException("Edition is required."); x.Date = Date(v, "date") ?? throw new ArgumentException("Date is required."); x.DayNumber = Int(v, "dayNumber"); x.Order = Int(v, "order"); x.IsPageEnabled = Bool(v, "isPageEnabled"); x.IsHeaderVisible = Bool(v, "isHeaderVisible"); x.IsConferenceVisible = Bool(v, "isConferenceVisible"); x.IsPlayVisible = Bool(v, "isPlayVisible"); x.IsRecapVisible = Bool(v, "isRecapVisible"); x.IsMemoriesVisible = Bool(v, "isMemoriesVisible"); x.HeaderMediaId = GuidVal(v, "headerMediaId"); x.RecapMediaId = GuidVal(v, "recapMediaId"); x.RecapYoutubeUrl = Str(v, "recapYoutubeUrl"); x.ConferenceMediaIdsJson = MediaIdsJson(v, "conferenceMediaIdsJson"); x.PlayMediaIdsJson = MediaIdsJson(v, "playMediaIdsJson"); x.MemoriesMediaIdsJson = MediaIdsJson(v, "memoriesMediaIdsJson"); return x; }
    private async Task<FestivalActivity> SaveActivity(Guid? id, JsonElement v, CancellationToken ct) { var x = await FindOrNew(db.FestivalActivities, id, ct); x.FestivalDayId = GuidVal(v, "festivalDayId") ?? throw new ArgumentException("Festival day is required."); x.Type = Req(v, "type"); x.StartTime = Time(v, "startTime"); x.EndTime = Time(v, "endTime"); x.Venue = Str(v, "venue"); x.Order = Int(v, "order"); x.ProgramItemId = GuidVal(v, "programItemId"); return x; }
    private async Task<ProgramItem> SaveProgram(Guid? id, JsonElement v, AdminSaveRequest r, CancellationToken ct) { RequirePlayTitle(r.Translations); var x = await FindOrNew(db.ProgramItems, id, ct); x.EditionId = GuidVal(v, "editionId") ?? throw new ArgumentException("Edition is required."); x.Slug = Req(v, "slug"); x.ParticipationType = Str(v, "participationType") ?? "Official Competition"; x.Country = Str(v, "country"); x.Company = Str(v, "company"); x.Director = Str(v, "director"); x.StartsAt = DateTime(v, "startsAt"); x.Venue = Str(v, "venue"); x.PosterMediaId = GuidVal(v, "posterMediaId"); x.TrailerMediaId = GuidVal(v, "trailerMediaId"); Publish(x, v); await SyncPlayCredits(x.Id, Str(v, "credits"), ct); return x; }
    private async Task<News> SaveNews(Guid? id, JsonElement v, AdminSaveRequest r, CancellationToken ct) { var x = await FindOrNew(db.News, id, ct); x.EditionId = GuidVal(v, "editionId"); x.FestivalDayId = x.EditionId.HasValue ? GuidVal(v, "festivalDayId") : null; x.ActivityId = x.EditionId.HasValue ? GuidVal(v, "activityId") : null; x.ProgramItemId = x.EditionId.HasValue ? GuidVal(v, "programItemId") : null; x.Date = Date(v, "date") ?? throw new ArgumentException("Date is required."); x.Slug = Req(v, "slug"); x.Category = Str(v, "category"); x.ContentMode = EnumVal(v, "contentMode", ContentMode.Internal); x.ExternalUrl = Str(v, "externalUrl"); x.ExternalTarget = "_blank"; x.CoverMediaId = GuidVal(v, "coverMediaId") ?? r.MediaIds.FirstOrDefault(); if (x.CoverMediaId == Guid.Empty) x.CoverMediaId = null; Publish(x, v); await SyncNewsMedia(x.Id, r.MediaIds, ct); await SyncLinks(x.Id, r.Links, ct); return x; }
    private async Task<Gallery> SaveGallery(Guid? id, JsonElement v, AdminSaveRequest r, CancellationToken ct) { var x = await FindOrNew(db.Galleries, id, ct); x.EditionId = GuidVal(v, "editionId"); x.FestivalDayId = GuidVal(v, "festivalDayId"); x.ActivityId = GuidVal(v, "activityId"); x.ProgramItemId = GuidVal(v, "programItemId"); if (x.EditionId.HasValue && !x.FestivalDayId.HasValue && !x.ActivityId.HasValue && !x.ProgramItemId.HasValue && await db.Galleries.AsNoTracking().AnyAsync(g => g.EditionId == x.EditionId && g.FestivalDayId == null && g.ActivityId == null && g.ProgramItemId == null && (!id.HasValue || g.Id != id.Value), ct)) throw new ArgumentException("This edition already has a general Memories gallery. Edit the existing gallery instead."); x.CoverMediaId = GuidVal(v, "coverMediaId"); Publish(x, v); await SyncGalleryMedia(x.Id, r.MediaIds, ct); return x; }
    private async Task<Sponsor> SaveSponsor(Guid? id, JsonElement v, AdminSaveRequest r, CancellationToken ct) { var x = await FindOrNew(db.Sponsors, id, ct); x.Name = Req(v, "name"); x.LogoMediaId = GuidVal(v, "logoMediaId"); x.Url = Str(v, "url"); x.Category = Str(v, "category"); Publish(x, v); await SyncSponsorEditions(x.Id, r.EditionIds, ct); return x; }
    private async Task<Award> SaveAward(Guid? id, JsonElement v, CancellationToken ct)
    {
        var x = await FindOrNew(db.Awards, id, ct);
        x.EditionId = GuidVal(v, "editionId") ?? throw new ArgumentException("Edition is required.");
        x.AwardType = Req(v, "awardType");
        if (await db.Awards.AsNoTracking().AnyAsync(a => a.EditionId == x.EditionId && a.AwardType == x.AwardType && (!id.HasValue || a.Id != id.Value), ct))
            throw new ArgumentException($"{x.AwardType} already exists for this edition. Edit the existing award to add joint winners.");
        x.ProgramItemId = GuidVal(v, "programItemId");
        x.Person = Str(v, "person")?.Trim();
        x.MediaId = GuidVal(v, "mediaId");

        var playAward = x.AwardType is "Best Play Award" or "Students’ Choice Award for Best Play" or "Media Choice Award for Best Play" or "Public Award for Best Play";
        var personAward = x.AwardType is "Best Director Award" or "Best Actor Award" or "Best Actress Award" or "Best Supporting Actor Award" or "Best Supporting Actress Award";
        ProgramItem? play = null;
        if (x.ProgramItemId.HasValue)
        {
            play = await db.ProgramItems.AsNoTracking().Include(p => p.Translations).SingleOrDefaultAsync(p => p.Id == x.ProgramItemId.Value, ct)
                ?? throw new ArgumentException("The selected performance does not exist.");
            if (play.EditionId != x.EditionId) throw new ArgumentException("The selected performance does not belong to this edition.");
            if (play.ParticipationType != "Official Competition") throw new ArgumentException("Guest performances are out of competition and cannot receive awards.");
        }
        if ((playAward || personAward) && play is null) throw new ArgumentException("A performance is required for this award.");
        if (personAward && string.IsNullOrWhiteSpace(x.Person)) throw new ArgumentException("A director or cast member is required for this award.");
        if (x.AwardType == "Special Mention Award" && play is null && string.IsNullOrWhiteSpace(x.Person)) throw new ArgumentException("Select a performance or enter a person for the special mention.");

        var enteredRecipient = Str(v, "recipient")?.Trim();
        var playTitle = play?.Translations.FirstOrDefault(t => t.LanguageCode == "en")?.Title
            ?? play?.Translations.FirstOrDefault(t => t.LanguageCode == "sq")?.Title
            ?? play?.Translations.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t.Title))?.Title
            ?? play?.Slug;
        x.Country = play?.Translations.FirstOrDefault(t => t.LanguageCode == "en")?.Country
            ?? play?.Translations.FirstOrDefault(t => t.LanguageCode == "sq")?.Country
            ?? play?.Translations.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t.Country))?.Country
            ?? play?.Country;
        x.Recipient = playAward ? playTitle! : personAward ? x.Person! : x.Person ?? playTitle ?? enteredRecipient ?? throw new ArgumentException("A recipient is required.");
        Publish(x, v);
        return x;
    }
    private async Task<PageContent> SavePage(Guid? id, JsonElement v, AdminSaveRequest r, CancellationToken ct) { var x = await FindOrNew(db.PageContents, id, ct); x.PageKey = Req(v, "pageKey"); x.SectionKey = Req(v, "sectionKey"); x.ContentJson = Str(v, "contentJson") ?? "{}"; JsonDocument.Parse(x.ContentJson); x.MediaId = GuidVal(v, "mediaId"); Publish(x, v); await SyncPageMedia(x.Id, r.MediaIds, r.MediaRoles, ct); return x; }
    private async Task<NavigationItem> SaveNavigation(Guid? id, JsonElement v, CancellationToken ct) { var x = await FindOrNew(db.NavigationItems, id, ct); x.Key = Req(v, "key"); x.Url = Req(v, "url"); x.Target = Str(v, "target") ?? "_self"; x.ParentId = GuidVal(v, "parentId"); Publish(x, v); return x; }
    private async Task<SiteSetting> SaveSetting(Guid? id, JsonElement v, CancellationToken ct) { var x = await FindOrNew(db.SiteSettings, id, ct); x.Key = Req(v, "key"); x.Value = Str(v, "value"); x.ValueType = Str(v, "valueType") ?? "text"; x.IsCritical = Bool(v, "isCritical"); x.Group = Str(v, "group"); return x; }
    private async Task<Language> SaveLanguage(Guid? id, JsonElement v, CancellationToken ct) { var x = await FindOrNew(db.Languages, id, ct); x.Code = Req(v, "code"); x.Name = Req(v, "name"); x.IsPublic = Bool(v, "isPublic"); x.IsActive = Bool(v, "isActive", true); x.Order = Int(v, "order"); return x; }
    private async Task<HomepageSection> SaveHomepage(Guid? id, JsonElement v, AdminSaveRequest r, CancellationToken ct) { var x = await FindOrNew(db.HomepageSections, id, ct); x.Key = Req(v, "key"); x.IsVisible = Bool(v, "isVisible", true); x.SelectionMode = Str(v, "selectionMode") ?? "automatic"; x.SelectedEditionId = GuidVal(v, "selectedEditionId"); x.ItemLimit = NullableInt(v, "itemLimit"); x.ConfigurationJson = Str(v, "configurationJson") ?? "{}"; JsonDocument.Parse(x.ConfigurationJson); Publish(x, v); await SyncSelections(x.Id, r.Selections, ct); return x; }

    private async Task<T> FindOrNew<T>(DbSet<T> set, Guid? id, CancellationToken ct) where T : Entity, new() { if (id.HasValue) return await set.FindAsync([id.Value], ct) ?? throw new Missing(); var x = new T(); set.Add(x); return x; }
    private async Task SyncTranslations(string type, Guid id, Dictionary<string, Dictionary<string, string>> incoming, CancellationToken ct) { foreach (var (language, fields) in incoming.Where(x => TranslationLanguages.Contains(x.Key))) foreach (var (field, value) in fields) { var row = await db.Translations.SingleOrDefaultAsync(x => x.EntityType == type && x.EntityId == id && x.LanguageCode == language && x.Field == field, ct); if (string.IsNullOrWhiteSpace(value)) { if (row != null) db.Remove(row); } else if (row == null) db.Add(new Translation { EntityType = type, EntityId = id, LanguageCode = language, Field = field, Value = value }); else row.Value = value; } }
    private async Task SyncPlayCredits(Guid id, string? json, CancellationToken ct) { db.PlayCredits.RemoveRange(await db.PlayCredits.Where(x => x.PlayId == id).ToListAsync(ct)); if (string.IsNullOrWhiteSpace(json)) return; List<CreditInput>? entries; try { entries = JsonSerializer.Deserialize<List<CreditInput>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); } catch (JsonException) { entries = [new("Other credits", json)]; } if (entries is null) return; var order = 0; foreach (var entry in entries.Where(x => !string.IsNullOrWhiteSpace(x.Role) || !string.IsNullOrWhiteSpace(x.Name))) db.PlayCredits.Add(new PlayCredit { PlayId = id, Role = entry.Role?.Trim() ?? "", Name = entry.Name?.Trim() ?? "", Order = order++ }); }
    private async Task SyncPlayTranslations(Guid playId, Dictionary<string, Dictionary<string, string>> incoming, CancellationToken ct) { foreach (var language in TranslationLanguages) { incoming.TryGetValue(language, out var fields); fields ??= []; var row = await db.PlayTranslations.SingleOrDefaultAsync(x => x.PlayId == playId && x.LanguageCode == language, ct); string? V(string key) => fields.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : null; var values = new[] { V("title"), V("country"), V("company"), V("description"), V("synopsis") }; if (values.All(string.IsNullOrWhiteSpace)) { if (row is not null) db.Remove(row); continue; } row ??= new PlayTranslation { PlayId = playId, LanguageCode = language }; if (db.Entry(row).State == EntityState.Detached) db.Add(row); row.Title = values[0]; row.Country = values[1]; row.Company = values[2]; row.Description = values[3]; row.Synopsis = values[4]; } }
    private static Dictionary<string, Dictionary<string, string>> PlayTranslationDictionary(IEnumerable<PlayTranslation> rows) => rows.ToDictionary(x => x.LanguageCode, x => new Dictionary<string, string> { ["title"] = x.Title ?? "", ["country"] = x.Country ?? "", ["company"] = x.Company ?? "", ["description"] = x.Description ?? "", ["synopsis"] = x.Synopsis ?? "" }.Where(f => !string.IsNullOrWhiteSpace(f.Value)).ToDictionary());
    private static void RequirePlayTitle(Dictionary<string, Dictionary<string, string>> translations) { if (!translations.Values.Any(x => x.TryGetValue("title", out var title) && !string.IsNullOrWhiteSpace(title))) throw new ArgumentException("A play title is required in at least one language."); }
    private async Task SyncNewsMedia(Guid id, IReadOnlyList<Guid> ids, CancellationToken ct) { db.Set<NewsMedia>().RemoveRange(await db.Set<NewsMedia>().Where(x => x.NewsId == id).ToListAsync(ct)); for (var i = 0; i < ids.Count; i++) db.Add(new NewsMedia { NewsId = id, MediaId = ids[i], Order = i }); }
    private async Task SyncGalleryMedia(Guid id, IReadOnlyList<Guid> ids, CancellationToken ct) { db.Set<GalleryMedia>().RemoveRange(await db.Set<GalleryMedia>().Where(x => x.GalleryId == id).ToListAsync(ct)); for (var i = 0; i < ids.Count; i++) db.Add(new GalleryMedia { GalleryId = id, MediaId = ids[i], Order = i }); }
    private async Task SyncPageMedia(Guid id, IReadOnlyList<Guid> ids, IReadOnlyList<string>? roles, CancellationToken ct) { db.PageContentMedia.RemoveRange(await db.PageContentMedia.Where(x => x.PageContentId == id).ToListAsync(ct)); for (var i = 0; i < ids.Count; i++) db.Add(new PageContentMedia { PageContentId = id, MediaId = ids[i], Role = roles != null && i < roles.Count && !string.IsNullOrWhiteSpace(roles[i]) ? roles[i] : "gallery", Order = i }); }
    private async Task SyncSponsorEditions(Guid id, IReadOnlyList<Guid> ids, CancellationToken ct) { db.Set<SponsorEdition>().RemoveRange(await db.Set<SponsorEdition>().Where(x => x.SponsorId == id).ToListAsync(ct)); for (var i = 0; i < ids.Count; i++) db.Add(new SponsorEdition { SponsorId = id, EditionId = ids[i], Order = i }); }
    private async Task SyncLinks(Guid id, IReadOnlyList<AdminLink> links, CancellationToken ct) { db.ExternalLinks.RemoveRange(await db.ExternalLinks.Where(x => x.NewsId == id).ToListAsync(ct)); for (var i = 0; i < links.Count; i++) db.Add(new ExternalLink { OwnerType = nameof(News), OwnerId = id, NewsId = id, Label = links[i].Label, Url = links[i].Url, Target = links[i].Target ?? "_blank", Order = i }); }
    private async Task SyncSelections(Guid id, IReadOnlyList<AdminSelection> selections, CancellationToken ct) { db.HomepageSelections.RemoveRange(await db.HomepageSelections.Where(x => x.HomepageSectionId == id).ToListAsync(ct)); for (var i = 0; i < selections.Count; i++) db.Add(new HomepageSelection { HomepageSectionId = id, EntityType = selections[i].EntityType, EntityId = selections[i].EntityId, Order = i }); }

    private static void Publish(PublishableEntity x, JsonElement v) { x.Status = EnumVal(v, "status", ContentStatus.Draft); x.PublishedAt = DateTime(v, "publishedAt"); x.Order = Int(v, "order"); }
    private static string? Str(JsonElement v, string key) => v.TryGetProperty(key, out var x) && x.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined) ? x.ToString() : null;
    private static string Req(JsonElement v, string key) => !string.IsNullOrWhiteSpace(Str(v, key)) ? Str(v, key)! : throw new ArgumentException($"{key} is required.");
    private static string? Color(JsonElement v, string key) { var value = Str(v, key)?.Trim(); if (string.IsNullOrWhiteSpace(value)) return null; return System.Text.RegularExpressions.Regex.IsMatch(value, "^#[0-9a-fA-F]{6}$") ? value.ToLowerInvariant() : throw new ArgumentException($"{key} must be a six-digit hex color such as #b57a24."); }
    private static int Int(JsonElement v, string key) => int.TryParse(Str(v, key), out var x) ? x : 0;
    private static int? NullableInt(JsonElement v, string key) => int.TryParse(Str(v, key), out var x) ? x : null;
    private static bool Bool(JsonElement v, string key, bool fallback = false) => v.TryGetProperty(key, out var x) ? x.ValueKind == JsonValueKind.True || bool.TryParse(x.ToString(), out var b) && b : fallback;
    private static Guid? GuidVal(JsonElement v, string key) => Guid.TryParse(Str(v, key), out var x) ? x : null;
    private static string MediaIdsJson(JsonElement v, string key) { var value = Str(v, key); if (string.IsNullOrWhiteSpace(value)) return "[]"; try { var ids = JsonSerializer.Deserialize<List<Guid>>(value) ?? []; return JsonSerializer.Serialize(ids.Distinct()); } catch (JsonException) { throw new ArgumentException($"{key} must contain a valid media selection."); } }
    private static DateOnly? Date(JsonElement v, string key) => DateOnly.TryParse(Str(v, key), out var x) ? x : null;
    private static TimeOnly? Time(JsonElement v, string key) => TimeOnly.TryParse(Str(v, key), out var x) ? x : null;
    private static DateTimeOffset? DateTime(JsonElement v, string key) => DateTimeOffset.TryParse(Str(v, key), out var x) ? x : null;
    private static T EnumVal<T>(JsonElement v, string key, T fallback) where T : struct, Enum => Enum.TryParse<T>(Str(v, key), true, out var x) ? x : fallback;
    private bool IsAdministrator() => User.IsInRole("SuperAdmin") || User.IsInRole("Admin");
    private sealed class Missing : Exception;
    private sealed record CreditInput(string? Role, string? Name);
}

public sealed record AdminSaveRequest(JsonElement Values, Dictionary<string, Dictionary<string, string>> Translations, IReadOnlyList<Guid> MediaIds, IReadOnlyList<Guid> EditionIds, IReadOnlyList<AdminLink> Links, IReadOnlyList<AdminSelection> Selections, IReadOnlyList<string>? MediaRoles = null)
{
    public IReadOnlyList<Guid> UploadedMediaIds { get; init; } = [];
    public AdminSaveRequest() : this(JsonDocument.Parse("{}").RootElement, [], [], [], [], []) { }
}
public sealed record AdminLink(string Label, string Url, string? Target);
public sealed record AdminSelection(string EntityType, Guid EntityId);
