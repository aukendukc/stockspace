# Fix DATABASE_URL environment variable

Write-Host "=== Fix DATABASE_URL ===" -ForegroundColor Cyan

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"

# Get database host
Write-Host "`n[1/3] Getting database host..." -ForegroundColor Yellow
$dbHost = (az postgres flexible-server show --resource-group $resourceGroup --name stockspace-db --query fullyQualifiedDomainName -o tsv 2>$null)
if (-not $dbHost) {
    Write-Host "Database not found. Trying alternative names..." -ForegroundColor Yellow
    $dbHost = (az postgres server list --resource-group $resourceGroup --query "[0].fullyQualifiedDomainName" -o tsv 2>$null)
}

if (-not $dbHost) {
    Write-Host "ERROR: Could not find database. Please check:" -ForegroundColor Red
    Write-Host "1. Database name is correct" -ForegroundColor White
    Write-Host "2. Database exists in resource group: $resourceGroup" -ForegroundColor White
    Write-Host "`nTo list databases:" -ForegroundColor Yellow
    Write-Host "az postgres flexible-server list --resource-group $resourceGroup" -ForegroundColor White
    Write-Host "az postgres server list --resource-group $resourceGroup" -ForegroundColor White
    exit 1
}

Write-Host "Database host: $dbHost" -ForegroundColor Green

# Get database password
Write-Host "`n[2/3] Enter PostgreSQL password:" -ForegroundColor Yellow
$dbPassword = Read-Host -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

# Set DATABASE_URL
Write-Host "`n[3/3] Setting DATABASE_URL..." -ForegroundColor Yellow
$dbUrl = "postgresql://postgres:$dbPasswordPlain@$dbHost:5432/stockspace?sslmode=require"

az webapp config appsettings set `
  --resource-group $resourceGroup `
  --name $appServiceName `
  --settings DATABASE_URL="$dbUrl"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set DATABASE_URL" -ForegroundColor Red
    exit 1
}

Write-Host "DATABASE_URL set successfully" -ForegroundColor Green

# Restart App Service
Write-Host "`nRestarting App Service..." -ForegroundColor Yellow
az webapp restart --resource-group $resourceGroup --name $appServiceName

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "Wait 2-3 minutes, then check:" -ForegroundColor Cyan
Write-Host "https://$appServiceName.azurewebsites.net/docs" -ForegroundColor White


