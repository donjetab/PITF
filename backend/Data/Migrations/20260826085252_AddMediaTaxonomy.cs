using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PITF.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaTaxonomy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Media",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "other");

            migrationBuilder.AddColumn<Guid>(
                name: "FestivalDayId",
                table: "Media",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProgramItemId",
                table: "Media",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tags",
                table: "Media",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            // Preserve the current folder structure and enrich the existing library in place.
            migrationBuilder.Sql("""
                UPDATE m
                SET m.EditionId = COALESCE(m.EditionId, f.EditionId),
                    m.[Year] = COALESCE(m.[Year], f.[Year], e.[Year])
                FROM Media m
                LEFT JOIN MediaFolders f ON f.Id = m.FolderId
                LEFT JOIN Editions e ON e.Id = COALESCE(m.EditionId, f.EditionId);

                UPDATE m
                SET m.ProgramItemId = p.Id,
                    m.EditionId = COALESCE(m.EditionId, p.EditionId),
                    m.Category = 'performance'
                FROM Media m
                JOIN ProgramItems p ON p.PosterMediaId = m.Id OR p.TrailerMediaId = m.Id;

                UPDATE m
                SET m.FestivalDayId = linked.FestivalDayId,
                    m.ProgramItemId = COALESCE(m.ProgramItemId, linked.ProgramItemId),
                    m.EditionId = COALESCE(m.EditionId, linked.EditionId)
                FROM Media m
                OUTER APPLY (
                    SELECT TOP (1) g.FestivalDayId, g.ProgramItemId, g.EditionId
                    FROM GalleryMedia gm
                    JOIN Galleries g ON g.Id = gm.GalleryId
                    WHERE gm.MediaId = m.Id
                    ORDER BY gm.[Order], g.[Order]
                ) linked
                WHERE linked.FestivalDayId IS NOT NULL OR linked.ProgramItemId IS NOT NULL OR linked.EditionId IS NOT NULL;

                UPDATE m
                SET m.[Year] = COALESCE(m.[Year], e.[Year])
                FROM Media m
                LEFT JOIN Editions e ON e.Id = m.EditionId;

                UPDATE Media
                SET Category = CASE
                    WHEN Category = 'performance' THEN Category
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%after-party%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%afterparty%' THEN 'after-party'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%press-conference%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%conference%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%konferenc%' THEN 'press-conference'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%opening%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%hapj%' THEN 'opening-ceremony'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%closing%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%mbyll%' THEN 'closing-ceremony'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%award%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%cmim%' THEN 'awards'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%backstage%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%behind-the-scenes%' THEN 'backstage'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%workshop%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%punetori%' THEN 'workshop'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%audience%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%publik%' THEN 'audience'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%sponsor%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%partner%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%branding%' THEN 'sponsor-branding'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%portrait%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%headshot%' THEN 'portrait'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%venue%' THEN 'venue'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%recap%' THEN 'recap'
                    WHEN LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%performance%' OR LOWER(StorageKey + ' ' + OriginalFilename) LIKE '%shfaqj%' THEN 'performance'
                    ELSE 'other'
                END;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Media_EditionId_Category",
                table: "Media",
                columns: new[] { "EditionId", "Category" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Media_EditionId_Category",
                table: "Media");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Media");

            migrationBuilder.DropColumn(
                name: "FestivalDayId",
                table: "Media");

            migrationBuilder.DropColumn(
                name: "ProgramItemId",
                table: "Media");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Media");
        }
    }
}
