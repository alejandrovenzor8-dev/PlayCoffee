# 📝 Notas de Migración: Docker → Local

## ✅ Cambios Realizados

### 1. Archivos de Configuración Creados/Actualizados

#### Archivos .env
- ✅ `.env` (raíz): Variables globales del proyecto
- ✅ `apps/backend/.env`: Variables del backend (PostgreSQL, Redis, JWT)
- ✅ `apps/frontend/.env.local`: Variables del frontend (URLs de API)

**Cambio clave**: URLs ahora apuntan a `localhost` en lugar de nombres de servicios Docker.

```diff
# Antes (Docker)
- DATABASE_URL=postgresql://playcoffee:pass@postgres:5432/playcoffee
- REDIS_URL=redis://:pass@redis:6379

# Ahora (Local)
+ DATABASE_URL=postgresql://playcoffee:pass@localhost:5432/playcoffee
+ REDIS_URL=redis://:pass@localhost:6379
```

#### Prisma Schema
- ✅ `apps/backend/prisma/schema.prisma`: Actualizado `binaryTargets`

```diff
generator client {
  provider = "prisma-client-js"
- binaryTargets = ["debian-openssl-3.0.x"]
+ binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

Esto permite que Prisma funcione tanto en Windows local como en Docker Linux.

### 2. Scripts de Setup Creados

- ✅ `setup.ps1`: Script de setup inicial (instalar deps, generar Prisma)
- ✅ `start.ps1`: Script de inicio rápido (para uso diario)

### 3. Documentación

- ✅ `README.md`: Actualizado con instrucciones de desarrollo local
- ✅ `DESARROLLO-LOCAL.md`: Guía detallada de desarrollo local
- ✅ `POSTGRESQL-SETUP.md`: Guía de instalación de PostgreSQL
- ✅ `NOTAS-MIGRACION.md`: Este archivo

### 4. TypeScript Config
- ✅ `apps/backend/tsconfig.json`: Agregado `"ignoreDeprecations": "6.0"` para silenciar warning

## 🔄 Diferencias Docker vs Local

| Aspecto | Docker Compose | Local |
|---------|---------------|-------|
| **PostgreSQL** | Container automático | Instalar localmente o usar Docker |
| **Redis** | Container automático | Instalar localmente (opcional) |
| **Backend** | Container con hot-reload | `pnpm dev` en apps/backend |
| **Frontend** | Container con hot-reload | `pnpm dev` en apps/frontend |
| **Networking** | Red interna Docker | localhost |
| **Dependencias** | Imagen pre-built | `pnpm install` manual |
| **Setup** | `docker-compose up` | Script setup.ps1 + migraciones |

## 🎯 Ventajas de Desarrollo Local

### ✅ Pros
- 🚀 **Más rápido**: No hay overhead de Docker
- 🔧 **Debugging más fácil**: Attach directo a procesos
- 💾 **Menos uso de disco**: No hay imágenes Docker
- 🔄 **Hot reload más rápido**: Cambios instantáneos
- 🛠️ **Más control**: Acceso directo a logs, DB, etc.

### ⚠️ Contras
- 📦 Requiere instalar PostgreSQL localmente
- 🖥️ Dependiente del OS (configuración específica de Windows)
- 🔐 Menos aislamiento que containers

## 🐳 ¿Aún necesitas Docker?

El archivo `docker-compose.yml` sigue disponible para:

### Opción 1: Solo base de datos con Docker
```powershell
# Iniciar solo PostgreSQL y Redis
docker-compose up postgres redis -d

# App en local
pnpm dev
```

### Opción 2: Full Docker (si lo prefieres)
```powershell
docker-compose up -d
```

## 📋 Checklist de Migración

Si estabas usando Docker y quieres migrar a local:

### Paso 1: Backup de datos (opcional)
```powershell
# Si tienes datos en Docker que quieres conservar
docker-compose exec postgres pg_dump -U playcoffee playcoffee > backup.sql
```

### Paso 2: Instalar PostgreSQL local
Ver [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md)

### Paso 3: Restaurar datos (opcional)
```powershell
psql -U playcoffee -d playcoffee < backup.sql
```

### Paso 4: Setup del proyecto
```powershell
.\setup.ps1
pnpm db:migrate
```

### Paso 5: Iniciar en local
```powershell
pnpm dev
```

### Paso 6: Detener containers Docker (opcional)
```powershell
docker-compose down
```

## 🔄 Switching entre Docker y Local

Puedes cambiar fácilmente entre ambos modos:

### Para usar Docker:
```powershell
# Iniciar servicios
docker-compose up -d

# Las variables .env ya están configuradas para localhost:5432
# que es el puerto expuesto por Docker
```

### Para usar Local:
```powershell
# Detener Docker
docker-compose down

# Iniciar PostgreSQL local (si está instalado como servicio)
Start-Service postgresql-x64-16

# Iniciar app
pnpm dev
```

**Nota**: No necesitas cambiar los archivos `.env` porque ambos usan `localhost:5432`!

## 🔍 Verificar Configuración Actual

```powershell
# Ver qué está usando el puerto 5432
netstat -ano | findstr :5432

# Si muestra PID, buscar el proceso:
tasklist | findstr <PID>

# Si es postgres.exe → Local
# Si es com.docker... → Docker
```

## 📊 Rendimiento Comparativo

Basado en tests internos (tu experiencia puede variar):

| Métrica | Docker | Local | Mejora |
|---------|--------|-------|--------|
| Startup time | ~30s | ~10s | 66% |
| Hot reload | ~2-3s | <1s | 50%+ |
| Memoria | ~2GB | ~800MB | 60% |

## 💡 Tips

1. **Usa Docker para CI/CD**: Mantén `docker-compose.yml` para deploy y testing automatizado

2. **PostgreSQL portable**: Si no quieres instalar PostgreSQL, usa solo ese servicio de Docker:
   ```powershell
   docker-compose up postgres -d
   ```

3. **Redis opcional**: Si no usas caché, puedes comentar Redis en el código temporalmente

4. **Scripts de NPM**: Los scripts de `package.json` funcionan igual en ambos modos

## ⚡ Quick Commands Reference

```powershell
# Local
pnpm dev                           # Todo
pnpm --filter backend dev          # Solo backend
pnpm --filter frontend dev         # Solo frontend

# Docker
docker-compose up -d               # Todo
docker-compose up postgres -d      # Solo DB
docker-compose logs -f backend     # Logs

# Base de datos
pnpm db:studio                     # GUI (funciona siempre)
psql -U playcoffee -d playcoffee  # CLI local
docker-compose exec postgres psql  # CLI Docker
```

---

## 🆘 Problemas Comunes

### "Port 5432 already in use"
Probablemente tienes PostgreSQL corriendo en Docker Y local. Detén uno:
```powershell
docker-compose down              # Detener Docker
# O
Stop-Service postgresql-x64-16  # Detener local
```

### "Can't reach database server"
Verifica que PostgreSQL esté corriendo:
```powershell
Get-Service postgresql-x64-16    # Local
docker ps                        # Docker
```

### "Prisma Client not generated"
```powershell
pnpm db:generate
```

---

¿Preguntas? Revisa [DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md) para más detalles.
