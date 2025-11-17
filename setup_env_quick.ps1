# Quick Setup - No password prompt

param(
    [Parameter(Mandatory=$true)]
    [string]$PostgresPassword
)

Write-Host "Setting up all environment variables..." -ForegroundColor Cyan

# Get ACR Password
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)
$dbHost = (az postgres flexible-server show --resource-group stockspace-rg --name stockspace-db --query fullyQualifiedDomainName -o tsv)
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Set all settings
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_URL=https://stockspaceregistry.azurecr.io
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_USERNAME=stockspaceregistry  
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_PASSWORD=$acrPassword
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_CUSTOM_IMAGE_NAME="DOCKER|stockspaceregistry.azurecr.io/backend:latest"
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DATABASE_URL="postgresql://postgres:$PostgresPassword@$dbHost:5432/stockspace?sslmode=require"
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings ALLOWED_ORIGINS=*
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings AUTO_CREATE_TABLES=false
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings SECRET_KEY=$secretKey
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings ALGORITHM=HS256
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings ACCESS_TOKEN_EXPIRE_MINUTES=30

az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host "Done! Wait 2-3 minutes then check: https://stockspace-api.azurewebsites.net/docs" -ForegroundColor Green



