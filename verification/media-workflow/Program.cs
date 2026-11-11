using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Controllers;
using PITF.Api.Data;
using PITF.Api.Models;

await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase("media-workflow-isolated-check").Options);
await db.Database.EnsureCreatedAsync();
var admin = new AdminManagementController(db);
AdminSaveRequest Payload(object values, Guid[]? ids = null, Guid[]? uploaded = null) => new(JsonSerializer.SerializeToElement(values), new() { ["en"] = new() { ["title"] = "Media workflow check" } }, ids ?? [], [], [], []) { UploadedMediaIds = uploaded ?? [] };
async Task<Guid> Create(string resource, AdminSaveRequest payload)
{
    var response = await admin.Create(resource, payload, default);
    if (response is not CreatedResult result) throw new Exception($"Create {resource}: {JsonSerializer.Serialize(response)}");
    return JsonSerializer.SerializeToElement(result.Value).GetProperty("id").GetGuid();
}
void Assert(bool condition, string message) { if (!condition) throw new Exception(message); Console.WriteLine("PASS: " + message); }
async Task<Guid> Photo(string category = "other") { var x = new Media { OriginalFilename = "check.png", Category = category, StorageKey = "check", Url = "/check", Sha256 = Guid.NewGuid().ToString("N") }; db.Media.Add(x); await db.SaveChangesAsync(); return x.Id; }
var storage = new CheckStorage(Path.Combine(Path.GetTempPath(), "pitf-media-check-" + Guid.NewGuid().ToString("N")));
var mediaController = new MediaController(db, storage, new PITF.Api.Storage.ImageVariantService());
async Task<Guid> Upload(Guid editionId, Guid? dayId = null)
{
    await using var stream = new MemoryStream();
    using (var image = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(8, 8)) await SixLabors.ImageSharp.ImageExtensions.SaveAsPngAsync(image, stream);
    stream.Position = 0;
    var file = new Microsoft.AspNetCore.Http.FormFile(stream, 0, stream.Length, "files", "check.png") { Headers = new Microsoft.AspNetCore.Http.HeaderDictionary(), ContentType = "image/png" };
    var result = await mediaController.Upload([file], null, 2000, editionId, "press-conference", null, dayId, null, null, "days", default);
    Assert(result is OkObjectResult, "Direct image upload succeeds");
    return db.Media.Local.Last().Id;
}
try
{
    var stamp = Guid.NewGuid().ToString("N");
    var banner = await Photo();
    var editionId = await Create("editions", Payload(new { number = 97, year = 2097, slug = "media-check-" + stamp, status = "Draft", heroMediaId = banner }, uploaded: [banner]));
    Assert((await db.Media.FindAsync(banner))!.EditionId == editionId, "New edition binds uploaded banner");
    Assert(await db.MediaFolders.CountAsync(x => x.EditionId == editionId) == 2, "Both edition and news year folders created");
    var conference = await Photo("press-conference");
    var dayId = await Create("days", Payload(new { editionId, date = "2097-05-01", dayNumber = 1, conferenceMediaIdsJson = JsonSerializer.Serialize(new[] { conference }) }, uploaded: [conference]));
    var dayMedia = (await db.Media.FindAsync(conference))!;
    Assert(dayMedia.FestivalDayId == dayId && dayMedia.Year == 2097 && dayMedia.Category == "press-conference", "New day inherits edition year and conference category");
    var photo = await Photo("performance");
    var playId = await Create("program", Payload(new { editionId, slug = "play-" + stamp, status = "Draft" }, [photo], [photo]));
    Assert((await db.Media.FindAsync(photo))!.ProgramItemId == playId, "New play photographs bind on first save");
    var newsPhoto = await Photo();
    await Create("news", Payload(new { date = "2098-02-01", slug = "news-" + stamp, status = "Draft", coverMediaId = newsPhoto }, [newsPhoto], [newsPhoto]));
    var newsMedia = (await db.Media.FindAsync(newsPhoto))!;
    var folder = (await db.MediaFolders.FindAsync(newsMedia.FolderId))!;
    Assert(newsMedia.Year == 2098 && newsMedia.EditionId == null && folder.Name == "2098", "Standalone news uses article year");
    await Create("news", Payload(new { editionId, date = "2097-05-01", slug = "reuse-" + stamp, status = "Draft", coverMediaId = conference }, [conference]));
    Assert((await db.Media.FindAsync(conference))!.FestivalDayId == dayId, "Reusing an existing photo leaves its day assignment intact");
    await mediaController.CleanupFolders(default);
    Assert(await db.MediaFolders.CountAsync(x => x.EditionId == editionId) == 2, "Empty edition year folders survive cleanup");
    var uploaded1 = await Upload(editionId, dayId);
    var uploaded2 = await Upload(editionId, dayId);
    Assert(uploaded1 != uploaded2, "Repeated direct uploads retain independent media records");
    var direct = (await db.Media.FindAsync(uploaded1))!;
    Assert(direct.Year == 2097 && direct.FestivalDayId == dayId && direct.FolderId == dayMedia.FolderId, "Upload infers year and folder from day and edition");
    Assert(await db.MediaVariants.CountAsync(x => x.MediaId == uploaded1) == 3, "Upload generates all optimized variants");
    var detached = await Photo();
    await Create("news", Payload(new { date = "2098-02-01", slug = "deselected-" + stamp, status = "Draft" }, uploaded: [detached]));
    Assert((await db.Media.FindAsync(detached))!.FolderId == null, "Deselected uploads are not bound to saved content");
}
finally { await db.Database.EnsureDeletedAsync(); foreach (var file in storage.Files) File.Delete(file); }

sealed class CheckStorage(string root) : PITF.Api.Storage.IMediaStorageService
{
    public List<string> Files { get; } = [];
    public async Task<PITF.Api.Storage.StoredFile> SaveAsync(Stream source, string fileName, CancellationToken ct)
    {
        Directory.CreateDirectory(root);
        var key = Guid.NewGuid().ToString("N") + Path.GetExtension(fileName);
        var path = ResolvePath(key);
        await using var output = File.Create(path);
        await source.CopyToAsync(output, ct);
        Files.Add(path);
        return new(key, "/uploads/" + key, output.Length, "same-hash-for-dedup-test");
    }
    public Task DeleteAsync(string key, CancellationToken ct) { File.Delete(ResolvePath(key)); return Task.CompletedTask; }
    public string ResolvePath(string key) => Path.Combine(root, key);
}
