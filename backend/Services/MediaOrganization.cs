using Microsoft.EntityFrameworkCore;
using PITF.Api.Data;
using PITF.Api.Models;

namespace PITF.Api.Services;

public static class MediaOrganization
{
    public static async Task<MediaFolder> FolderAsync(ApplicationDbContext db, string source, int? year, Guid? editionId, CancellationToken ct)
    {
        var rootName = source == "news" ? "News" : source is "editions" or "days" or "program" or "galleries" or "awards" ? "Editions" : "Website";
        var root = await EnsureAsync(db, rootName, null, null, null, ct);
        return year.HasValue ? await EnsureAsync(db, year.Value.ToString(), root.Id, year, editionId, ct) : root;
    }

    private static async Task<MediaFolder> EnsureAsync(ApplicationDbContext db, string name, Guid? parentId, int? year, Guid? editionId, CancellationToken ct)
    {
        var folder = db.MediaFolders.Local.FirstOrDefault(x => x.Name == name && x.ParentId == parentId)
            ?? await db.MediaFolders.FirstOrDefaultAsync(x => x.Name == name && x.ParentId == parentId, ct);
        if (folder is null)
        {
            folder = new MediaFolder { Name = name, ParentId = parentId, Year = year, EditionId = editionId };
            db.MediaFolders.Add(folder);
        }
        else if (editionId.HasValue) folder.EditionId = editionId;
        return folder;
    }
}
