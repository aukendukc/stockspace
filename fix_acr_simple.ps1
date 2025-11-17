# ACR Password Fix - Simple Version

$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)

az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_PASSWORD=$acrPassword

az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host "Done! Wait a few minutes and check https://stockspace-api.azurewebsites.net/docs"



