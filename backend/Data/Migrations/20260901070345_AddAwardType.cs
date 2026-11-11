using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAwardType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AwardType",
                table: "Awards",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "Best Play Award");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AwardType",
                table: "Awards");
        }
    }
}
