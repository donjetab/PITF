using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260828172000_AddEditionDetailHeaderMedia")]
public partial class AddEditionDetailHeaderMedia : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
        => migrationBuilder.AddColumn<Guid>(
            name: "DetailHeaderMediaId",
            table: "Editions",
            type: "uniqueidentifier",
            nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropColumn(name: "DetailHeaderMediaId", table: "Editions");
}
