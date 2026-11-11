using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFestivalDayHeaderMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "HeaderMediaId",
                table: "FestivalDays",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HeaderMediaId",
                table: "FestivalDays");
        }
    }
}
