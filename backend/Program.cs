using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PITF.Api.Data;
using PITF.Api.Import;
using PITF.Api.Models;
using PITF.Api.Services;
using PITF.Api.Storage;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<ApplicationDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddIdentityCore<ApplicationUser>(o => { o.Password.RequiredLength = 10; o.User.RequireUniqueEmail = true; })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Configure Jwt:Key.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => o.TokenValidationParameters = new() { ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true, ValidIssuer = builder.Configuration["Jwt:Issuer"], ValidAudience = builder.Configuration["Jwt:Audience"], IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)) });
builder.Services.AddAuthorization(o => { o.AddPolicy("ContentWrite", p => p.RequireRole("SuperAdmin", "Admin", "Editor")); o.AddPolicy("AdminOnly", p => p.RequireRole("SuperAdmin", "Admin")); o.AddPolicy("SuperAdminOnly", p => p.RequireRole("SuperAdmin")); });
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<PublicContentService>();
builder.Services.AddScoped<HistoricalArchiveImporter>();
builder.Services.AddScoped<StructuredContentImporter>();
builder.Services.AddScoped<OrganizedMediaImporter>();
builder.Services.AddScoped<IdentityBootstrapper>();
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddSingleton<IMediaStorageService, LocalMediaStorageService>();
builder.Services.AddSingleton<IImageVariantService, ImageVariantService>();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o => { o.SwaggerDoc("v1", new() { Title = "PITF API", Version = "v1" }); o.AddSecurityDefinition("Bearer", new() { Type = SecuritySchemeType.Http, Scheme = "bearer" }); });
builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"]).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads"));
if (args.Contains("--bootstrap-superadmin", StringComparer.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await database.Database.MigrateAsync();
    var email = Environment.GetEnvironmentVariable("PITF_SUPERADMIN_EMAIL") ?? throw new InvalidOperationException("Set PITF_SUPERADMIN_EMAIL.");
    var password = Environment.GetEnvironmentVariable("PITF_SUPERADMIN_PASSWORD") ?? throw new InvalidOperationException("Set PITF_SUPERADMIN_PASSWORD.");
    var resetPassword = bool.TryParse(Environment.GetEnvironmentVariable("PITF_SUPERADMIN_RESET_PASSWORD"), out var reset) && reset;
    var user = await scope.ServiceProvider.GetRequiredService<IdentityBootstrapper>().EnsureSuperAdminAsync(email, password, resetPassword);
    Console.WriteLine($"SuperAdmin ready: {user.Email}");
    return;
}
if (args.Contains("--import", StringComparer.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await database.Database.MigrateAsync();
    var root = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "frontend", "src", "News"));
    var result = await scope.ServiceProvider.GetRequiredService<HistoricalArchiveImporter>().RunAsync(root, CancellationToken.None);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(result));
    var structured = await scope.ServiceProvider.GetRequiredService<StructuredContentImporter>().RunAsync(root, CancellationToken.None);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(structured));
    return;
}
if (args.Contains("--import-organized-media", StringComparer.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await database.Database.MigrateAsync();
    var root = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "media"));
    var result = await scope.ServiceProvider.GetRequiredService<OrganizedMediaImporter>().RunAsync(root, CancellationToken.None);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(result));
    return;
}
app.UseResponseCompression(); app.UseSwagger(); app.UseSwaggerUI(); app.UseStaticFiles(); app.UseCors("Frontend"); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers(); app.Run();
public partial class Program { }
