using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261001090000_AddEditionColors")]
public partial class AddEditionColors : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "PrimaryColor", table: "Editions", type: "nvarchar(max)", nullable: true);
        migrationBuilder.AddColumn<string>(name: "SecondaryColor", table: "Editions", type: "nvarchar(max)", nullable: true);

        migrationBuilder.Sql("""
            UPDATE [Editions] SET [PrimaryColor] = CASE [Number]
                WHEN 1 THEN '#705977' WHEN 2 THEN '#bd1c5f' WHEN 3 THEN '#284a9a' WHEN 4 THEN '#8274b9'
                WHEN 5 THEN '#526b75' WHEN 6 THEN '#1286a9' WHEN 7 THEN '#24756b' WHEN 8 THEN '#68619a'
                WHEN 9 THEN '#5559c9' WHEN 10 THEN '#b57a24' ELSE NULL END,
            [SecondaryColor] = CASE [Number]
                WHEN 1 THEN '#423547' WHEN 2 THEN '#0b5d5e' WHEN 3 THEN '#061a54' WHEN 4 THEN '#3f3769'
                WHEN 5 THEN '#25353d' WHEN 6 THEN '#07516c' WHEN 7 THEN '#153f3d' WHEN 8 THEN '#292845'
                WHEN 9 THEN '#252775' WHEN 10 THEN '#6d3515' ELSE NULL END
            WHERE [Number] BETWEEN 1 AND 10;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PrimaryColor", table: "Editions");
        migrationBuilder.DropColumn(name: "SecondaryColor", table: "Editions");
    }
}
