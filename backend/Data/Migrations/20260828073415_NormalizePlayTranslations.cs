using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations;

public partial class NormalizePlayTranslations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "FK_ProgramCredits_Plays_ProgramItemId", table: "ProgramCredits");
        migrationBuilder.DropPrimaryKey(name: "PK_ProgramCredits", table: "ProgramCredits");
        migrationBuilder.RenameTable(name: "ProgramCredits", newName: "PlayCredits");
        migrationBuilder.RenameColumn(name: "ProgramItemId", table: "PlayCredits", newName: "PlayId");
        migrationBuilder.RenameIndex(name: "IX_ProgramCredits_ProgramItemId_Order", table: "PlayCredits", newName: "IX_PlayCredits_PlayId_Order");
        migrationBuilder.AddPrimaryKey(name: "PK_PlayCredits", table: "PlayCredits", column: "Id");
        migrationBuilder.AddForeignKey(name: "FK_PlayCredits_Plays_PlayId", table: "PlayCredits", column: "PlayId", principalTable: "Plays", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddUniqueConstraint(name: "AK_Languages_Code", table: "Languages", column: "Code");

        migrationBuilder.CreateTable(
            name: "PlayTranslations",
            columns: table => new
            {
                PlayId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                LanguageCode = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                Country = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                Company = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                Synopsis = table.Column<string>(type: "nvarchar(max)", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PlayTranslations", x => new { x.PlayId, x.LanguageCode });
                table.ForeignKey("FK_PlayTranslations_Languages_LanguageCode", x => x.LanguageCode, "Languages", "Code", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_PlayTranslations_Plays_PlayId", x => x.PlayId, "Plays", "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_PlayTranslations_LanguageCode", table: "PlayTranslations", column: "LanguageCode");

        migrationBuilder.Sql("""
            INSERT INTO PlayTranslations (PlayId, LanguageCode, Title, Country, Company, Description, Synopsis)
            SELECT EntityId, LanguageCode,
                   MAX(CASE WHEN Field = 'title' THEN Value END),
                   MAX(CASE WHEN Field = 'country' THEN Value END),
                   MAX(CASE WHEN Field = 'company' THEN Value END),
                   MAX(CASE WHEN Field = 'description' THEN Value END),
                   MAX(CASE WHEN Field = 'synopsis' THEN Value END)
            FROM Translations
            WHERE EntityType = 'ProgramItem' AND Field IN ('title', 'country', 'company', 'description', 'synopsis')
            GROUP BY EntityId, LanguageCode;

            DELETE FROM Translations WHERE EntityType = 'ProgramItem';
            """);
        migrationBuilder.DropColumn(name: "Title", table: "Plays");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "Title", table: "Plays", type: "nvarchar(500)", maxLength: 500, nullable: false, defaultValue: "");
        migrationBuilder.Sql("""
            UPDATE p SET Title = COALESCE(pt.Title, p.Slug)
            FROM Plays p
            OUTER APPLY (SELECT TOP (1) Title FROM PlayTranslations t WHERE t.PlayId = p.Id AND t.Title IS NOT NULL ORDER BY CASE t.LanguageCode WHEN 'sq' THEN 0 WHEN 'en' THEN 1 WHEN 'bs' THEN 2 ELSE 3 END) pt;

            INSERT INTO Translations (Id, EntityType, EntityId, LanguageCode, Field, Value)
            SELECT NEWID(), 'ProgramItem', PlayId, LanguageCode, v.Field, v.Value
            FROM PlayTranslations
            CROSS APPLY (VALUES ('title', Title), ('country', Country), ('company', Company), ('description', Description), ('synopsis', Synopsis)) v(Field, Value)
            WHERE v.Value IS NOT NULL;
            """);
        migrationBuilder.DropTable(name: "PlayTranslations");
        migrationBuilder.DropUniqueConstraint(name: "AK_Languages_Code", table: "Languages");
        migrationBuilder.DropForeignKey(name: "FK_PlayCredits_Plays_PlayId", table: "PlayCredits");
        migrationBuilder.DropPrimaryKey(name: "PK_PlayCredits", table: "PlayCredits");
        migrationBuilder.RenameTable(name: "PlayCredits", newName: "ProgramCredits");
        migrationBuilder.RenameColumn(name: "PlayId", table: "ProgramCredits", newName: "ProgramItemId");
        migrationBuilder.RenameIndex(name: "IX_PlayCredits_PlayId_Order", table: "ProgramCredits", newName: "IX_ProgramCredits_ProgramItemId_Order");
        migrationBuilder.AddPrimaryKey(name: "PK_ProgramCredits", table: "ProgramCredits", column: "Id");
        migrationBuilder.AddForeignKey(name: "FK_ProgramCredits_Plays_ProgramItemId", table: "ProgramCredits", column: "ProgramItemId", principalTable: "Plays", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
    }
}
