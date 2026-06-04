# ⚡ Quick Start Guide - PlayCoffee

## 🚀 Inicio Rápido (3 pasos)

```powershell
# 1. Setup inicial (solo primera vez)
.\setup.ps1

# 2. Crear base de datos
psql -U postgres -c "CREATE DATABASE playcoffee;"
pnpm db:migrate

# 3. Iniciar proyecto
pnpm dev
```

✅ Listo! Abre http://localhost:3000

---

## 📖 Documentación Completa

- 📘 [DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md) - Guía completa de desarrollo
- 🗄️ [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md) - Instalación de PostgreSQL
- 🔄 [NOTAS-MIGRACION.md](NOTAS-MIGRACION.md) - Migración de Docker a Local

---

## 🛠️ Comandos Más Usados

```powershell
# Desarrollo
pnpm dev                  # Iniciar todo
pnpm dev:backend          # Solo backend
pnpm dev:frontend         # Solo frontend

# Base de datos
pnpm db:studio            # GUI para la base de datos
pnpm db:migrate           # Aplicar migraciones
pnpm db:reset             # Resetear base de datos
```

---

## 📋 Requisitos

- Node.js 18+
- pnpm 9+
- PostgreSQL 16 (ver [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md))

---

## 🌐 URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- API Docs: http://localhost:3001/api/docs
- DB Studio: http://localhost:5555

---

## 🆘 Ayuda

¿Problemas? Consulta [DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md) - Sección Troubleshooting
