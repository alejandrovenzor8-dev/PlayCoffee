# ✅ Checklist de Configuración - PlayCoffee Local

## 📁 Archivos Creados/Actualizados

### Configuración
- ✅ `.env` - Variables de entorno globales (ya existía, verificado)
- ✅ `apps/backend/.env` - Variables del backend
- ✅ `apps/frontend/.env.local` - Variables del frontend

### Scripts de Automatización
- ✅ `setup.ps1` - Script de setup inicial
- ✅ `start.ps1` - Script de inicio rápido

### Documentación
- ✅ `README.md` - Actualizado con instrucciones locales
- ✅ `QUICK-START.md` - Guía de inicio rápido (3 pasos)
- ✅ `DESARROLLO-LOCAL.md` - Guía detallada completa
- ✅ `POSTGRESQL-SETUP.md` - Instalación de PostgreSQL
- ✅ `NOTAS-MIGRACION.md` - Migración Docker → Local
- ✅ `CHECKLIST.md` - Este archivo

### Código
- ✅ `apps/backend/prisma/schema.prisma` - Actualizado binaryTargets para Windows
- ✅ `apps/backend/tsconfig.json` - Agregado ignoreDeprecations
- ✅ `package.json` - Agregados scripts útiles

---

## 🎯 Próximos Pasos

### 1. Instalar PostgreSQL ⚠️ REQUERIDO
```powershell
# Ver guía completa en POSTGRESQL-SETUP.md

# Verificar si ya está instalado:
psql --version

# Si no está instalado, descargar desde:
# https://www.postgresql.org/download/windows/
```

### 2. Ejecutar Setup
```powershell
# Este script instala dependencias y genera Prisma Client
.\setup.ps1
```

### 3. Crear Base de Datos
```powershell
# Opción 1: Con psql
psql -U postgres
CREATE DATABASE playcoffee;
\q

# Opción 2: Con pgAdmin (GUI)
# Abrir pgAdmin → Create Database → "playcoffee"
```

### 4. Ejecutar Migraciones
```powershell
pnpm db:migrate
```

### 5. Iniciar Proyecto
```powershell
# Opción 1: Script rápido
.\start.ps1

# Opción 2: Manual
pnpm dev
```

### 6. Verificar
- [ ] Frontend: http://localhost:3000 carga correctamente
- [ ] Backend: http://localhost:3001/api/docs muestra Swagger
- [ ] Base de datos tiene las tablas (usar `pnpm db:studio`)

---

## 🔍 Verificación Rápida

### ¿Tengo todo instalado?
```powershell
# Node.js 18+
node --version

# pnpm 9+
pnpm --version

# PostgreSQL 16
psql --version

# Git (debería estar)
git --version
```

### ¿Está corriendo PostgreSQL?
```powershell
# Verificar servicio
Get-Service postgresql*

# Debería mostrar:
# Status: Running
```

### ¿Están las dependencias instaladas?
```powershell
# Verificar node_modules
Test-Path ".\node_modules"

# Si es False, ejecutar:
pnpm install
```

### ¿Está generado Prisma Client?
```powershell
# Verificar
Test-Path ".\apps\backend\node_modules\.prisma\client"

# Si es False, ejecutar:
pnpm db:generate
```

---

## 📊 Estado de Configuración

| Componente | Estado | Comando Verificación |
|------------|--------|---------------------|
| Node.js | ✅ | `node --version` |
| pnpm | ✅ | `pnpm --version` |
| PostgreSQL | ⚠️ Instalar | `psql --version` |
| Redis | ⏸️ Opcional | - |
| Dependencias | ⏸️ Pendiente | `pnpm install` |
| Prisma Client | ⏸️ Pendiente | `pnpm db:generate` |
| Base de datos | ⏸️ Pendiente | `pnpm db:migrate` |

---

## 🚀 Comandos de Desarrollo Diario

Una vez configurado, estos son los comandos que usarás día a día:

```powershell
# Iniciar proyecto (todos los días)
pnpm dev

# Ver base de datos (cuando necesites)
pnpm db:studio

# Crear nueva migración (cuando cambies el schema)
pnpm db:migrate

# Regenerar Prisma (si cambias el schema)
pnpm db:generate
```

---

## 📦 Estructura Final del Proyecto

```
PlayCoffee/
├── 📄 README.md                    # Overview principal
├── 📄 QUICK-START.md               # Inicio rápido (3 pasos)
├── 📄 DESARROLLO-LOCAL.md          # Guía completa
├── 📄 POSTGRESQL-SETUP.md          # Instalación PostgreSQL
├── 📄 NOTAS-MIGRACION.md          # Docker → Local
├── 📄 CHECKLIST.md                # Este archivo
│
├── 🔧 .env                        # Variables globales
├── 🔧 .env.example                # Template de ejemplo
├── 🔧 package.json                # Scripts root
├── 🔧 turbo.json                  # Config Turborepo
├── 🔧 pnpm-workspace.yaml         # Workspace config
│
├── 🚀 setup.ps1                   # Script setup inicial
├── 🚀 start.ps1                   # Script inicio rápido
│
├── 🐳 docker-compose.yml          # Opcional: Docker
│
├── apps/
│   ├── backend/                   # NestJS API
│   │   ├── .env                  # Variables backend
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Schema BD
│   │   └── src/                  # Código fuente
│   │
│   └── frontend/                  # Next.js App
│       ├── .env.local            # Variables frontend
│       └── src/                  # Código fuente
│
└── packages/
    └── shared/                    # Código compartido
```

---

## 💡 Tips Importantes

1. **Primera vez**: Sigue el orden del checklist
2. **Docker opcional**: Puedes usar Docker solo para PostgreSQL si quieres
3. **Backup**: El archivo `.gitignore` ya protege tus `.env`
4. **Scripts**: Usa `pnpm dev` desde la raíz para todo

---

## 🆘 ¿Problemas?

Consulta la sección de **Troubleshooting** en:
- [DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md#-troubleshooting)
- [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md#-troubleshooting)

---

## 📞 Archivos de Ayuda por Tema

| Si necesitas... | Consulta... |
|-----------------|-------------|
| Empezar rápido (3 pasos) | [QUICK-START.md](QUICK-START.md) |
| Instalación completa | [DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md) |
| Instalar PostgreSQL | [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md) |
| Entender los cambios | [NOTAS-MIGRACION.md](NOTAS-MIGRACION.md) |
| Verificar configuración | [CHECKLIST.md](CHECKLIST.md) (este archivo) |

---

✅ **Todo listo!** Ahora puedes desarrollar PlayCoffee en local sin Docker.

Para comenzar ahora mismo:
```powershell
.\setup.ps1
```
