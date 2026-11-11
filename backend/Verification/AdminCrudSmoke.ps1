param(
    [string]$BaseUrl = "http://127.0.0.1:5136",
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Password
)

$ErrorActionPreference = "Stop"
$created = [System.Collections.Generic.List[object]]::new()
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-Json([string]$Method, [string]$Path, $Body = $null, $Headers = @{}) {
    $arguments = @{ Uri = "$BaseUrl$Path"; Method = $Method; Headers = $Headers }
    if ($null -ne $Body) {
        $arguments.ContentType = "application/json"
        $arguments.Body = $Body | ConvertTo-Json -Depth 20
    }
    try { Invoke-RestMethod @arguments }
    catch {
        $detail = $_.Exception.Message
        if ($_.Exception.Response) {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $detail = "$detail $($reader.ReadToEnd())"
            $reader.Dispose()
        }
        if ($null -ne $Body) { Write-Warning ($Body | ConvertTo-Json -Depth 20) }
        throw "$Method $Path failed: $detail"
    }
}

function Payload($Values, $Translations = @{}, $MediaIds = @(), $EditionIds = @(), $Links = @(), $Selections = @()) {
    @{ values = $Values; translations = $Translations; mediaIds = $MediaIds; editionIds = $EditionIds; links = $Links; selections = $Selections }
}

function Assert-Status([string]$Method, [string]$Path, [int]$Expected, $Body = $null, $Headers = @{}) {
    $arguments = @{ Uri = "$BaseUrl$Path"; Method = $Method; Headers = $Headers; UseBasicParsing = $true }
    if ($null -ne $Body) { $arguments.ContentType = "application/json"; $arguments.Body = $Body | ConvertTo-Json -Depth 20 }
    try { $actual = (Invoke-WebRequest @arguments).StatusCode }
    catch { $actual = [int]$_.Exception.Response.StatusCode }
    if ($actual -ne $Expected) { throw "$Method $Path returned $actual; expected $Expected." }
}

function Create-Resource([string]$Resource, $Payload) {
    $response = Invoke-Json POST "/api/admin/manage/$Resource" $Payload $script:auth
    $script:created.Add([pscustomobject]@{ kind = "resource"; resource = $Resource; id = $response.id })
    $script:results.Add([pscustomobject]@{ section = $Resource; operation = "create"; status = "PASS" })
    $response.id
}

function Update-Resource([string]$Resource, [guid]$Id, $Payload) {
    Invoke-Json PUT "/api/admin/manage/$Resource/$Id" $Payload $script:auth | Out-Null
    $script:results.Add([pscustomobject]@{ section = $Resource; operation = "update"; status = "PASS" })
}

$login = Invoke-Json POST "/api/auth/login" @{ email = $Email; password = $Password }
$auth = @{ Authorization = "Bearer $($login.token)" }
$me = Invoke-Json GET "/api/auth/me" $null $auth
if ($me.email -ne $Email -or $me.roles -notcontains "SuperAdmin") { throw "SuperAdmin login verification failed." }
$results.Add([pscustomobject]@{ section = "authentication"; operation = "login/me"; status = "PASS" })
Assert-Status PUT "/api/auth/users/$($me.id)" 409 @{ email = $me.email; role = "Editor"; displayName = $me.displayName } $auth
Assert-Status DELETE "/api/auth/users/$($me.id)" 409 $null $auth
$results.Add([pscustomobject]@{ section = "authentication"; operation = "last-SuperAdmin safeguards"; status = "PASS" })

