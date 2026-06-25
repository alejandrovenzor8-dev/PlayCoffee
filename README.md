# PlayCoffee 🎮☕

Mini-ERP especializado para cafetería + área infantil

## 🚀 Desarrollo Local (Sin Docker)

### Prerequisitos

1. **Node.js 18+** y **pnpm 9+**
   ```powershell
   node --version
   pnpm --version
   ```

2. **PostgreSQL 16** (instalado localmente)
   - Descargar desde: https://www.postgresql.org/download/windows/
   - Crear una base de datos llamada `playcoffee`

3. **Redis** (opcional, pero recomendado)
   - Descargar desde: https://github.com/microsoftarchive/redis/releases
   - O usar Memurai: https://www.memurai.com/get-memurai

### Configuración Inicial

1. **Instalar dependencias**
   ```powershell
   pnpm install
   ```

2. **Variables de entorno**
   
   Los archivos `.env` ya están configurados. Verifica que la configuración de la base de datos coincida con tu instalación local:
   - `.env` (raíz)
   - `apps/backend/.env`
   - `apps/frontend/.env.local`

3. **Generar Prisma Client y Migrar Base de Datos**
   ```powershell
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Iniciar el proyecto**
   ```powershell
   # Iniciar backend y frontend simultáneamente
   pnpm dev
   ```

   O iniciar cada servicio por separado:
   ```powershell
   # Terminal 1: Backend
   cd apps/backend
   pnpm dev

   # Terminal 2: Frontend
   cd apps/frontend
   pnpm dev
   ```

### URLs de Desarrollo

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/api/docs
- **Prisma Studio**: `pnpm db:studio`

### Scripts Útiles

```powershell
# Desarrollo
pnpm dev                 # Iniciar todo (turbo)
pnpm build              # Build de producción
pnpm lint               # Linter

# Base de datos
pnpm db:generate        # Generar Prisma Client
pnpm db:migrate         # Ejecutar migraciones
pnpm db:studio          # Abrir Prisma Studio
```

## 🐳 Desarrollo con Docker (Alternativa)

Si prefieres usar Docker:

```powershell
docker-compose up -d
```

## 📦 Estructura del Proyecto

```
PlayCoffee/
├── apps/
│   ├── backend/        # NestJS API
│   └── frontend/       # Next.js App
├── packages/
│   └── shared/         # Código compartido
└── docker-compose.yml  # Configuración Docker
```

## 🔧 Tecnologías

- **Frontend**: Next.js 16, React 19, TailwindCSS, Zustand
- **Backend**: NestJS, Prisma, PostgreSQL, Socket.io
- **Monorepo**: Turborepo + pnpm workspaces

## Deploy en Railway

La guia de produccion esta en [DEPLOY.md](DEPLOY.md). Incluye variables, Dockerfiles por servicio, migraciones Prisma, healthcheck, Socket.io y checklist post-deploy.
