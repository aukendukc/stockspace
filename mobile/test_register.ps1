# Firebase Authentication Test Script

Write-Host "=== Firebase Authentication Test ===" -ForegroundColor Cyan
Write-Host ""

# Check backend
Write-Host "[1/4] Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET
    Write-Host "[OK] Backend is running" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Backend is not running" -ForegroundColor Red
    Write-Host "   Run: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -ForegroundColor Yellow
    exit 1
}

# Check Firebase service account key
Write-Host ""
Write-Host "[2/4] Checking Firebase configuration..." -ForegroundColor Yellow
if (Test-Path "serviceAccountKey.json") {
    Write-Host "[OK] serviceAccountKey.json exists" -ForegroundColor Green
} else {
    Write-Host "[ERROR] serviceAccountKey.json not found" -ForegroundColor Red
    exit 1
}

# Check .env
Write-Host ""
Write-Host "[3/4] Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "GOOGLE_APPLICATION_CREDENTIALS") {
        Write-Host "[OK] GOOGLE_APPLICATION_CREDENTIALS is set" -ForegroundColor Green
    } else {
        Write-Host "[WARN] GOOGLE_APPLICATION_CREDENTIALS not set" -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] .env file not found" -ForegroundColor Yellow
}

# Firebase Console check
Write-Host ""
Write-Host "[4/4] Firebase Console setup..." -ForegroundColor Yellow
Write-Host ""
Write-Host "[IMPORTANT] Enable Email/Password authentication in Firebase Console" -ForegroundColor Yellow
Write-Host "   URL: https://console.firebase.google.com/project/stockspace-76437/authentication/providers" -ForegroundColor Cyan
Write-Host ""
Write-Host "Steps:" -ForegroundColor White
Write-Host "1. Open the URL above" -ForegroundColor Gray
Write-Host "2. Click on 'Email/Password'" -ForegroundColor Gray
Write-Host "3. Toggle 'Enable' to ON" -ForegroundColor Gray
Write-Host "4. Click 'Save'" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Enable Email/Password in Firebase Console (if not done)" -ForegroundColor White
Write-Host "2. Start mobile app: cd mobile && npx expo start" -ForegroundColor White
Write-Host "3. Try to register in the app" -ForegroundColor White
Write-Host ""
Write-Host "Test credentials:" -ForegroundColor Cyan
Write-Host "   Email: test@example.com" -ForegroundColor Gray
Write-Host "   Handle: @test_user" -ForegroundColor Gray
Write-Host "   Password: test123456" -ForegroundColor Gray
Write-Host ""