try {
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $media = Invoke-Json GET "/api/admin/media?page=1&pageSize=1" $null $auth
    $existingMediaId = $media.items[0].id

    foreach ($resource in @("editions", "days", "activities", "program", "news", "galleries", "sponsors", "awards", "pages", "navigation", "settings", "languages", "homepage")) {
        $listed = Invoke-Json GET "/api/admin/manage/$resource" $null $auth
        if ($null -eq $listed.items) { throw "$resource did not return an items collection." }
        $results.Add([pscustomobject]@{ section = $resource; operation = "list"; status = "PASS" })
    }

    $editionValues = @{ number = 99; year = 2099; startDate = "2099-05-01"; endDate = "2099-05-07"; slug = "admin-smoke-edition-$stamp"; status = "Draft"; order = 999; heroMediaId = $existingMediaId }
    $editionTranslations = @{ sq = @{ title = "Test administrimi" }; en = @{ title = "Admin test" }; bs = @{} }
    $editionId = Create-Resource "editions" (Payload $editionValues $editionTranslations)
    $editionValues.order = 998; Update-Resource "editions" $editionId (Payload $editionValues $editionTranslations)

    $dayValues = @{ editionId = $editionId; date = "2099-05-01"; dayNumber = 1; order = 1 }
    $dayId = Create-Resource "days" (Payload $dayValues @{ sq = @{ title = "Dita test" }; en = @{ title = "Test day" }; bs = @{} })
    $dayValues.order = 2; Update-Resource "days" $dayId (Payload $dayValues)

    $programValues = @{ editionId = $editionId; slug = "admin-smoke-program-$stamp"; country = "Kosovo"; company = "PITF QA"; director = "Test Director"; credits = "Test credits"; startsAt = "2099-05-01T20:00:00+02:00"; venue = "Test venue"; posterMediaId = $existingMediaId; status = "Draft"; order = 1 }
    $programId = Create-Resource "program" (Payload $programValues @{ sq = @{ title = "Shfaqje test" }; en = @{ title = "Test performance" }; bs = @{} })
    $programValues.venue = "Updated test venue"; Update-Resource "program" $programId (Payload $programValues)

    $activityValues = @{ festivalDayId = $dayId; type = "performance"; startTime = "20:00"; venue = "Test venue"; programItemId = $programId; order = 1 }
    $activityId = Create-Resource "activities" (Payload $activityValues @{ sq = @{ title = "Aktivitet test" }; en = @{ title = "Test activity" }; bs = @{} })
    $activityValues.type = "special-event"; Update-Resource "activities" $activityId (Payload $activityValues)

    $newsValues = @{ editionId = $editionId; festivalDayId = $dayId; activityId = $activityId; programItemId = $programId; date = "2099-05-01"; slug = "admin-smoke-news-$stamp"; category = "test"; contentMode = "Internal"; coverMediaId = $existingMediaId; status = "Draft"; order = 1 }
    $newsTranslations = @{ sq = @{ title = "Lajm test"; summary = "Përmbledhje"; body = "<p>Trupi test</p>" }; en = @{ title = "Test news"; summary = "Summary"; body = "<p>Test body</p>" }; bs = @{} }
    $newsId = Create-Resource "news" (Payload $newsValues $newsTranslations @($existingMediaId) @() @(@{ label = "PITF"; url = "https://pitf.info"; target = "_blank" }))
    $newsValues.category = "updated-test"; Update-Resource "news" $newsId (Payload $newsValues $newsTranslations @($existingMediaId))

    $galleryValues = @{ editionId = $editionId; festivalDayId = $dayId; activityId = $activityId; programItemId = $programId; coverMediaId = $existingMediaId; status = "Draft"; order = 1 }
    $galleryId = Create-Resource "galleries" (Payload $galleryValues @{ sq = @{ title = "Galeri test" }; en = @{ title = "Test gallery" }; bs = @{} } @($existingMediaId))
    $galleryValues.order = 2; Update-Resource "galleries" $galleryId (Payload $galleryValues @{} @($existingMediaId))

    $sponsorValues = @{ name = "Admin Smoke Sponsor $stamp"; logoMediaId = $existingMediaId; url = "https://pitf.info"; category = "test"; status = "Draft"; order = 1 }
    $sponsorId = Create-Resource "sponsors" (Payload $sponsorValues @{} @() @($editionId))
    $sponsorValues.category = "updated-test"; Update-Resource "sponsors" $sponsorId (Payload $sponsorValues @{} @() @($editionId))

    $awardValues = @{ editionId = $editionId; recipient = "Admin Smoke Recipient $stamp"; person = "Test Person"; programItemId = $programId; country = "Kosovo"; mediaId = $existingMediaId; status = "Draft"; order = 1 }
    $awardId = Create-Resource "awards" (Payload $awardValues @{ sq = @{ awardName = "Cmimi test" }; en = @{ awardName = "Test award" }; bs = @{} })
    $awardValues.order = 2; Update-Resource "awards" $awardId (Payload $awardValues)

    $pageValues = @{ pageKey = "admin-smoke-$stamp"; sectionKey = "section"; contentJson = '{"test":true}'; mediaId = $existingMediaId; status = "Draft"; order = 1 }
    $pageId = Create-Resource "pages" (Payload $pageValues @{ sq = @{ title = "Faqe test" }; en = @{ title = "Test page" }; bs = @{} } @($existingMediaId))
    $pageValues.sectionKey = "updated"; Update-Resource "pages" $pageId (Payload $pageValues @{} @($existingMediaId))

    $navValues = @{ key = "admin-smoke-$stamp"; url = "/admin-smoke"; target = "_self"; status = "Draft"; order = 999 }
    $navId = Create-Resource "navigation" (Payload $navValues @{ sq = @{ label = "Test" }; en = @{ label = "Test" }; bs = @{} })
    $navValues.url = "/admin-smoke-updated"; Update-Resource "navigation" $navId (Payload $navValues)

    $settingValues = @{ key = "admin.smoke.$stamp"; value = "test"; valueType = "text"; group = "test"; isCritical = $false }
    $settingId = Create-Resource "settings" (Payload $settingValues)
    $settingValues.value = "updated"; Update-Resource "settings" $settingId (Payload $settingValues)

    $languageValues = @{ code = "x$($stamp.ToString().Substring($stamp.ToString().Length - 5))"; name = "Smoke language"; isPublic = $false; isActive = $true; order = 999 }
    $languageId = Create-Resource "languages" (Payload $languageValues)
    $languageValues.name = "Updated smoke language"; Update-Resource "languages" $languageId (Payload $languageValues)

    $homeValues = @{ key = "admin-smoke-$stamp"; isVisible = $true; selectionMode = "manual"; selectedEditionId = $editionId; itemLimit = 3; configurationJson = '{"test":true}'; status = "Draft"; order = 999 }
    $selections = @(@{ entityType = "Edition"; entityId = $editionId }, @{ entityType = "News"; entityId = $newsId }, @{ entityType = "ProgramItem"; entityId = $programId })
    $homeId = Create-Resource "homepage" (Payload $homeValues @{ sq = @{ "configuration.title" = "Test" }; en = @{ "configuration.title" = "Test" }; bs = @{} } @() @() @() $selections)
    $homeValues.itemLimit = 4; Update-Resource "homepage" $homeId (Payload $homeValues @{} @() @() @() $selections)

    $folder = Invoke-Json POST "/api/admin/media/folders" @{ name = "Admin smoke $stamp"; parentId = $null; year = 2099; editionId = $editionId } $auth
    $created.Add([pscustomobject]@{ kind = "folder"; id = $folder.id })
    Invoke-Json PUT "/api/admin/media/folders/$($folder.id)" @{ name = "Admin smoke updated $stamp"; parentId = $null; year = 2099; editionId = $editionId } $auth | Out-Null
    $results.Add([pscustomobject]@{ section = "media folders"; operation = "create/update/list/delete"; status = "PASS" })

    Add-Type -AssemblyName System.Drawing
    $tempImage = Join-Path ([System.IO.Path]::GetTempPath()) "pitf-admin-smoke-$stamp.png"
    $bitmap = [System.Drawing.Bitmap]::new(48, 32)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(($stamp % 200) + 30, 80, 150))
    $bitmap.Save($tempImage, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
    try {
        $uploadJson = & curl.exe -sS -X POST -H "Authorization: Bearer $($login.token)" -F "files=@$tempImage;type=image/png" -F "folderId=$($folder.id)" "$BaseUrl/api/admin/media/upload"
        if ($LASTEXITCODE -ne 0) { throw "curl upload failed." }
        $uploadedMedia = @(($uploadJson | ConvertFrom-Json))[0]
        if (!$uploadedMedia.id -or $uploadedMedia.type -ne "image" -or $uploadedMedia.variants.Count -lt 3) { throw "Uploaded image or optimized variants were not returned correctly." }
        $mediaCleanup = [pscustomobject]@{ kind = "media"; id = $uploadedMedia.id }; $created.Add($mediaCleanup)
        Invoke-Json PATCH "/api/admin/media/$($uploadedMedia.id)" @{ alt = "Admin smoke alt"; caption = "Admin smoke caption"; credit = "PITF QA"; folderId = $folder.id; posterUrl = $null; year = 2099; editionId = $editionId } $auth | Out-Null
        Invoke-Json POST "/api/admin/media/bulk-move" @{ ids = @($uploadedMedia.id); folderId = $null } $auth | Out-Null
        Invoke-Json POST "/api/admin/media/bulk-move" @{ ids = @($uploadedMedia.id); folderId = $folder.id } $auth | Out-Null
        foreach ($url in @($uploadedMedia.originalUrl, $uploadedMedia.thumbnailUrl, $uploadedMedia.mediumUrl, $uploadedMedia.largeUrl)) {
            if ($url -and (Invoke-WebRequest -Uri "$BaseUrl$url" -UseBasicParsing).StatusCode -ne 200) { throw "Managed media URL failed: $url" }
        }
        Invoke-Json DELETE "/api/admin/media/$($uploadedMedia.id)" $null $auth | Out-Null
        $mediaCleanup.kind = "deleted"
        $results.Add([pscustomobject]@{ section = "media library"; operation = "upload/variants/edit/move/delete"; status = "PASS" })
    }
    finally { if (Test-Path -LiteralPath $tempImage) { Remove-Item -LiteralPath $tempImage -Force } }

    $testEmail = "admin-smoke-$stamp@pitf.local"
    $testUser = Invoke-Json POST "/api/auth/users" @{ email = $testEmail; password = "Smoke!Editor-2026#A"; role = "Editor"; displayName = "Smoke Editor" } $auth
    $created.Add([pscustomobject]@{ kind = "user"; id = $testUser.id })
    $editorLogin = Invoke-Json POST "/api/auth/login" @{ email = $testEmail; password = "Smoke!Editor-2026#A" }
    $editorAuth = @{ Authorization = "Bearer $($editorLogin.token)" }
    Assert-Status GET "/api/admin/manage/news" 200 $null $editorAuth
    Assert-Status GET "/api/auth/users" 403 $null $editorAuth
    Assert-Status POST "/api/admin/manage/languages" 403 (Payload @{ code = "forbidden-$stamp"; name = "Forbidden"; isActive = $true }) $editorAuth
    Assert-Status POST "/api/admin/manage/settings" 403 (Payload @{ key = "forbidden.$stamp"; value = "x"; valueType = "text"; isCritical = $true }) $editorAuth
    $results.Add([pscustomobject]@{ section = "authorization"; operation = "Editor permissions"; status = "PASS" })
    Invoke-Json PUT "/api/auth/users/$($testUser.id)" @{ email = $testEmail; role = "Admin"; displayName = "Smoke Admin" } $auth | Out-Null
    Invoke-Json POST "/api/auth/users/$($testUser.id)/reset-password" @{ password = "Smoke!Admin-2026#B" } $auth | Out-Null
    $testLogin = Invoke-Json POST "/api/auth/login" @{ email = $testEmail; password = "Smoke!Admin-2026#B" }
    if ($testLogin.user.roles -notcontains "Admin") { throw "Temporary user role/login verification failed." }
    $results.Add([pscustomobject]@{ section = "admin users"; operation = "create/update/reset/login/delete"; status = "PASS" })
}
finally {
    for ($index = $created.Count - 1; $index -ge 0; $index--) {
        $entry = $created[$index]
        try {
            if ($entry.kind -eq "resource") { Invoke-Json DELETE "/api/admin/manage/$($entry.resource)/$($entry.id)" $null $auth | Out-Null }
            elseif ($entry.kind -eq "folder") { Invoke-Json DELETE "/api/admin/media/folders/$($entry.id)" $null $auth | Out-Null }
            elseif ($entry.kind -eq "user") { Invoke-Json DELETE "/api/auth/users/$($entry.id)" $null $auth | Out-Null }
            elseif ($entry.kind -eq "media") { Invoke-Json DELETE "/api/admin/media/$($entry.id)" $null $auth | Out-Null }
        } catch { Write-Warning "Cleanup failed for $($entry.kind) $($entry.id): $($_.Exception.Message)" }
    }
}

$results | Sort-Object section, operation | Format-Table -AutoSize
Write-Host "ADMIN CRUD SMOKE: PASS ($($results.Count) checks)"
