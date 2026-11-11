using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProgramParticipationType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ParticipationType",
                table: "ProgramItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "Official Competition");

            migrationBuilder.Sql("""
                UPDATE p
                SET p.ParticipationType = 'Guest Performance'
                FROM ProgramItems p
                WHERE p.Slug LIKE '%guest%'
                   OR EXISTS (
                       SELECT 1
                       FROM Translations t
                       WHERE t.EntityType = 'ProgramItem'
                         AND t.EntityId = p.Id
                         AND t.Field = 'title'
                         AND LOWER(t.Value) LIKE '%guest play%'
                   );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ParticipationType",
                table: "ProgramItems");
        }
    }
}
