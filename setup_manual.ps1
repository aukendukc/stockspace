# Manual Setup - Step by step

param(
    [Parameter(Mandatory=$true)]
    [string]$PostgresPassword
)

Write-Host "=== MANUAL SETUP ===" -ForegroundColor Red

# Get values
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)
$dbHost = (az postgres flexible-server show --resource-group stockspace-rg --name stockspace-db --query fullyQualifiedDomainName -o tsv)
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

$dbUrl = "postgresql://postgres:$PostgresPassword@$dbHost:5432/stockspace?sslmode=require"

Write-Host "Setting DOCKER_REGISTRY_SERVER_URL..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "DOCKER_REGISTRY_SERVER_URL=https://stockspaceregistry.azurecr.io"

Write-Host "Setting DOCKER_REGISTRY_SERVER_USERNAME..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "DOCKER_REGISTRY_SERVER_USERNAME=stockspaceregistry"

Write-Host "Setting DOCKER_REGISTRY_SERVER_PASSWORD..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "DOCKER_REGISTRY_SERVER_PASSWORD=$acrPassword"

Write-Host "Setting DOCKER_CUSTOM_IMAGE_NAME..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "DOCKER_CUSTOM_IMAGE_NAME=DOCKER|stockspaceregistry.azurecr.io/backend:latest"

Write-Host "Setting DATABASE_URL..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "DATABASE_URL=$dbUrl"

Write-Host "Setting ALLOWED_ORIGINS..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "ALLOWED_ORIGINS=*"

Write-Host "Setting AUTO_CREATE_TABLES..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "AUTO_CREATE_TABLES=false"

Write-Host "Setting SECRET_KEY..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "SECRET_KEY=$secretKey"

Write-Host "Setting ALGORITHM..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "ALGORITHM=HS256"

Write-Host "Setting ACCESS_TOKEN_EXPIRE_MINUTES..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings "ACCESS_TOKEN_EXPIRE_MINUTES=30"

Write-Host ""
Write-Host "Verifying..." -ForegroundColor Yellow
az webapp config appsettings list --resource-group stockspace-rg --name stockspace-api --query "[?name=='DOCKER_REGISTRY_SERVER_PASSWORD' || name=='DATABASE_URL']" --output table

Write-Host ""
Write-Host "Restarting..." -ForegroundColor Yellow
az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green



