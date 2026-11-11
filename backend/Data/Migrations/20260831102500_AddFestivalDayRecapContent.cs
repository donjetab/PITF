using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260831102500_AddFestivalDayRecapContent")]
public partial class AddFestivalDayRecapContent : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(name: "RecapMediaId", table: "FestivalDays", type: "uniqueidentifier", nullable: true);

        migrationBuilder.Sql("""
            UPDATE d SET RecapMediaId = recap.Id
            FROM FestivalDays d
            OUTER APPLY (
                SELECT TOP (1) m.Id FROM Media m
                WHERE m.FestivalDayId = d.Id AND m.Type = 1 AND m.Category = 'recap'
                ORDER BY m.UploadedAt, m.Id
            ) recap
            WHERE d.RecapMediaId IS NULL AND recap.Id IS NOT NULL;

            ;WITH ConferenceValues AS (
                SELECT d.Id DayId, t.LanguageCode,
                       MAX(CASE WHEN t.Field = 'title' THEN t.Value END) ConferenceTitle,
                       COALESCE(MAX(CASE WHEN t.Field = 'body' THEN t.Value END), MAX(CASE WHEN t.Field = 'description' THEN t.Value END)) ConferenceText
                FROM FestivalDays d
                CROSS APPLY (
                    SELECT TOP (1) a.Id FROM FestivalActivities a
                    WHERE a.FestivalDayId = d.Id AND a.Type = 'press-conference'
                    ORDER BY a.[Order], a.StartTime, a.Id
                ) activity
                JOIN Translations t ON t.EntityType = 'FestivalActivity' AND t.EntityId = activity.Id
                GROUP BY d.Id, t.LanguageCode
            )
            INSERT INTO Translations (Id, EntityType, EntityId, LanguageCode, Field, Value)
            SELECT NEWID(), 'FestivalDay', DayId, LanguageCode, valuesToAdd.Field, valuesToAdd.Value
            FROM ConferenceValues
            CROSS APPLY (VALUES ('conferenceTitle', ConferenceTitle), ('conferenceText', ConferenceText)) valuesToAdd(Field, Value)
            WHERE NULLIF(LTRIM(RTRIM(valuesToAdd.Value)), '') IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM Translations existing WHERE existing.EntityType = 'FestivalDay' AND existing.EntityId = DayId AND existing.LanguageCode = LanguageCode AND existing.Field = valuesToAdd.Field);

            ;WITH DayPlays AS (
                SELECT d.Id DayId, p.Id PlayId,
                       ROW_NUMBER() OVER (PARTITION BY d.Id ORDER BY p.StartsAt, p.Id) rowNumber
                FROM FestivalDays d
                JOIN Plays p ON p.EditionId = d.EditionId AND CONVERT(date, p.StartsAt) = d.Date
            ), PlayValues AS (
                SELECT dp.DayId, pt.LanguageCode, pt.Title PlayTitle, COALESCE(pt.Synopsis, pt.Description) PlayText
                FROM DayPlays dp JOIN PlayTranslations pt ON pt.PlayId = dp.PlayId
                WHERE dp.rowNumber = 1
            )
            INSERT INTO Translations (Id, EntityType, EntityId, LanguageCode, Field, Value)
            SELECT NEWID(), 'FestivalDay', DayId, LanguageCode, valuesToAdd.Field, valuesToAdd.Value
            FROM PlayValues
            CROSS APPLY (VALUES ('playTitle', PlayTitle), ('playText', PlayText)) valuesToAdd(Field, Value)
            WHERE NULLIF(LTRIM(RTRIM(valuesToAdd.Value)), '') IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM Translations existing WHERE existing.EntityType = 'FestivalDay' AND existing.EntityId = DayId AND existing.LanguageCode = LanguageCode AND existing.Field = valuesToAdd.Field);

            INSERT INTO Translations (Id, EntityType, EntityId, LanguageCode, Field, Value)
            SELECT NEWID(), 'FestivalDay', d.Id, l.Code, defaults.Field, defaults.Value
            FROM FestivalDays d
            CROSS JOIN Languages l
            CROSS APPLY (VALUES
                ('recapTitle', CASE l.Code WHEN 'sq' THEN N'Dita me një vështrim' WHEN 'bs' THEN N'Dan ukratko' ELSE N'The Day in a Glance' END),
                ('recapText', CASE l.Code WHEN 'sq' THEN N'Një vështrim i shkurtër mbi shfaqjet, bisedat dhe takimet që formësuan ditën e festivalit.' WHEN 'bs' THEN N'Kratak osvrt na predstave, razgovore i susrete koji su obilježili festivalski dan.' ELSE N'A short look back at the performances, conversations and encounters that shaped the festival day.' END)
            ) defaults(Field, Value)
            WHERE l.Code IN ('en', 'sq', 'bs')
              AND NOT EXISTS (SELECT 1 FROM Translations existing WHERE existing.EntityType = 'FestivalDay' AND existing.EntityId = d.Id AND existing.LanguageCode = l.Code AND existing.Field = defaults.Field);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DELETE FROM Translations WHERE EntityType = 'FestivalDay' AND Field IN ('recapTitle', 'recapText');");
        migrationBuilder.DropColumn(name: "RecapMediaId", table: "FestivalDays");
    }
}
