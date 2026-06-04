# 🎮☕ PlayCoffee - Guía Rápida de Desarrollo Local

## 🚀 Inicio Rápido

### Primera vez (Setup completo)
```powershell
# 1. Ejecutar script de setup
.\setup.ps1

# 2. Crear base de datos PostgreSQL
psql -U postgres -c "CREATE DATABASE playcoffee;"

# 3. Ejecutar migraciones
pnpm db:migrate

# 4. Iniciar proyecto
pnpm dev
```

### Días posteriores (Solo iniciar)
```powershell
.\start.ps1
# O simplemente:
pnpm dev
```

## 📋 Prerequisitos

### Obligatorios
- ✅ Node.js 18+ ([Descargar](https://nodejs.org/))
- ✅ pnpm 9+ (`npm install -g pnpm`)
- ✅ PostgreSQL 16 ([Descargar](https://www.postgresql.org/download/windows/))

### Opcionales
- Redis ([Memurai para Windows](https://www.memurai.com/get-memurai))

## 🔧 Configuración de PostgreSQL

### Opción 1: Crear base de datos con psql
```powershell
psql -U postgres
CREATE DATABASE playcoffee;
CREATE USER playcoffee WITH PASSWORD 'playcoffee_secret';
GRANT ALL PRIVILEGES ON DATABASE playcoffee TO playcoffee;
\q
```

### Opción 2: Usar pgAdmin
1. Abrir pgAdmin
2. Crear nueva base de datos: `playcoffee`
3. Owner: `postgres` (o crear usuario `playcoffee`)

## 📦 Scripts Disponibles

```powershell
# Desarrollo
pnpm dev                    # Iniciar todo con Turbo
pnpm dev --filter backend   # Solo backend
pnpm dev --filter frontend  # Solo frontend

# Base de datos
pnpm db:generate           # Generar Prisma Client
pnpm db:migrate            # Ejecutar migraciones
pnpm db:studio             # Abrir Prisma Studio (GUI)

# Build y Deploy
pnpm build                 # Build de producción
pnpm lint                  # Ejecutar linter
pnpm test                  # Ejecutar tests
```

## 🌐 URLs de Desarrollo

| Servicio | URL | Descripción |
|----------|-----|-------------|
| Frontend | http://localhost:3000 | Aplicación Next.js |
| Backend | http://localhost:3001 | API NestJS |
| API Docs | http://localhost:3001/api/docs | Swagger UI |
| Prisma Studio | http://localhost:5555 | GUI Base de datos |

## 🗂️ Archivos de Configuración

```
PlayCoffee/
├── .env                      # Variables globales
├── apps/
│   ├── backend/
│   │   ├── .env             # Variables del backend
│   │   └── prisma/
│   │       └── schema.prisma # Schema de BD
│   └── frontend/
│       └── .env.local       # Variables del frontend
```

## 🔍 Troubleshooting

### Error: "Can't reach database server"
```powershell
# Verificar que PostgreSQL esté corriendo
Get-Service postgresql*

# O iniciar manualmente desde servicios de Windows
# Win+R -> services.msc -> postgresql-x64-16
```

### Error: "Port 3000 is already in use"
```powershell
# Encontrar y matar el proceso
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Error: Prisma Client no generado
```powershell
pnpm db:generate
```

### Resetear base de datos
```powershell
cd apps\backend
npx prisma migrate reset
cd ..\..
```

## 🎯 Estructura del Código

```
apps/backend/src/
├── common/              # Decoradores, filtros, interceptores
├── modules/            # Módulos de negocio
│   ├── auth/          # Autenticación
│   ├── users/         # Usuarios
│   ├── products/      # Productos
│   ├── orders/        # Órdenes + WebSocket
│   ├── tables/        # Mesas
│   └── ...
└── prisma/            # Prisma service

apps/frontend/src/
├── app/               # Next.js App Router
│   ├── (auth)/       # Rutas de autenticación
│   └── (dashboard)/  # Rutas del dashboard
├── components/        # Componentes React
├── store/            # Zustand stores
└── lib/              # Utilidades (API, Socket.io)
```

## 🔐 Credenciales por Defecto

```
PostgreSQL:
  Usuario: playcoffee
  Contraseña: playcoffee_secret
  Base de datos: playcoffee

Redis:
  Contraseña: redis_secret
```

**⚠️ IMPORTANTE**: Cambiar estas credenciales en producción!

## 📚 Documentación Adicional

- [Prisma Docs](https://www.prisma.io/docs)
- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Socket.io Docs](https://socket.io/docs/v4)

---

¿Problemas? Revisa los logs:
```powershell
# Backend logs están en la terminal donde ejecutaste pnpm dev
# Para más detalle, revisar: apps/backend/src/main.ts
```
