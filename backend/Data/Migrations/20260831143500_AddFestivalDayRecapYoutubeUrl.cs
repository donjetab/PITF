using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260831143500_AddFestivalDayRecapYoutubeUrl")]
public partial class AddFestivalDayRecapYoutubeUrl : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.AddColumn<string>(name: "RecapYoutubeUrl", table: "FestivalDays", type: "nvarchar(max)", nullable: true);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropColumn(name: "RecapYoutubeUrl", table: "FestivalDays");
}
