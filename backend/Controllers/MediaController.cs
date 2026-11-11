using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Models;
using PITF.Api.Services;
using PITF.Api.Storage;
using SixLabors.ImageSharp;

namespace PITF.Api.Controllers;

[ApiController]
[Route("api/admin/media")]
[Authorize(Policy = "ContentWrite")]
public sealed class MediaController(ApplicationDbContext db, IMediaStorageService storage, IImageVariantService imageVariants) : ControllerBase
{
    private static readonly HashSet<string> Categories = new(StringComparer.OrdinalIgnoreCase) { "performance", "press-conference", "after-party", "opening-ceremony", "closing-ceremony", "awards", "workshop", "backstage", "audience", "portrait", "venue", "sponsor-branding", "recap", "other" };

    [HttpGet]
    public async Task<IActionResult> List(Guid? folderId, MediaType? type, string? search, int? year, Guid? editionId, string? category, string? tag, Guid? festivalDayId, Guid? programItemId, string? usage, string sort = "uploaded-desc", int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        page = Math.Max(page, 1); pageSize = Math.Clamp(pageSize, 1, 200);
        var query = db.Media.AsNoTracking().AsSplitQuery().Include(x => x.Variants).Include(x => x.Folder).AsQueryable();
        if (folderId.HasValue) query = query.Where(x => x.FolderId == folderId);
        if (type.HasValue) query = query.Where(x => x.Type == type);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.OriginalFilename.Contains(search) || (x.Alt != null && x.Alt.Contains(search)) || (x.Caption != null && x.Caption.Contains(search)) || (x.Tags != null && x.Tags.Contains(search)));
        if (year.HasValue) query = query.Where(x => x.Year == year);
        if (editionId.HasValue) query = query.Where(x => x.EditionId == editionId);
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(x => x.Category == category);
        if (!string.IsNullOrWhiteSpace(tag)) query = query.Where(x => x.Tags != null && x.Tags.Contains(tag));
        if (festivalDayId.HasValue) query = query.Where(x => x.FestivalDayId == festivalDayId);
        if (programItemId.HasValue) query = query.Where(x => x.ProgramItemId == programItemId);
        if (usage == "news") query = query.Where(x => db.Set<NewsMedia>().Any(n => n.MediaId == x.Id) || db.News.Any(n => n.CoverMediaId == x.Id));
        if (usage == "website") query = query.Where(x => db.PageContentMedia.Any(p => p.MediaId == x.Id) || db.PageContents.Any(p => p.MediaId == x.Id) || db.Editions.Any(e => e.HeroMediaId == x.Id || e.DetailHeaderMediaId == x.Id || e.BackgroundMediaId == x.Id || e.RecapMediaId == x.Id));
        if (usage == "missing-alt") query = query.Where(x => x.Type == MediaType.Image && string.IsNullOrEmpty(x.Alt));
        if (usage == "unassigned") query = query.Where(x => x.EditionId == null && x.Year == null);
        if (usage == "unused") query = query.Where(x => !db.Set<NewsMedia>().Any(n => n.MediaId == x.Id) && !db.Set<GalleryMedia>().Any(g => g.MediaId == x.Id) && !db.PageContentMedia.Any(p => p.MediaId == x.Id) && !db.PageContents.Any(p => p.MediaId == x.Id) && !db.Editions.Any(e => e.HeroMediaId == x.Id || e.DetailHeaderMediaId == x.Id || e.BackgroundMediaId == x.Id || e.RecapMediaId == x.Id) && !db.ProgramItems.Any(p => p.PosterMediaId == x.Id || p.TrailerMediaId == x.Id) && !db.News.Any(n => n.CoverMediaId == x.Id) && !db.Galleries.Any(g => g.CoverMediaId == x.Id) && !db.Sponsors.Any(s => s.LogoMediaId == x.Id) && !db.Awards.Any(a => a.MediaId == x.Id));
        var total = await query.CountAsync(ct);
        query = sort switch { "name-asc" => query.OrderBy(x => x.OriginalFilename), "name-desc" => query.OrderByDescending(x => x.OriginalFilename), "uploaded-asc" => query.OrderBy(x => x.UploadedAt), _ => query.OrderByDescending(x => x.UploadedAt) };
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new { page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize), items = rows.Select(x => PublicContentService.MapMedia(x)) });
    }

    [RequestSizeLimit(536870912)]
    [HttpPost("upload")]
    public async Task<IActionResult> Upload([FromForm] List<IFormFile> files, [FromForm] Guid? folderId, [FromForm] int? year, [FromForm] Guid? editionId, [FromForm] string? category, [FromForm] string? tags, [FromForm] Guid? festivalDayId, [FromForm] Guid? programItemId, [FromForm] string? credit, [FromForm] string? source, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(category) && !Categories.Contains(category)) return BadRequest(new { message = "Unknown media category." });
        if (editionId.HasValue) year = await db.Editions.Where(x => x.Id == editionId).Select(x => (int?)x.Year).SingleOrDefaultAsync(ct) ?? year;
        if (programItemId.HasValue)
        {
            var play = await db.ProgramItems.FindAsync([programItemId.Value], ct);
            if (play is null) return BadRequest(new { message = "Performance not found." });
            editionId = play.EditionId;
        }
        if (festivalDayId.HasValue)
        {
            var day = await db.FestivalDays.FindAsync([festivalDayId.Value], ct);
            if (day is null) return BadRequest(new { message = "Festival day not found." });
            if (editionId.HasValue && editionId != day.EditionId) return BadRequest(new { message = "The day and performance must belong to the same edition." });
            editionId = day.EditionId;
        }
        if (editionId.HasValue)
        {
            var edition = await db.Editions.FindAsync([editionId.Value], ct);
            if (edition is null) return BadRequest(new { message = "Edition not found." });
            year = edition.Year;
        }
        if (!folderId.HasValue && (!string.IsNullOrWhiteSpace(source) || editionId.HasValue))
            folderId = (await MediaOrganization.FolderAsync(db, source ?? "editions", year, editionId, ct)).Id;
        var result = new List<Media>();
        foreach (var file in files)
        {
            await using var input = file.OpenReadStream(); var saved = await storage.SaveAsync(input, file.FileName, ct);
            var duplicate = await db.Media.Include(x => x.Variants).Include(x => x.Folder).FirstOrDefaultAsync(x => x.Sha256 == saved.Sha256, ct);
            if (duplicate is not null && string.IsNullOrWhiteSpace(source) && !editionId.HasValue && !festivalDayId.HasValue && !programItemId.HasValue && !folderId.HasValue) { await storage.DeleteAsync(saved.Key, ct); result.Add(duplicate); continue; }
            var type = file.ContentType.StartsWith("image/") ? MediaType.Image : file.ContentType.StartsWith("video/") ? MediaType.Video : MediaType.Document;
            var media = new Media { Type = type, OriginalFilename = file.FileName, StoredFilename = Path.GetFileName(saved.Key), StorageKey = saved.Key, Url = saved.Url, MimeType = file.ContentType, FileSize = saved.Size, Sha256 = saved.Sha256, FolderId = folderId, Year = year, EditionId = editionId, Category = NormalizeCategory(category), Tags = NormalizeTags(tags), FestivalDayId = festivalDayId, ProgramItemId = programItemId, Credit = credit };
            if (type == MediaType.Image)
            {
                var info = await Image.IdentifyAsync(storage.ResolvePath(saved.Key), ct); media.Width = info.Width; media.Height = info.Height;
                foreach (var variant in await imageVariants.CreateAsync(storage.ResolvePath(saved.Key), storage, ct)) media.Variants.Add(new MediaVariant { Name = variant.Name, StorageKey = variant.File.Key, Url = variant.File.Url, FileSize = variant.File.Size, Width = variant.Width, Height = variant.Height });
            }
            db.Media.Add(media); result.Add(media);
        }
        await db.SaveChangesAsync(ct);
        return Ok(result.Select(x => PublicContentService.MapMedia(x)));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateMedia request, CancellationToken ct)
    {
        var media = await db.Media.FindAsync([id], ct); if (media is null) return NotFound();
        if (request.OriginalFilename is not null)
        {
            var filename = Path.GetFileName(request.OriginalFilename.Trim());
            if (string.IsNullOrWhiteSpace(filename)) return BadRequest(new { message = "File name is required." });
            if (filename.Length > 500) return BadRequest(new { message = "File name must be 500 characters or fewer." });
            media.OriginalFilename = filename;
        }
        media.Alt = request.Alt; media.Caption = request.Caption; media.Credit = request.Credit; media.FolderId = request.FolderId;
        if (!Categories.Contains(request.Category)) return BadRequest(new { message = "Unknown media category." });
        media.PosterUrl = request.PosterUrl; media.Year = request.Year; media.EditionId = request.EditionId; media.Category = NormalizeCategory(request.Category); media.Tags = NormalizeTags(request.Tags); media.FestivalDayId = request.FestivalDayId; media.ProgramItemId = request.ProgramItemId;
        if (request.EditionId.HasValue) media.Year = await db.Editions.Where(x => x.Id == request.EditionId).Select(x => (int?)x.Year).SingleOrDefaultAsync(ct) ?? request.Year;
        await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var media = await db.Media.AsNoTracking().Include(x => x.Variants).Include(x => x.Folder).SingleOrDefaultAsync(x => x.Id == id, ct);
        return media is null ? NotFound() : Ok(PublicContentService.MapMedia(media));
    }

    [HttpPost("bulk-move")]
    public async Task<IActionResult> BulkMove(BulkMoveRequest request, CancellationToken ct)
    {
        if (request.FolderId.HasValue && !await db.MediaFolders.AnyAsync(x => x.Id == request.FolderId, ct)) return BadRequest(new { message = "Folder not found." });
        var rows = await db.Media.Where(x => request.Ids.Contains(x.Id)).ToListAsync(ct);
        foreach (var media in rows) media.FolderId = request.FolderId;
        await db.SaveChangesAsync(ct); return Ok(new { moved = rows.Count });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var media = await db.Media.Include(x => x.Variants).SingleOrDefaultAsync(x => x.Id == id, ct); if (media is null) return NotFound();
        if (await IsReferenced(id, ct)) return Conflict(new { message = "This media item is in use. Remove it from content before deleting it." });
        var keys = media.Variants.Select(x => x.StorageKey).Append(media.StorageKey).ToArray();
        db.Media.Remove(media); await db.SaveChangesAsync(ct);
        foreach (var key in keys) await storage.DeleteAsync(key, ct);
        return NoContent();
    }

    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete(BulkDeleteRequest request, CancellationToken ct)
    {
        var deleted = 0; var blocked = new List<Guid>();
        foreach (var id in request.Ids)
        {
            var media = await db.Media.Include(x => x.Variants).SingleOrDefaultAsync(x => x.Id == id, ct); if (media is null) continue;
            if (await IsReferenced(id, ct)) { blocked.Add(id); continue; }
            var keys = media.Variants.Select(x => x.StorageKey).Append(media.StorageKey).ToArray(); db.Media.Remove(media); await db.SaveChangesAsync(ct);
            foreach (var key in keys) await storage.DeleteAsync(key, ct); deleted++;
        }
        return Ok(new { deleted, blocked });
    }

    [HttpGet("folders")]
    public async Task<IActionResult> Folders(CancellationToken ct) => Ok(await db.MediaFolders.AsNoTracking().OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.ParentId, x.Year, x.EditionId, mediaCount = db.Media.Count(m => m.FolderId == x.Id) }).ToListAsync(ct));

    [HttpPost("folders/cleanup")]
    public async Task<IActionResult> CleanupFolders(CancellationToken ct)
    {
        var removed = new List<object>();
        while (true)
        {
            var empty = await db.MediaFolders.Where(folder =>
                !db.Media.Any(media => media.FolderId == folder.Id) &&
                !db.MediaFolders.Any(child => child.ParentId == folder.Id) &&
                folder.EditionId == null && (folder.ParentId != null || (folder.Name != "Editions" && folder.Name != "News"))).ToListAsync(ct);
            if (empty.Count == 0) break;
            removed.AddRange(empty.Select(folder => new { folder.Id, folder.Name, folder.ParentId }));
            db.MediaFolders.RemoveRange(empty);
            await db.SaveChangesAsync(ct);
        }
        return Ok(new { removedCount = removed.Count, removed });
    }

    [HttpPost("folders")]
    public async Task<IActionResult> CreateFolder(FolderRequest request, CancellationToken ct)
    {
        var folder = new MediaFolder { Name = request.Name.Trim(), ParentId = request.ParentId, Year = request.Year, EditionId = request.EditionId };
        db.Add(folder); await db.SaveChangesAsync(ct); return Created($"/api/admin/media/folders/{folder.Id}", folder);
    }

    [HttpPut("folders/{id:guid}")]
    public async Task<IActionResult> UpdateFolder(Guid id, FolderRequest request, CancellationToken ct)
    {
        var folder = await db.MediaFolders.FindAsync([id], ct); if (folder is null) return NotFound();
        if (request.ParentId == id) return BadRequest(new { message = "A folder cannot be its own parent." });
        folder.Name = request.Name.Trim(); folder.ParentId = request.ParentId; folder.Year = request.Year; folder.EditionId = request.EditionId;
        await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("folders/{id:guid}")]
    public async Task<IActionResult> DeleteFolder(Guid id, CancellationToken ct)
    {
        var folder = await db.MediaFolders.FindAsync([id], ct); if (folder is null) return NotFound();
        if (await db.Media.AnyAsync(x => x.FolderId == id, ct) || await db.MediaFolders.AnyAsync(x => x.ParentId == id, ct)) return Conflict(new { message = "Only empty folders without child folders can be deleted." });
        db.Remove(folder); await db.SaveChangesAsync(ct); return NoContent();
    }

    private async Task<bool> IsReferenced(Guid id, CancellationToken ct) =>
        await db.Set<NewsMedia>().AnyAsync(x => x.MediaId == id, ct) || await db.Set<GalleryMedia>().AnyAsync(x => x.MediaId == id, ct) ||
        await db.PageContentMedia.AnyAsync(x => x.MediaId == id, ct) || await db.PageContents.AnyAsync(x => x.MediaId == id, ct) ||
        await db.Editions.AnyAsync(x => x.HeroMediaId == id || x.DetailHeaderMediaId == id || x.BackgroundMediaId == id || x.RecapMediaId == id, ct) ||
        await db.ProgramItems.AnyAsync(x => x.PosterMediaId == id || x.TrailerMediaId == id, ct) || await db.News.AnyAsync(x => x.CoverMediaId == id, ct) ||
        await db.Galleries.AnyAsync(x => x.CoverMediaId == id, ct) || await db.Sponsors.AnyAsync(x => x.LogoMediaId == id, ct) || await db.Awards.AnyAsync(x => x.MediaId == id, ct);

    private static string NormalizeCategory(string? value) => string.IsNullOrWhiteSpace(value) ? "other" : value.Trim().ToLowerInvariant();
    private static string? NormalizeTags(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return string.Join(", ", value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase));
    }

    public sealed record UpdateMedia(string? OriginalFilename, string? Alt, string? Caption, string? Credit, Guid? FolderId, string? PosterUrl, int? Year, Guid? EditionId, string Category, string? Tags, Guid? FestivalDayId, Guid? ProgramItemId);
    public sealed record BulkMoveRequest(IReadOnlyList<Guid> Ids, Guid? FolderId);
    public sealed record BulkDeleteRequest(IReadOnlyList<Guid> Ids);
    public sealed record FolderRequest(string Name, Guid? ParentId, int? Year, Guid? EditionId);
}
