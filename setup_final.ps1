# Final Setup Script - Using JSON file

param(
    [Parameter(Mandatory=$true)]
    [string]$PostgresPassword
)

Write-Host "=== FINAL SETUP ===" -ForegroundColor Red

# Get values
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)
$dbHost = (az postgres flexible-server show --resource-group stockspace-rg --name stockspace-db --query fullyQualifiedDomainName -o tsv)
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "ACR Password length: $($acrPassword.Length)" -ForegroundColor Yellow
Write-Host "DB Host: $dbHost" -ForegroundColor Yellow

# Read JSON
$json = Get-Content appsettings.json -Raw | ConvertFrom-Json

# Replace placeholders
foreach ($item in $json) {
    if ($item.value -eq "PLACEHOLDER_ACR_PASSWORD") {
        $item.value = $acrPassword
    }
    elseif ($item.value -eq "PLACEHOLDER_DATABASE_URL") {
        $item.value = "postgresql://postgres:$PostgresPassword@$dbHost:5432/stockspace?sslmode=require"
    }
    elseif ($item.value -eq "PLACEHOLDER_SECRET_KEY") {
        $item.value = $secretKey
    }
}

# Save temporary JSON
$json | ConvertTo-Json | Out-File appsettings_temp.json -Encoding utf8

# Apply settings using JSON file
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings @appsettings_temp.json

# Cleanup
Remove-Item appsettings_temp.json -ErrorAction SilentlyContinue

# Verify
Write-Host ""
Write-Host "Verifying..." -ForegroundColor Yellow
az webapp config appsettings list --resource-group stockspace-rg --name stockspace-api --query "[?name=='DOCKER_REGISTRY_SERVER_PASSWORD' || name=='DATABASE_URL']" --output table

# Restart
az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host ""
Write-Host "=== COMPLETE ===" -ForegroundColor Green
Write-Host "Check: https://stockspace-api.azurewebsites.net/docs" -ForegroundColor Cyan








