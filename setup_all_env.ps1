# Complete Environment Setup for Azure App Service

Write-Host "=== Complete Environment Setup ===" -ForegroundColor Cyan

# Step 1: Get ACR Password
Write-Host "Getting ACR credentials..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)
if ([string]::IsNullOrEmpty($acrPassword)) {
    Write-Host "ERROR: Cannot get ACR password" -ForegroundColor Red
    exit 1
}
Write-Host "ACR password retrieved (length: $($acrPassword.Length))" -ForegroundColor Green

# Step 2: Get Database Host
Write-Host "Getting database host..." -ForegroundColor Yellow
$dbHost = (az postgres flexible-server show --resource-group stockspace-rg --name stockspace-db --query fullyQualifiedDomainName -o tsv)
Write-Host "Database host: $dbHost" -ForegroundColor Green

# Step 3: Get Database Password (you need to provide this)
Write-Host ""
Write-Host "Please enter your PostgreSQL password:" -ForegroundColor Yellow
$dbPassword = Read-Host -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

# Step 4: Generate Secret Key
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Step 5: Set all environment variables one by one
Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Yellow

az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_URL=https://stockspaceregistry.azurecr.io
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_USERNAME=stockspaceregistry
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_PASSWORD=$acrPassword
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_CUSTOM_IMAGE_NAME="DOCKER|stockspaceregistry.azurecr.io/backend:latest"

az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DATABASE_URL="postgresql://postgres:$dbPasswordPlain@$dbHost:5432/stockspace?sslmode=require"
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings ALLOWED_ORIGINS=*
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings AUTO_CREATE_TABLES=false
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings SECRET_KEY=$secretKey
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings ALGORITHM=HS256
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings ACCESS_TOKEN_EXPIRE_MINUTES=30

Write-Host ""
Write-Host "Verifying settings..." -ForegroundColor Yellow
az webapp config appsettings list --resource-group stockspace-rg --name stockspace-api --query "[?name=='DOCKER_REGISTRY_SERVER_PASSWORD' || name=='DATABASE_URL']" --output table

Write-Host ""
Write-Host "Restarting App Service..." -ForegroundColor Yellow
az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Wait 2-3 minutes, then check: https://stockspace-api.azurewebsites.net/docs" -ForegroundColor Cyan



