param()

# 明示的な実行時のみCompose/.envの接続情報を使い、一意な検証専用TiDBデータベースを作成・削除する。
# 起動済みの開発用Backend（JDK 25）とDockerを使用し、最新のbootJarを生成する。
$ErrorActionPreference = 'Stop'
$verificationId = [guid]::NewGuid().ToString('N').Substring(0, 12)
$verificationSchema = "chron151_verify_$verificationId"
$verificationCreated = $false
$verificationNames = @('DB_URL', 'DB_USERNAME', 'DB_PASSWORD', 'FRONTEND_ORIGIN', 'VERIFY_SCHEMA', 'FLYWAY_URL', 'FLYWAY_USER', 'FLYWAY_PASSWORD')
$verificationPrevious = @{}
foreach ($verificationName in $verificationNames) {
    $verificationPrevious[$verificationName] = [Environment]::GetEnvironmentVariable($verificationName, 'Process')
}

function Invoke-SessionProbe([string]$Mode) {
    $verificationOutput = & docker compose exec -T -e DB_URL -e DB_USERNAME -e DB_PASSWORD -e FRONTEND_ORIGIN -e VERIFY_SCHEMA backend `
        java -cp '/app/build/session-verification/BOOT-INF/classes:/app/build/session-verification/BOOT-INF/lib/*' `
        /app/verification/TidbSessionVerification.java $Mode 2>&1
    $verificationCode = $LASTEXITCODE
    # ドライバーのエラーやアプリログには識別情報が含まれ得るため、既知の検証メッセージだけを出力する。
    $verificationOutput | Where-Object { "$_" -match '^(PASS |TiDBSessionChecksPassed=|DisposableDatabaseCreated=|DisposableDatabaseRemoved=)' } |
        ForEach-Object { Write-Host $_ }
    if ($verificationCode -ne 0) { throw "TiDB session probe failed ($Mode)" }
}

try {
    $verificationConfigText = & docker compose --profile migration config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve Compose credentials' }
    $verificationConfig = $verificationConfigText | ConvertFrom-Json
    $verificationCredentials = $verificationConfig.services.flyway.environment
    foreach ($verificationName in @('FLYWAY_URL', 'FLYWAY_USER', 'FLYWAY_PASSWORD')) {
        if (-not $verificationCredentials.$verificationName) { throw "Missing $verificationName" }
    }
    $verificationOriginalUrl = [string]$verificationCredentials.FLYWAY_URL
    if ($verificationOriginalUrl -notmatch '^jdbc:mysql://[^/]+/[^?]+\?.*sslMode=VERIFY_IDENTITY(?:&|$)') {
        throw 'Expected an explicit database and sslMode=VERIFY_IDENTITY'
    }
    $env:DB_URL = $verificationOriginalUrl
    $env:DB_USERNAME = $verificationCredentials.FLYWAY_USER
    $env:DB_PASSWORD = $verificationCredentials.FLYWAY_PASSWORD
    $env:FRONTEND_ORIGIN = 'https://session-verification.example'
    $env:VERIFY_SCHEMA = $verificationSchema

    & docker compose exec -T backend sh ./gradlew bootJar --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Backend bootJar failed' }
    & docker compose exec -T backend sh -c 'mkdir -p /app/build/session-verification && cd /app/build/session-verification && jar xf /app/build/libs/app.jar'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot extract runtime classpath' }
    Invoke-SessionProbe 'prepare'
    $verificationCreated = $true
    $verificationDisposableUrl = $verificationOriginalUrl -replace '(/)[^/?]+(?=\?)', "/$verificationSchema"
    $env:FLYWAY_URL = $verificationDisposableUrl
    $env:FLYWAY_USER = $env:DB_USERNAME
    $env:FLYWAY_PASSWORD = $env:DB_PASSWORD
    $verificationSql = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../flyway/sql'))
    # キャッシュ済みFlywayイメージのSQLが古くても、現在のSQLを使うようバインドマウントする。
    foreach ($verificationOperation in @('migrate', 'validate', 'migrate')) {
        $verificationMigrationOutput = & docker run --rm --env FLYWAY_URL --env FLYWAY_USER --env FLYWAY_PASSWORD `
            --mount "type=bind,source=$verificationSql,target=/flyway/sql,readonly" `
            chronolist-flyway:latest -connectRetries=0 $verificationOperation 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Flyway $verificationOperation failed; raw output withheld to protect connection details"
        }
        Write-Host "Flyway $verificationOperation succeeded"
    }
    $env:DB_URL = $verificationDisposableUrl
    Invoke-SessionProbe 'verify'
} finally {
    try {
        if ($verificationCreated) {
            $env:DB_URL = $verificationOriginalUrl
            Invoke-SessionProbe 'drop'
        }
    } finally {
        foreach ($verificationName in $verificationNames) {
            [Environment]::SetEnvironmentVariable($verificationName, $verificationPrevious[$verificationName], 'Process')
        }
    }
}
