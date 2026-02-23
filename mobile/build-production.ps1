# StockSpace Mobile App - Production Build Script

param(
    [ValidateSet("android", "ios", "all")]
    [string]$Platform = "all",
    [ValidateSet("development", "preview", "production")]
    [string]$Profile = "production",
    [switch]$LocalBuild
)

Write-Host "=== StockSpace Mobile Build ===" -ForegroundColor Cyan
Write-Host "Platform: $Platform"
Write-Host "Profile: $Profile"
Write-Host ""

# Node.js確認
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "Node.js がインストールされていません" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

# EAS CLI確認
$easVersion = npx eas-cli --version 2>$null
if (-not $easVersion) {
    Write-Host "EAS CLI をインストールしています..." -ForegroundColor Yellow
    npm install -g eas-cli
}
Write-Host "EAS CLI: $(npx eas-cli --version)" -ForegroundColor Green

# 依存関係インストール
Write-Host "`n[1/3] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed" -ForegroundColor Red
    exit 1
}

# EASログイン確認
Write-Host "`n[2/3] Checking EAS login..." -ForegroundColor Yellow
$easWhoami = npx eas-cli whoami 2>$null
if (-not $easWhoami) {
    Write-Host "EASにログインしてください:" -ForegroundColor Yellow
    npx eas-cli login
}

# ビルド実行
Write-Host "`n[3/3] Building app..." -ForegroundColor Yellow

$buildCmd = "npx eas-cli build --profile $Profile"

if ($LocalBuild) {
    $buildCmd += " --local"
}

switch ($Platform) {
    "android" {
        $buildCmd += " --platform android"
    }
    "ios" {
        $buildCmd += " --platform ios"
    }
    "all" {
        $buildCmd += " --platform all"
    }
}

Write-Host "Executing: $buildCmd" -ForegroundColor Cyan
Invoke-Expression $buildCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green

if ($Profile -eq "production") {
    Write-Host "`n本番ビルドが完了しました！" -ForegroundColor Cyan
    Write-Host "ストアへの提出準備ができています。"
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Yellow
    Write-Host "  1. EAS Dashboardでビルド状態を確認"
    Write-Host "  2. ビルド完了後、APK/IPAをダウンロード"
    Write-Host "  3. Google Play / App Store Connectに提出"
    Write-Host ""
    Write-Host "ストア提出コマンド:" -ForegroundColor Cyan
    Write-Host "  npx eas-cli submit --platform android"
    Write-Host "  npx eas-cli submit --platform ios"
}
