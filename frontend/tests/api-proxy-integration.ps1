param(
    [string]$FrontendImage = 'chronolist-frontend:chron-151-step6',
    [string]$BackendImage = 'chronolist-backend:latest',
    [ValidateRange(1024, 65535)][int]$Port = 18443
)

# PowerShell 7, Docker and curl.exe. Uses only a disposable H2 DB, never the production DB.
$ErrorActionPreference = 'Stop'
$proxyId = [guid]::NewGuid().ToString('N').Substring(0, 10)
$proxyNetwork = "chron151-proxy-$proxyId"
$proxyBackend = "$proxyNetwork-backend"
$proxyFrontend = "$proxyNetwork-frontend"
$proxyGateway = "$proxyNetwork-gateway"
$proxyOrigin = "https://localhost:$Port"
$proxyTempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
$proxyWorkRoot = Join-Path $proxyTempParent $proxyNetwork
$proxyJar = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../backend/build/libs/app.jar'))
$proxyContainers = @()
$proxyNetworkCreated = $false
$proxyWorkCreated = $false
$script:proxyChecks = 0

function Assert-Proxy([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:proxyChecks++
}

function Invoke-Proxy([string]$Path, [string]$Method = 'GET', [hashtable]$Headers = @{},
        [object]$Body = $null, [switch]$AllowUnavailable) {
    $proxyHeaderFile = Join-Path $proxyWorkRoot 'response-headers.txt'
    $proxyBodyFile = Join-Path $proxyWorkRoot 'response-body.txt'
    $proxyCookieFile = Join-Path $proxyWorkRoot 'cookies.txt'
    $proxyCurlArgs = @('--silent', '--show-error', '--connect-timeout', '2', '--max-time', '20',
        '--cacert', (Join-Path $proxyWorkRoot 'certificate.pem'),
        '--cookie', $proxyCookieFile, '--cookie-jar', $proxyCookieFile,
        '--dump-header', $proxyHeaderFile, '--output', $proxyBodyFile,
        '--write-out', '%{http_code}', '--request', $Method, "$proxyOrigin$Path")
    foreach ($proxyHeader in $Headers.GetEnumerator()) {
        $proxyCurlArgs += @('--header', "$($proxyHeader.Key): $($proxyHeader.Value)")
    }
    if ($null -ne $Body) {
        $proxyRequestFile = Join-Path $proxyWorkRoot 'request.json'
        $Body | ConvertTo-Json -Depth 5 -Compress | Set-Content -LiteralPath $proxyRequestFile -Encoding utf8NoBOM
        $proxyCurlArgs += @('--header', 'Content-Type: application/json', '--data-binary', "@$proxyRequestFile")
    }
    $proxyStatus = & curl.exe @proxyCurlArgs 2> (Join-Path $proxyWorkRoot 'curl-error.txt')
    if ($LASTEXITCODE -ne 0) {
        if ($AllowUnavailable) { return [pscustomobject]@{ Status = 0 } }
        throw (Get-Content (Join-Path $proxyWorkRoot 'curl-error.txt') -Raw)
    }
    $proxyRawBody = Get-Content -LiteralPath $proxyBodyFile -Raw
    $proxyData = $null
    if ($proxyRawBody) {
        try { $proxyData = $proxyRawBody | ConvertFrom-Json -NoEnumerate } catch { }
    }
    return [pscustomobject]@{
        Status = [int]$proxyStatus
        Headers = Get-Content -LiteralPath $proxyHeaderFile -Raw
        Body = $proxyRawBody
        Data = $proxyData
    }
}

try {
    if (-not (Test-Path -LiteralPath $proxyJar)) { throw 'Build backend/build/libs/app.jar before running this test' }
    New-Item -ItemType Directory -Path $proxyWorkRoot | Out-Null
    $proxyWorkCreated = $true
    New-Item -ItemType File -Path (Join-Path $proxyWorkRoot 'cookies.txt') | Out-Null
    $proxyRsa = [Security.Cryptography.RSA]::Create(2048)
    $proxyCertificateRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=localhost', $proxyRsa, [Security.Cryptography.HashAlgorithmName]::SHA256,
        [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $proxySan = [Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $proxySan.AddDnsName('localhost')
    $proxySan.AddIpAddress([Net.IPAddress]::Loopback)
    $proxyCertificateRequest.CertificateExtensions.Add($proxySan.Build())
    $proxyCertificateRequest.CertificateExtensions.Add(
        [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
    $proxyCertificate = $proxyCertificateRequest.CreateSelfSigned(
        [DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(1))
    $proxyCertificate.ExportCertificatePem() | Set-Content (Join-Path $proxyWorkRoot 'certificate.pem') -Encoding utf8NoBOM
    $proxyRsa.ExportPkcs8PrivateKeyPem() | Set-Content (Join-Path $proxyWorkRoot 'private-key.pem') -Encoding utf8NoBOM
    @'
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/test/certificate.pem;
    ssl_certificate_key /etc/nginx/test/private-key.pem;
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $http_host;
    }
}
'@ | Set-Content (Join-Path $proxyWorkRoot 'gateway.conf') -Encoding utf8NoBOM

    docker network create $proxyNetwork | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create isolated test network' }
    $proxyNetworkCreated = $true
    docker run -d --rm --name $proxyBackend --network $proxyNetwork --network-alias backend --entrypoint java `
        --mount "type=bind,source=$proxyJar,target=/app/app.jar,readonly" `
        -e SPRING_PROFILES_ACTIVE=prod -e 'DB_URL=jdbc:h2:mem:proxytest' -e DB_USERNAME=sa -e DB_PASSWORD=unused `
        -e SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.h2.Driver -e SPRING_SQL_INIT_MODE=always `
        -e "FRONTEND_ORIGIN=$proxyOrigin" $BackendImage -jar /app/app.jar | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot start disposable Backend' }
    $proxyContainers += $proxyBackend
    docker run -d --rm --name $proxyFrontend --network $proxyNetwork --network-alias frontend `
        -e "API_BASE_URL=$proxyOrigin" -e BACKEND_UPSTREAM=http://backend:8080 $FrontendImage | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot start Frontend' }
    $proxyContainers += $proxyFrontend
    docker run -d --rm --name $proxyGateway --network $proxyNetwork -p "127.0.0.1:${Port}:443" `
        --mount "type=bind,source=$proxyWorkRoot,target=/etc/nginx/test,readonly" `
        --mount "type=bind,source=$proxyWorkRoot/gateway.conf,target=/etc/nginx/conf.d/default.conf,readonly" `
        nginx:stable-alpine | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot start local TLS entry point' }
    $proxyContainers += $proxyGateway

    $proxyReady = $false
    for ($proxyAttempt = 0; $proxyAttempt -lt 60; $proxyAttempt++) {
        $proxyProbe = Invoke-Proxy '/api/csrf' -AllowUnavailable
        if ($proxyProbe.Status -eq 200) { $proxyReady = $true; break }
        Start-Sleep -Seconds 1
    }
    Assert-Proxy $proxyReady "Backend did not become ready through verified HTTPS (last status: $($proxyProbe.Status))"
    Assert-Proxy ((Invoke-Proxy '/login').Status -eq 200) 'SPA route did not return the Frontend'
    Assert-Proxy ((Invoke-Proxy '/config.js').Body.Contains($proxyOrigin)) 'Runtime API base URL is incorrect'

    # The ingress sanitizes these headers, rather than trusting browser-supplied forwarding data.
    $proxyForwarding = @{ Origin = $proxyOrigin; Forwarded = 'proto=http;host=evil.example';
        'X-Forwarded-Host' = 'evil.example'; 'X-Forwarded-Proto' = 'http';
        'X-Forwarded-Port' = '80'; 'X-Forwarded-Prefix' = '/evil' }
    $proxyCsrf = Invoke-Proxy '/api/csrf' -Headers $proxyForwarding
    Assert-Proxy ($proxyCsrf.Status -eq 200) 'Forged forwarding headers affected token routing'
    Assert-Proxy ($proxyCsrf.Headers -match '(?im)^Strict-Transport-Security:') 'Backend did not recognize HTTPS'
    Assert-Proxy ($proxyCsrf.Headers -notmatch '(?im)^Access-Control-Allow-Origin:') 'Same-origin request was misclassified'
    $proxyCookie = $proxyProbe.Headers
    foreach ($proxyAttribute in @('JSESSIONID=', 'Max-Age=604800', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/')) {
        Assert-Proxy ($proxyCookie.Contains($proxyAttribute)) "Missing session cookie attribute: $proxyAttribute"
    }
    Assert-Proxy ($proxyCookie -notmatch '(?i);\s*Domain=') 'Cookie must remain host-only'
    $proxyHeaders = @{ Origin = $proxyOrigin; 'X-CSRF-TOKEN' = $proxyCsrf.Data.token }
    $proxyUser = @{ loginId = "proxy151$proxyId"; password = 'Proxy151Check!' }
    Assert-Proxy ((Invoke-Proxy '/api/signup' 'POST' $proxyHeaders $proxyUser).Status -eq 200) 'Signup failed'
    Assert-Proxy ((Invoke-Proxy '/api/login' 'POST' $proxyHeaders $proxyUser).Status -eq 200) 'Login failed'
    $proxyTask = @{ title = 'HTTPS proxy check'; priority = 'MIDDLE'; dueKind = 'NONE' }
    $proxyRejected = Invoke-Proxy '/api/todolist/register' 'POST' $proxyHeaders $proxyTask
    Assert-Proxy ($proxyRejected.Status -eq 403 -and $proxyRejected.Data.code -eq 'CSRF_TOKEN_INVALID') 'Old token was not rejected as JSON 403'
    $proxyCsrf = Invoke-Proxy '/api/csrf' -Headers @{ Origin = $proxyOrigin }
    $proxyHeaders['X-CSRF-TOKEN'] = $proxyCsrf.Data.token
    $proxyCreated = Invoke-Proxy '/api/todolist/register' 'POST' $proxyHeaders $proxyTask
    Assert-Proxy ($proxyCreated.Status -eq 200 -and $proxyCreated.Data -gt 0) 'Authenticated create failed'
    $proxyTaskId = [int]$proxyCreated.Data
    $proxyUpdated = Invoke-Proxy '/api/todolist/update/status' 'PUT' $proxyHeaders @{id=$proxyTaskId;isCompleted=$true}
    Assert-Proxy ($proxyUpdated.Status -eq 204) 'Update failed'
    Assert-Proxy ($proxyUpdated.Headers -match 'Set-Cookie: JSESSIONID=' -and $proxyUpdated.Headers -match 'Max-Age=604800' `
        -and $proxyUpdated.Headers -match 'Secure') 'Cookie expiry was not refreshed through HTTPS'
    $proxyTasks = Invoke-Proxy '/api/todolist/getAll'
    Assert-Proxy ($proxyTasks.Status -eq 200 -and $proxyTasks.Data.Count -eq 1 -and $proxyTasks.Data[0].isCompleted) 'Cookie authentication or update persistence failed'
    $proxyEvil = @{ Origin = 'https://evil.example'; 'X-CSRF-TOKEN' = $proxyCsrf.Data.token;
        Forwarded = "proto=https;host=localhost:$Port" }
    Assert-Proxy ((Invoke-Proxy '/api/todolist/register' 'POST' $proxyEvil $proxyTask).Status -eq 403) 'Unconfigured Origin was accepted'
    Assert-Proxy ((Invoke-Proxy '/api/todolist/getAll').Data.Count -eq 1) 'Rejected request changed task data'
    Assert-Proxy ((Invoke-Proxy '/api/todolist/delete' 'DELETE' $proxyHeaders @{id=$proxyTaskId}).Status -eq 204) 'Delete failed'
    $proxyLogout = Invoke-Proxy '/api/logout' 'POST' $proxyHeaders
    Assert-Proxy ($proxyLogout.Status -eq 200 -and $proxyLogout.Headers -match 'Max-Age=0' -and $proxyLogout.Headers -match 'Secure') 'Logout cookie deletion failed'
    Assert-Proxy ($proxyLogout.Headers -match 'HttpOnly' -and $proxyLogout.Headers -match 'SameSite=Lax' `
        -and $proxyLogout.Headers -match 'Path=/' -and $proxyLogout.Headers -notmatch '(?i);\s*Domain=') 'Logout cookie attributes changed at the proxy'
    $proxyDenied = Invoke-Proxy '/api/todolist/getAll'
    Assert-Proxy ($proxyDenied.Status -eq 401 -and $proxyDenied.Data.code -eq 'UNAUTHENTICATED') '401 was replaced by Frontend HTML'
    $proxyApiRoot = Invoke-Proxy '/api'
    Assert-Proxy ($proxyApiRoot.Status -eq 404 -and $proxyApiRoot.Data.code -eq 'NOT_FOUND') 'API root fell back to the SPA'
    [pscustomobject]@{ HTTPSProxyChecksPassed = $true; Checks = $script:proxyChecks;
        TLSVerification = 'curl --cacert; no system trust changes'; Database = 'Disposable H2 (prod settings)' }
} catch {
    if (Test-Path (Join-Path $proxyWorkRoot 'curl-error.txt')) {
        Get-Content (Join-Path $proxyWorkRoot 'curl-error.txt') | Write-Warning
    }
    foreach ($proxyContainer in $proxyContainers) { docker logs --tail 20 $proxyContainer 2>&1 | Out-Host }
    throw
} finally {
    foreach ($proxyContainer in $proxyContainers) { docker rm -f $proxyContainer 2>$null | Out-Null }
    if ($proxyNetworkCreated) { docker network rm $proxyNetwork 2>$null | Out-Null }
    if ($proxyWorkCreated -and (Test-Path -LiteralPath $proxyWorkRoot)) {
        $proxyResolved = [IO.Path]::GetFullPath($proxyWorkRoot)
        if ([IO.Path]::GetDirectoryName($proxyResolved) -ne $proxyTempParent -or
                [IO.Path]::GetFileName($proxyResolved) -ne $proxyNetwork) { throw 'Unsafe temporary cleanup path' }
        Remove-Item -LiteralPath $proxyResolved -Recurse -Force
    }
    if ($proxyCertificate) { $proxyCertificate.Dispose() }
    if ($proxyRsa) { $proxyRsa.Dispose() }
}
