using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260831142500_AddFestivalDayRecapLabels")]
public partial class AddFestivalDayRecapLabels : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO Translations (Id, EntityType, EntityId, LanguageCode, Field, Value)
            SELECT NEWID(), 'FestivalDay', d.Id, l.Code, labels.Field, labels.Value
            FROM FestivalDays d
            CROSS JOIN Languages l
            CROSS APPLY (VALUES
                ('recapKicker', CASE l.Code WHEN 'sq' THEN CONCAT('Përmbledhja e ditës ', d.DayNumber) WHEN 'bs' THEN CONCAT('Pregled ', d.DayNumber, '. dana') ELSE CONCAT('Day ', d.DayNumber, ' recap') END),
                ('recapMediaLabel', CASE l.Code WHEN 'sq' THEN N'Filmi i festivalit' WHEN 'bs' THEN N'Festivalski film' ELSE N'Festival film' END),
                ('recapPlayLabel', CASE l.Code WHEN 'sq' THEN N'Luaj përmbledhjen' WHEN 'bs' THEN N'Pusti pregled' ELSE N'Play recap' END)
            ) labels(Field, Value)
            WHERE l.Code IN ('en', 'sq', 'bs')
              AND NOT EXISTS (SELECT 1 FROM Translations existing WHERE existing.EntityType = 'FestivalDay' AND existing.EntityId = d.Id AND existing.LanguageCode = l.Code AND existing.Field = labels.Field);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DELETE FROM Translations WHERE EntityType = 'FestivalDay' AND Field IN ('recapKicker', 'recapMediaLabel', 'recapPlayLabel');");
    }
}
