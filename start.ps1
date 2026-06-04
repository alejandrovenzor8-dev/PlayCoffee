# PlayCoffee - Quick Start Script
# Ejecuta este script después del setup inicial

Write-Host "🎮☕ Iniciando PlayCoffee..." -ForegroundColor Cyan
Write-Host ""

# Verificar si hay migraciones pendientes
Write-Host "📊 Verificando base de datos..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://playcoffee:playcoffee_secret@localhost:5432/playcoffee"

# Intentar ejecutar migraciones
Write-Host "   Ejecutando migraciones..." -ForegroundColor Yellow
cd apps\backend
npx prisma migrate deploy 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Base de datos actualizada" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Asegúrate de que PostgreSQL esté corriendo" -ForegroundColor Yellow
    Write-Host "   ⚠️  y que la base de datos 'playcoffee' exista" -ForegroundColor Yellow
}

cd ..\..

# Iniciar el proyecto
Write-Host ""
Write-Host "🚀 Iniciando servicios..." -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "   Presiona Ctrl+C para detener" -ForegroundColor Yellow
Write-Host ""

pnpm dev
