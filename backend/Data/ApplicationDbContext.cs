using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Models;

namespace PITF.Api.Data;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Translation> Translations => Set<Translation>(); public DbSet<Language> Languages => Set<Language>(); public DbSet<SiteSetting> SiteSettings => Set<SiteSetting>(); public DbSet<PageContent> PageContents => Set<PageContent>(); public DbSet<PageContentMedia> PageContentMedia => Set<PageContentMedia>(); public DbSet<NavigationItem> NavigationItems => Set<NavigationItem>();
    public DbSet<Edition> Editions => Set<Edition>(); public DbSet<FestivalDay> FestivalDays => Set<FestivalDay>(); public DbSet<FestivalActivity> FestivalActivities => Set<FestivalActivity>(); public DbSet<ProgramItem> ProgramItems => Set<ProgramItem>(); public DbSet<PlayCredit> PlayCredits => Set<PlayCredit>(); public DbSet<PlayTranslation> PlayTranslations => Set<PlayTranslation>(); public DbSet<News> News => Set<News>();
    public DbSet<MediaFolder> MediaFolders => Set<MediaFolder>(); public DbSet<Media> Media => Set<Media>(); public DbSet<MediaVariant> MediaVariants => Set<MediaVariant>(); public DbSet<Gallery> Galleries => Set<Gallery>(); public DbSet<Sponsor> Sponsors => Set<Sponsor>(); public DbSet<Award> Awards => Set<Award>(); public DbSet<ExternalLink> ExternalLinks => Set<ExternalLink>(); public DbSet<HomepageSection> HomepageSections => Set<HomepageSection>(); public DbSet<HomepageSelection> HomepageSelections => Set<HomepageSelection>(); public DbSet<ImportRun> ImportRuns => Set<ImportRun>();
    protected override void OnModelCreating(ModelBuilder b) {
        base.OnModelCreating(b);
        b.Entity<Language>().HasIndex(x => x.Code).IsUnique(); b.Entity<SiteSetting>().HasIndex(x => x.Key).IsUnique(); b.Entity<PageContent>().HasIndex(x => new { x.PageKey, x.SectionKey }).IsUnique(); b.Entity<NavigationItem>().HasIndex(x => x.Key).IsUnique();
        b.Entity<Translation>().HasIndex(x => new { x.EntityType, x.EntityId, x.LanguageCode, x.Field }).IsUnique(); b.Entity<Translation>().HasIndex(x => new { x.EntityType, x.EntityId });
        b.Entity<Edition>().HasIndex(x => x.Number).IsUnique(); b.Entity<Edition>().HasIndex(x => x.Year).IsUnique(); b.Entity<Edition>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<FestivalDay>().HasIndex(x => new { x.EditionId, x.DayNumber }).IsUnique(); b.Entity<ProgramItem>().ToTable("Plays"); b.Entity<ProgramItem>().HasIndex(x => new { x.EditionId, x.Slug }).IsUnique(); b.Entity<PlayCredit>().HasIndex(x => new { x.PlayId, x.Order }); b.Entity<PlayTranslation>().HasKey(x => new { x.PlayId, x.LanguageCode }); b.Entity<News>().HasIndex(x => x.Slug).IsUnique(); b.Entity<News>().HasIndex(x => new { x.Status, x.PublishedAt });
        b.Entity<Media>().Property(x => x.Category).HasDefaultValue("other"); b.Entity<Media>().HasIndex(x => x.Sha256); b.Entity<Media>().HasIndex(x => new { x.FolderId, x.Type, x.UploadedAt }); b.Entity<Media>().HasIndex(x => new { x.EditionId, x.Category }); b.Entity<MediaFolder>().HasIndex(x => new { x.ParentId, x.Name }).IsUnique(); b.Entity<MediaVariant>().HasIndex(x => new { x.MediaId, x.Name }).IsUnique();
        b.Entity<NewsMedia>().HasKey(x => new { x.NewsId, x.MediaId }); b.Entity<GalleryMedia>().HasKey(x => new { x.GalleryId, x.MediaId }); b.Entity<PageContentMedia>().HasKey(x => new { x.PageContentId, x.MediaId }); b.Entity<SponsorEdition>().HasKey(x => new { x.SponsorId, x.EditionId });
        b.Entity<HomepageSection>().HasIndex(x => x.Key).IsUnique(); b.Entity<HomepageSelection>().HasIndex(x => new { x.HomepageSectionId, x.EntityType, x.EntityId }).IsUnique(); b.Entity<ImportRun>().HasIndex(x => new { x.SourceKey, x.Fingerprint }).IsUnique();
        b.Entity<FestivalDay>().HasOne(x => x.Edition).WithMany(x => x.Days).OnDelete(DeleteBehavior.Cascade); b.Entity<ProgramItem>().HasOne(x => x.Edition).WithMany(x => x.ProgramItems).OnDelete(DeleteBehavior.Restrict); b.Entity<PlayCredit>().HasOne(x => x.Play).WithMany(x => x.Credits).OnDelete(DeleteBehavior.Cascade); b.Entity<PlayTranslation>().HasOne(x => x.Play).WithMany(x => x.Translations).OnDelete(DeleteBehavior.Cascade); b.Entity<PlayTranslation>().HasOne(x => x.Language).WithMany().HasPrincipalKey(x => x.Code).HasForeignKey(x => x.LanguageCode).OnDelete(DeleteBehavior.Restrict); b.Entity<News>().HasOne(x => x.Edition).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.Entity<MediaFolder>().HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict); b.Entity<Media>().HasOne(x => x.Folder).WithMany().OnDelete(DeleteBehavior.SetNull);
        b.Entity<PageContentMedia>().HasOne(x => x.PageContent).WithMany(x => x.MediaItems).OnDelete(DeleteBehavior.Cascade); b.Entity<PageContentMedia>().HasOne(x => x.Media).WithMany().OnDelete(DeleteBehavior.Restrict);
        foreach (var type in b.Model.GetEntityTypes()) foreach (var property in type.GetProperties().Where(p => p.ClrType == typeof(string))) property.SetMaxLength(property.Name is "Value" or "ContentJson" or "ConfigurationJson" or "ConferenceMediaIdsJson" or "PlayMediaIdsJson" or "MemoriesMediaIdsJson" ? null : 500);
        b.Entity<PlayTranslation>().Property(x => x.Description).Metadata.SetMaxLength(null); b.Entity<PlayTranslation>().Property(x => x.Synopsis).Metadata.SetMaxLength(null);
    }
}
