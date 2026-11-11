using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PITF.Api.Data;

#nullable disable

namespace PITF.Api.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260821091500_AddPageContentMedia")]
public sealed class AddPageContentMedia : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "PageContentMedia",
            columns: table => new
            {
                PageContentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                MediaId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                Role = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                Order = table.Column<int>(type: "int", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PageContentMedia", x => new { x.PageContentId, x.MediaId });
                table.ForeignKey("FK_PageContentMedia_Media_MediaId", x => x.MediaId, "Media", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_PageContentMedia_PageContents_PageContentId", x => x.PageContentId, "PageContents", "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex("IX_PageContentMedia_MediaId", "PageContentMedia", "MediaId");
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("PageContentMedia");
}
