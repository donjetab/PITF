using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260831111500_AddFestivalDayPlayLabelContent")]
public partial class AddFestivalDayPlayLabelContent : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO Translations (Id, EntityType, EntityId, LanguageCode, Field, Value)
            SELECT NEWID(), 'FestivalDay', d.Id, l.Code, 'playLabel', source.Label
            FROM FestivalDays d
            CROSS JOIN Languages l
            CROSS APPLY (
                SELECT COALESCE(
                    (SELECT TOP (1) p.ParticipationType FROM Plays p
                     WHERE p.EditionId = d.EditionId AND CONVERT(date, p.StartsAt) = d.Date
                     ORDER BY p.StartsAt, p.Id),
                    (SELECT TOP (1) CASE a.Type
                        WHEN 'opening-ceremony' THEN 'Opening Ceremony'
                        WHEN 'closing-ceremony' THEN 'Closing Ceremony'
                        WHEN 'performance' THEN 'Performance'
                        ELSE REPLACE(a.Type, '-', ' ')
                     END FROM FestivalActivities a
                     WHERE a.FestivalDayId = d.Id AND a.Type <> 'press-conference'
                     ORDER BY a.[Order], a.StartTime, a.Id)
                ) Label
            ) source
            WHERE l.Code IN ('en', 'sq', 'bs')
              AND NULLIF(LTRIM(RTRIM(source.Label)), '') IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM Translations existing
                  WHERE existing.EntityType = 'FestivalDay' AND existing.EntityId = d.Id
                    AND existing.LanguageCode = l.Code AND existing.Field = 'playLabel'
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DELETE FROM Translations WHERE EntityType = 'FestivalDay' AND Field = 'playLabel';");
    }
}
