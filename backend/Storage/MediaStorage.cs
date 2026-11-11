using System.Security.Cryptography;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace PITF.Api.Storage;
public record StoredFile(string Key, string Url, long Size, string Sha256);
public interface IMediaStorageService { Task<StoredFile> SaveAsync(Stream source, string fileName, CancellationToken ct); Task DeleteAsync(string key, CancellationToken ct); string ResolvePath(string key); }
public sealed class LocalMediaStorageService(IWebHostEnvironment environment) : IMediaStorageService {
    private readonly string root = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads");
    public async Task<StoredFile> SaveAsync(Stream source, string fileName, CancellationToken ct) { var now=DateTime.UtcNow; var ext=Path.GetExtension(fileName).ToLowerInvariant(); var key=$"{now:yyyy/MM}/{Guid.NewGuid():N}{ext}"; var path=ResolvePath(key); Directory.CreateDirectory(Path.GetDirectoryName(path)!); await using var output=File.Create(path); using var hash=IncrementalHash.CreateHash(HashAlgorithmName.SHA256); var buffer=new byte[81920]; int read; long size=0; while((read=await source.ReadAsync(buffer,ct))>0){ await output.WriteAsync(buffer.AsMemory(0,read),ct); hash.AppendData(buffer,0,read); size+=read; } return new(key,$"/uploads/{key.Replace('\\','/')}",size,Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant()); }
    public Task DeleteAsync(string key,CancellationToken ct){var path=ResolvePath(key);if(File.Exists(path))File.Delete(path);return Task.CompletedTask;}
    public string ResolvePath(string key){var path=Path.GetFullPath(Path.Combine(root,key));if(!path.StartsWith(Path.GetFullPath(root),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Invalid storage key.");return path;}
}
public interface IImageVariantService { Task<IReadOnlyList<(string Name,StoredFile File,int Width,int Height)>> CreateAsync(string originalPath,IMediaStorageService storage,CancellationToken ct); }
public sealed class ImageVariantService : IImageVariantService { public async Task<IReadOnlyList<(string,StoredFile,int,int)>> CreateAsync(string path,IMediaStorageService storage,CancellationToken ct){using var image=await Image.LoadAsync(path,ct);var result=new List<(string,StoredFile,int,int)>();foreach(var spec in new[]{("large",1920),("medium",960),("thumbnail",360)}){using var copy=image.Clone(x=>x.Resize(new ResizeOptions{Mode=ResizeMode.Max,Size=new Size(spec.Item2,spec.Item2)}));await using var ms=new MemoryStream();await copy.SaveAsync(ms,new WebpEncoder{Quality=82},ct);ms.Position=0;var saved=await storage.SaveAsync(ms,$"{spec.Item1}.webp",ct);result.Add((spec.Item1,saved,copy.Width,copy.Height));}return result;}}
