param(
    [string]$Destination = "media"
)

$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$uploadRoot = (Resolve-Path -LiteralPath (Join-Path $workspaceRoot "backend\wwwroot\uploads")).Path
$destinationPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $Destination))

if (-not $destinationPath.StartsWith($workspaceRoot + [IO.Path]::DirectorySeparatorChar)) {
    throw "Destination must remain inside the PITF workspace."
}

$connection = New-Object System.Data.SqlClient.SqlConnection "Server=.\SQLEXPRESS;Database=PITF;Integrated Security=SSPI;Encrypt=False;TrustServerCertificate=True"
$connection.Open()
$command = $connection.CreateCommand()
$command.CommandText = @"
SELECT
    m.Id,
    m.OriginalFilename,
    m.StorageKey,
    COALESCE(parentFolder.Name + '/', '') + COALESCE(folder.Name, 'Unsorted') AS FolderPath
FROM Media m
LEFT JOIN MediaFolders folder ON folder.Id = m.FolderId
LEFT JOIN MediaFolders parentFolder ON parentFolder.Id = folder.ParentId
ORDER BY FolderPath, m.OriginalFilename, m.Id
"@
$reader = $command.ExecuteReader()
$rows = New-Object System.Data.DataTable
$rows.Load($reader)
$connection.Close()

New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
$restored = 0
$renamed = 0
$missing = 0

foreach ($row in $rows.Rows) {
    $folderParts = ([string]$row.FolderPath).Split('/', [StringSplitOptions]::RemoveEmptyEntries)
    $targetFolder = $destinationPath
    foreach ($part in $folderParts) {
        $safePart = [string]::Join('_', $part.Split([IO.Path]::GetInvalidFileNameChars()))
        $targetFolder = Join-Path $targetFolder $safePart
    }
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null

    $source = Join-Path $uploadRoot ([string]$row.StorageKey).Replace('/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $source)) {
        $missing++
        continue
    }

    $safeName = [string]::Join('_', ([string]$row.OriginalFilename).Split([IO.Path]::GetInvalidFileNameChars()))
    if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "$($row.Id)" }
    $target = Join-Path $targetFolder $safeName
    if (Test-Path -LiteralPath $target) {
        $base = [IO.Path]::GetFileNameWithoutExtension($safeName)
        $extension = [IO.Path]::GetExtension($safeName)
        $target = Join-Path $targetFolder "${base}__$(([string]$row.Id).Substring(0, 8))${extension}"
        $renamed++
    }

    Copy-Item -LiteralPath $source -Destination $target
    $restored++
}

[pscustomobject]@{
    Destination = $destinationPath
    DatabaseOriginals = $rows.Rows.Count
    Restored = $restored
    RenamedCollisions = $renamed
    Missing = $missing
}
