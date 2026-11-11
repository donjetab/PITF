param([string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path)

$frontend = Join-Path $WorkspaceRoot 'frontend'
$newsRoot = Join-Path $frontend 'src\News'
$output = Join-Path $WorkspaceRoot 'backend\IMPORT-VERIFICATION-MISSING-MEDIA.md'
$allFiles = Get-ChildItem -LiteralPath $frontend -Recurse -File
$byName = $allFiles | Group-Object Name -AsHashTable -AsString
$newsById = @{}
Get-ChildItem -LiteralPath $newsRoot -Recurse -File | Where-Object { $_.Name -match '^news-.*\.json$' } | ForEach-Object {
    foreach ($news in (Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json)) { $newsById[$news.id] = $news.slug }
}
$dbMediaCounts = @{}
sqlcmd -S '.\SQLEXPRESS' -E -N o -d PITF -h -1 -W -s '|' -Q "SET NOCOUNT ON; SELECT n.Slug,COUNT(nm.MediaId) FROM News n LEFT JOIN NewsMedia nm ON nm.NewsId=n.Id GROUP BY n.Slug" |
    Where-Object { $_ -match '\|' } | ForEach-Object { $parts = $_.Split('|'); $dbMediaCounts[$parts[0].Trim()] = [int]$parts[1].Trim() }
$rows = @()
Get-ChildItem -LiteralPath $newsRoot -Recurse -File -Filter 'media-*.json' | ForEach-Object {
    $base = $_.Directory.FullName
    foreach ($media in (Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json)) {
        $relative = [Uri]::UnescapeDataString(($media.src -replace '^/media/', '')).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $declared = Join-Path $base $relative
        if (Test-Path -LiteralPath $declared) { continue }
        $slug = $newsById[$media.newsId]
        $sameName = @($byName[[IO.Path]::GetFileName($declared)] | Where-Object { $_.FullName -ne $declared })
        $rows += [pscustomobject]@{
            Year = [int]$media.editionYear; NewsId = $media.newsId; Slug = $slug; MediaId = $media.id
            DeclaredPath = $media.src; SameBasenameCandidates = $sameName.Count
            OtherUsableMedia = (($dbMediaCounts[$slug] -as [int]) -gt 0)
        }
    }
}
$lines = [Collections.Generic.List[string]]::new()
$lines.Add('# PITF missing declared media appendix')
$lines.Add('')
$lines.Add('Generated from the prepared manifests and current SQL Server database. A same-basename candidate is not called identical because the absent source has no bytes/hash to compare. Therefore every absent declared entry remains genuinely unresolved even when its article has other usable media.')
$lines.Add('')
$lines.Add('| Year | News ID | Slug | Media ID | Declared path | Same-basename candidates | News has other usable media | Identical file proven by SHA-256 | Missing entry resolved |')
$lines.Add('|---:|---|---|---|---|---:|:---:|:---:|:---:|')
foreach ($row in $rows | Sort-Object Year, Slug, MediaId) {
    $safeSlug = ($row.Slug -replace '\|', '\|')
    $safePath = ($row.DeclaredPath -replace '\|', '\|')
    $lines.Add("| $($row.Year) | $($row.NewsId) | $safeSlug | $($row.MediaId) | ``$safePath`` | $($row.SameBasenameCandidates) | $(if($row.OtherUsableMedia){'Yes'}else{'No'}) | No | No |")
}
$lines.Add('')
$lines.Add("Total missing declared rows: $($rows.Count).")
$lines | Set-Content -LiteralPath $output -Encoding UTF8
Write-Output $output
