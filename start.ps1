# PlayCoffee - Quick Start Script
# Ejecuta este script despues del setup inicial

Write-Host "PlayCoffee - Iniciando..." -ForegroundColor Cyan
Write-Host ""

# Verificar si hay migraciones pendientes
Write-Host "Verificando base de datos..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://playcoffee:playcoffee_secret@localhost:5432/playcoffee"

# Intentar ejecutar migraciones
Write-Host "   Ejecutando migraciones..." -ForegroundColor Yellow
cd apps\backend
npx prisma migrate deploy 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Base de datos actualizada" -ForegroundColor Green
} else {
    Write-Host "   AVISO: Asegurate de que PostgreSQL este corriendo" -ForegroundColor Yellow
    Write-Host "   AVISO: y que la base de datos 'playcoffee' exista" -ForegroundColor Yellow
}

cd ..\..

# Iniciar el proyecto
Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "   Presiona Ctrl+C para detener" -ForegroundColor Yellow
Write-Host ""

pnpm dev
