using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260907132000_MakeNewsEditionOptional")]
public partial class MakeNewsEditionOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
        => migrationBuilder.AlterColumn<Guid>(
            name: "EditionId",
            table: "News",
            type: "uniqueidentifier",
            nullable: true,
            oldClrType: typeof(Guid),
            oldType: "uniqueidentifier");

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.AlterColumn<Guid>(
            name: "EditionId",
            table: "News",
            type: "uniqueidentifier",
            nullable: false,
            defaultValue: Guid.Empty,
            oldClrType: typeof(Guid),
            oldType: "uniqueidentifier",
            oldNullable: true);
}
