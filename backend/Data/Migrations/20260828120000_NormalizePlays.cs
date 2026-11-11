using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260828120000_NormalizePlays")]
public partial class NormalizePlays : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameTable(name: "ProgramItems", newName: "Plays");
        migrationBuilder.RenameIndex(name: "IX_ProgramItems_EditionId_Slug", table: "Plays", newName: "IX_Plays_EditionId_Slug");
        migrationBuilder.AddColumn<string>(name: "Title", table: "Plays", type: "nvarchar(500)", maxLength: 500, nullable: false, defaultValue: "");

        migrationBuilder.Sql("""
            UPDATE p SET p.Title = COALESCE(
                (SELECT TOP (1) t.Value FROM Translations t WHERE t.EntityType = 'ProgramItem' AND t.EntityId = p.Id AND t.Field = 'title' ORDER BY CASE t.LanguageCode WHEN 'sq' THEN 0 WHEN 'en' THEN 1 WHEN 'bs' THEN 2 ELSE 3 END),
                p.Slug)
            FROM Plays p;
            """);

        migrationBuilder.CreateTable(
            name: "ProgramCredits",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                ProgramItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                Role = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                Order = table.Column<int>(type: "int", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProgramCredits", x => x.Id);
                table.ForeignKey("FK_ProgramCredits_Plays_ProgramItemId", x => x.ProgramItemId, "Plays", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.Sql("""
            INSERT INTO ProgramCredits (Id, ProgramItemId, Role, Name, [Order])
            SELECT NEWID(), p.Id, COALESCE(JSON_VALUE(j.value, '$.role'), ''), COALESCE(JSON_VALUE(j.value, '$.name'), ''), CONVERT(int, j.[key])
            FROM Plays p CROSS APPLY OPENJSON(CASE WHEN ISJSON(p.Credits) = 1 AND LEFT(LTRIM(p.Credits), 1) = '[' THEN p.Credits ELSE '[]' END) j
            WHERE COALESCE(JSON_VALUE(j.value, '$.role'), '') <> '' OR COALESCE(JSON_VALUE(j.value, '$.name'), '') <> '';

            INSERT INTO ProgramCredits (Id, ProgramItemId, Role, Name, [Order])
            SELECT NEWID(), p.Id, 'Other credits', p.Credits, 0 FROM Plays p
            WHERE NULLIF(LTRIM(RTRIM(p.Credits)), '') IS NOT NULL
              AND NOT (ISJSON(p.Credits) = 1 AND LEFT(LTRIM(p.Credits), 1) = '[');
            """);

        migrationBuilder.CreateIndex(name: "IX_ProgramCredits_ProgramItemId_Order", table: "ProgramCredits", columns: new[] { "ProgramItemId", "Order" });
        migrationBuilder.DropColumn(name: "Credits", table: "Plays");
        migrationBuilder.DropColumn(name: "EndsAt", table: "Plays");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "Credits", table: "Plays", type: "nvarchar(max)", nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(name: "EndsAt", table: "Plays", type: "datetimeoffset", nullable: true);
        migrationBuilder.Sql("""
            UPDATE p SET Credits = (SELECT Role AS [role], Name AS [name] FROM ProgramCredits pc WHERE pc.ProgramItemId = p.Id ORDER BY pc.[Order] FOR JSON PATH)
            FROM Plays p;
            """);
        migrationBuilder.DropTable(name: "ProgramCredits");
        migrationBuilder.DropColumn(name: "Title", table: "Plays");
        migrationBuilder.RenameIndex(name: "IX_Plays_EditionId_Slug", table: "Plays", newName: "IX_ProgramItems_EditionId_Slug");
        migrationBuilder.RenameTable(name: "Plays", newName: "ProgramItems");
    }
}
