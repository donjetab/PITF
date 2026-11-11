using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFestivalDaySectionVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsConferenceVisible",
                table: "FestivalDays",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsHeaderVisible",
                table: "FestivalDays",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsMemoriesVisible",
                table: "FestivalDays",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPageEnabled",
                table: "FestivalDays",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPlayVisible",
                table: "FestivalDays",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRecapVisible",
                table: "FestivalDays",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Preserve every day page that was already public before section-level controls existed.
            // Newly created days retain the false defaults and remain non-clickable until enabled.
            migrationBuilder.Sql("""
                UPDATE [FestivalDays]
                SET [IsPageEnabled] = 1,
                    [IsHeaderVisible] = 1,
                    [IsConferenceVisible] = 1,
                    [IsPlayVisible] = 1,
                    [IsRecapVisible] = 1,
                    [IsMemoriesVisible] = 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsConferenceVisible",
                table: "FestivalDays");

            migrationBuilder.DropColumn(
                name: "IsHeaderVisible",
                table: "FestivalDays");

            migrationBuilder.DropColumn(
                name: "IsMemoriesVisible",
                table: "FestivalDays");

            migrationBuilder.DropColumn(
                name: "IsPageEnabled",
                table: "FestivalDays");

            migrationBuilder.DropColumn(
                name: "IsPlayVisible",
                table: "FestivalDays");

            migrationBuilder.DropColumn(
                name: "IsRecapVisible",
                table: "FestivalDays");
        }
    }
}
