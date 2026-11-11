using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFestivalDayMemoriesMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MemoriesMediaIdsJson",
                table: "FestivalDays",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE d
                SET ConferenceMediaIdsJson = CASE WHEN ISNULL(d.ConferenceMediaIdsJson, '') IN ('', '[]') THEN
                        COALESCE((SELECT '[' + STRING_AGG('"' + CONVERT(varchar(36), m.Id) + '"', ',') WITHIN GROUP (ORDER BY m.UploadedAt, m.OriginalFilename) + ']'
                                  FROM Media m WHERE m.FestivalDayId = d.Id AND m.Type = 0 AND m.Category = 'press-conference'), '[]')
                        ELSE d.ConferenceMediaIdsJson END,
                    PlayMediaIdsJson = CASE WHEN ISNULL(d.PlayMediaIdsJson, '') IN ('', '[]') THEN
                        COALESCE((SELECT '[' + STRING_AGG('"' + CONVERT(varchar(36), m.Id) + '"', ',') WITHIN GROUP (ORDER BY m.UploadedAt, m.OriginalFilename) + ']'
                                  FROM Media m WHERE m.FestivalDayId = d.Id AND m.Type = 0 AND m.Category IN ('performance', 'opening-ceremony', 'closing-ceremony')), '[]')
                        ELSE d.PlayMediaIdsJson END,
                    MemoriesMediaIdsJson = COALESCE((SELECT '[' + STRING_AGG('"' + CONVERT(varchar(36), m.Id) + '"', ',') WITHIN GROUP (ORDER BY m.UploadedAt, m.OriginalFilename) + ']'
                                  FROM Media m WHERE m.FestivalDayId = d.Id AND m.Type = 0 AND m.Category = 'after-party'), '[]')
                FROM FestivalDays d;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MemoriesMediaIdsJson",
                table: "FestivalDays");
        }
    }
}
