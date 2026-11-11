using System.Text.Json;

namespace PITF.Api.DTOs;

public sealed record MediaVariantDto(string Name, string Url, int Width, int Height, long FileSize, string MimeType);
public sealed record MediaFolderDto(Guid Id, string Name, int? Year, Guid? ParentId);
public sealed record MediaDto(Guid Id, string Type, string OriginalUrl, string? ThumbnailUrl, string? MediumUrl,
    string? LargeUrl, string? VideoPosterUrl, string? Alt, string? Caption, string? Credit, int? Width,
    int? Height, double? DurationSeconds, long FileSize, string MimeType, MediaFolderDto? Folder,
    IReadOnlyList<MediaVariantDto> Variants, IReadOnlyList<string> Relationships, string OriginalFilename,
    DateTimeOffset UploadedAt, int? Year, Guid? EditionId, string Category, string? Tags,
    Guid? FestivalDayId, Guid? ProgramItemId);
public sealed record LinkDto(string Label, string Url, string Target);
public sealed record ContentMediaDto(string Role, int Order, MediaDto Media);
public sealed record ProgramDto(Guid Id, string Slug, string ParticipationType, string? Country, string? Company, string? Director,
    string? Credits, DateTimeOffset? StartsAt, string? Venue, string Status,
    DateTimeOffset? PublishedAt, int Order, Dictionary<string, Dictionary<string, string>> Translations,
    MediaDto? Poster, MediaDto? Trailer);
public sealed record ActivityDto(Guid Id, string Type, TimeOnly? StartTime, TimeOnly? EndTime, string? Venue,
    int Order, Guid? ProgramItemId, Dictionary<string, Dictionary<string, string>> Translations);
public sealed record FestivalDayDto(Guid Id, DateOnly Date, int DayNumber, int Order, bool IsPageEnabled,
    bool IsHeaderVisible, bool IsConferenceVisible, bool IsPlayVisible, bool IsRecapVisible, bool IsMemoriesVisible,
    string? RecapYoutubeUrl,
    Dictionary<string, Dictionary<string, string>> Translations, IReadOnlyList<ActivityDto> Activities,
    MediaDto? HeaderMedia, MediaDto? RecapMedia, IReadOnlyList<MediaDto> ConferenceMedia, IReadOnlyList<MediaDto> PlayMedia, IReadOnlyList<MediaDto> MemoriesMedia);
public sealed record GalleryDto(Guid Id, Guid? EditionId, Guid? FestivalDayId, Guid? ActivityId,
    Guid? ProgramItemId, string Status, int Order, Dictionary<string, Dictionary<string, string>> Translations,
    MediaDto? Cover, IReadOnlyList<MediaDto> Media);
public sealed record SponsorDto(Guid Id, string Name, string? Url, string? Category, int Order, MediaDto? Logo);
public sealed record AwardDto(Guid Id, string AwardType, string Recipient, string? Person, string? Country, Guid? ProgramItemId,
    int Order, Dictionary<string, Dictionary<string, string>> Translations, MediaDto? Media);
public sealed record EditionSummaryDto(Guid Id, int Number, int Year, DateOnly? StartDate, DateOnly? EndDate,
    string Slug, string? PrimaryColor, string? SecondaryColor, int Order, Dictionary<string, Dictionary<string, string>> Translations,
    MediaDto? HeroMedia, MediaDto? DetailHeaderMedia, MediaDto? BackgroundMedia);
public sealed record EditionDetailDto(EditionSummaryDto Edition, MediaDto? RecapMedia,
    Dictionary<string, Dictionary<string, string>> RecapTranslations, IReadOnlyList<FestivalDayDto> Days,
    IReadOnlyList<ProgramDto> Program, IReadOnlyList<NewsCardDto> News, IReadOnlyList<GalleryDto> Galleries,
    IReadOnlyList<SponsorDto> Sponsors, IReadOnlyList<AwardDto> Awards);
public sealed record FeaturedEditionDto(EditionSummaryDto Edition);
public sealed record NewsCardDto(Guid Id, Guid? EditionId, string Slug, DateOnly Date, string? Category,
    string ContentMode, string? ExternalUrl, string ExternalTarget, bool IsExternalOnly,
    Dictionary<string, Dictionary<string, string>> Translations, MediaDto? CoverMedia,
    string? CardThumbnailUrl, string? CardThumbnailSource);
public sealed record NewsDetailDto(NewsCardDto Card, Guid? FestivalDayId, Guid? ActivityId,
    Guid? ProgramItemId, string Status, DateTimeOffset? PublishedAt, int Order, IReadOnlyList<MediaDto> Media,
    IReadOnlyList<LinkDto> ExternalLinks);
public sealed record PageContentDto(Guid Id, string PageKey, string SectionKey, int Order, JsonElement Content,
    MediaDto? Media, IReadOnlyList<ContentMediaDto> MediaItems, Dictionary<string, Dictionary<string, string>> Translations);
public sealed record NavigationDto(Guid Id, string Key, string Url, string Target, Guid? ParentId, int Order,
    Dictionary<string, Dictionary<string, string>> Translations);
public sealed record HomepageSectionDto(Guid Id, string Key, bool IsVisible, int Order, string SelectionMode,
    Guid? SelectedEditionId, int? ItemLimit, JsonElement Configuration);
public sealed record HomepageDto(IReadOnlyList<HomepageSectionDto> Sections, IReadOnlyList<PageContentDto> Hero,
    IReadOnlyList<PageContentDto> AboutPreview, FeaturedEditionDto? FeaturedEdition,
    IReadOnlyList<ProgramDto> FeaturedProgram, IReadOnlyList<NewsCardDto> FeaturedNews,
    IReadOnlyList<EditionSummaryDto> Editions, IReadOnlyList<SponsorDto> Sponsors,
    IReadOnlyList<PageContentDto> NewsletterCta);
public sealed record PagedResultDto<T>(int Page, int PageSize, int Total, int TotalPages, IReadOnlyList<T> Items);
