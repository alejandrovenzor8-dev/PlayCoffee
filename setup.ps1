# PlayCoffee Setup Script
# Este script configura el proyecto para desarrollo local

Write-Host "🎮☕ PlayCoffee - Setup Local" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
Write-Host "1️⃣  Verificando Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js $nodeVersion instalado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js no está instalado" -ForegroundColor Red
    Write-Host "      Descárgalo desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Verificar pnpm
Write-Host "2️⃣  Verificando pnpm..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmVersion = pnpm --version
    Write-Host "   ✅ pnpm $pnpmVersion instalado" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  pnpm no está instalado. Instalando..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "   ✅ pnpm instalado" -ForegroundColor Green
}

# Verificar PostgreSQL
Write-Host "3️⃣  Verificando PostgreSQL..." -ForegroundColor Yellow
if (Get-Command psql -ErrorAction SilentlyContinue) {
    $pgVersion = psql --version
    Write-Host "   ✅ PostgreSQL instalado: $pgVersion" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  PostgreSQL no detectado" -ForegroundColor Yellow
    Write-Host "      Descárgalo desde: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "      O continúa si ya está instalado pero no en PATH" -ForegroundColor Yellow
}

# Instalar dependencias
Write-Host ""
Write-Host "4️⃣  Instalando dependencias..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error al instalar dependencias" -ForegroundColor Red
    exit 1
}

# Verificar archivos .env
Write-Host ""
Write-Host "5️⃣  Verificando archivos .env..." -ForegroundColor Yellow

$envFiles = @(
    ".\apps\backend\.env",
    ".\apps\frontend\.env.local"
)

foreach ($envFile in $envFiles) {
    if (Test-Path $envFile) {
        Write-Host "   ✅ $envFile existe" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $envFile no encontrado" -ForegroundColor Yellow
    }
}

# Generar Prisma Client
Write-Host ""
Write-Host "6️⃣  Generando Prisma Client..." -ForegroundColor Yellow
pnpm db:generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Prisma Client generado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error al generar Prisma Client" -ForegroundColor Red
    exit 1
}

# Instrucciones finales
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Setup completado!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Asegurate de que PostgreSQL este corriendo en localhost:5432"
Write-Host "   2. Crea la base de datos playcoffee si no existe:"
Write-Host "      psql -U postgres -c `"CREATE DATABASE playcoffee;`""
Write-Host "   3. Ejecuta las migraciones:"
Write-Host "      pnpm db:migrate"
Write-Host "   4. Inicia el proyecto:"
Write-Host "      pnpm dev"
Write-Host ""
Write-Host "URLs de desarrollo:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:3000"
Write-Host "   Backend:   http://localhost:3001"
Write-Host "   API Docs:  http://localhost:3001/api/docs"
Write-Host ""
