using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Services;

namespace PITF.Api.Controllers;

[ApiController]
[Route("api/public")]
public sealed class PublicContentController(PublicContentService content, ApplicationDbContext db) : ControllerBase
{
    [HttpGet("homepage")]
    public async Task<IActionResult> Homepage(CancellationToken ct) => Ok(await content.HomepageAsync(ct));

    [HttpGet("about")]
    public async Task<IActionResult> About(CancellationToken ct) => Ok(await content.PagesAsync("about", ct));

    [HttpGet("editions")]
    public async Task<IActionResult> Editions(CancellationToken ct) => Ok(await content.EditionsAsync(ct));

    [HttpGet("editions/{slug}")]
    public async Task<IActionResult> Edition(string slug, CancellationToken ct)
    {
        var result = await content.EditionAsync(slug, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("news")]
    public async Task<IActionResult> News(Guid? editionId, int page = 1, int pageSize = 20, CancellationToken ct = default)
        => Ok(await content.NewsAsync(editionId, page, pageSize, ct));

    [HttpGet("news/{slug}")]
    public async Task<IActionResult> NewsItem(string slug, CancellationToken ct)
    {
        var result = await content.NewsDetailAsync(slug, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("site")]
    public async Task<IActionResult> Site(CancellationToken ct) => Ok(await content.SiteAsync(ct));

    [HttpGet("contact")]
    public async Task<IActionResult> Contact(CancellationToken ct) => Ok(new
    {
        settings = await db.SiteSettings.AsNoTracking().Where(x => !x.IsCritical && (x.Group == "contact" || x.Group == "social" || x.Key.Contains("contact") || x.Key.Contains("email") || x.Key.Contains("phone") || x.Key.Contains("address") || x.Key.Contains("reservation"))).OrderBy(x => x.Key).Select(x => new { x.Key, x.Value, x.ValueType, x.Group }).ToListAsync(ct),
        content = await content.PagesAsync("contact", ct)
    });

    [HttpGet("navigation")]
    public async Task<IActionResult> Navigation(CancellationToken ct) => Ok(await content.NavigationAsync(ct));

    [HttpGet("footer")]
    public async Task<IActionResult> Footer(CancellationToken ct) => Ok(new
    {
        settings = await db.SiteSettings.AsNoTracking().Where(x => !x.IsCritical && (x.Group == "footer" || x.Group == "social" || x.Group == "contact")).OrderBy(x => x.Key).Select(x => new { x.Key, x.Value, x.ValueType, x.Group }).ToListAsync(ct),
        content = await content.PagesAsync("footer", ct)
    });

    [HttpGet("media/{id:guid}")]
    public async Task<IActionResult> Media(Guid id, CancellationToken ct)
    {
        var result = await content.MediaAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("media")]
    public async Task<IActionResult> MediaList(int page = 1, int pageSize = 50, string? type = null, CancellationToken ct = default)
        => Ok(await content.MediaListAsync(page, pageSize, type, ct));
}
