# 🗄️ Guía de Instalación de PostgreSQL en Windows

## Opción 1: Instalador oficial (Recomendado)

### Paso 1: Descargar PostgreSQL
1. Visita: https://www.postgresql.org/download/windows/
2. Descarga el instalador de EnterpriseDB para PostgreSQL 16
3. Ejecuta el instalador (postgresql-16.x-windows-x64.exe)

### Paso 2: Instalación
1. **Directorio de instalación**: Deja el predeterminado
2. **Componentes**: 
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (GUI)
   - ✅ Command Line Tools
   - ❌ Stack Builder (opcional)

3. **Directorio de datos**: Deja el predeterminado
4. **Contraseña**: Establece una contraseña para el usuario `postgres` (¡guárdala!)
5. **Puerto**: 5432 (predeterminado)
6. **Locale**: Spanish, Spain (o el que prefieras)

### Paso 3: Verificar instalación
```powershell
# Verifica que PostgreSQL esté en PATH
psql --version

# Si no funciona, agrega a PATH:
# C:\Program Files\PostgreSQL\16\bin
```

### Paso 4: Crear base de datos para PlayCoffee
```powershell
# Conectar a PostgreSQL
psql -U postgres

# En el prompt de psql:
CREATE DATABASE playcoffee;
CREATE USER playcoffee WITH PASSWORD 'playcoffee_secret';
GRANT ALL PRIVILEGES ON DATABASE playcoffee TO playcoffee;

# En PostgreSQL 15+, también necesitas:
\c playcoffee
GRANT ALL ON SCHEMA public TO playcoffee;

# Salir
\q
```

## Opción 2: Docker (si prefieres)

Si prefieres usar Docker solo para PostgreSQL:

```powershell
# Solo PostgreSQL con Docker
docker run --name playcoffee-postgres `
  -e POSTGRES_USER=playcoffee `
  -e POSTGRES_PASSWORD=playcoffee_secret `
  -e POSTGRES_DB=playcoffee `
  -p 5432:5432 `
  -d postgres:16-alpine

# Verificar
docker ps
```

## Opción 3: Scoop (Package Manager)

```powershell
# Instalar Scoop si no lo tienes
# https://scoop.sh

scoop install postgresql

# Iniciar servicio
pg_ctl start -D "C:\Users\TuUsuario\scoop\apps\postgresql\current\data"
```

## 🔍 Verificar que PostgreSQL está corriendo

```powershell
# Verificar servicio
Get-Service postgresql*

# O manualmente:
# Win + R -> services.msc
# Buscar: postgresql-x64-16
# Estado: Running
```

## 🛠️ pgAdmin 4 (GUI opcional)

1. Abre pgAdmin 4 (instalado con PostgreSQL)
2. Conecta al servidor (localhost, puerto 5432, usuario postgres)
3. Botón derecho en "Databases" → Create → Database
4. Nombre: `playcoffee`
5. Owner: `postgres` o `playcoffee`

## 🔐 Configuración de seguridad (Producción)

⚠️ Para desarrollo local está bien usar contraseñas simples, pero para producción:

```powershell
# Generar contraseñas seguras
[System.Web.Security.Membership]::GeneratePassword(32, 10)

# Actualizar en .env
DATABASE_URL=postgresql://playcoffee:PASSWORD_SEGURO@localhost:5432/playcoffee
```

## 🐛 Troubleshooting

### Error: "psql: command not found"
**Solución**: Agregar PostgreSQL a PATH
```powershell
# Agregar a variables de entorno del sistema:
C:\Program Files\PostgreSQL\16\bin
```

### Error: "connection refused"
**Solución**: Verificar que el servicio esté corriendo
```powershell
Get-Service postgresql-x64-16 | Start-Service
```

### Error: "password authentication failed"
**Solución**: Restablecer contraseña de postgres
```powershell
# 1. Editar pg_hba.conf
# C:\Program Files\PostgreSQL\16\data\pg_hba.conf

# 2. Cambiar 'scram-sha-256' por 'trust' temporalmente
# host    all             all             127.0.0.1/32            trust

# 3. Reiniciar servicio
Restart-Service postgresql-x64-16

# 4. Conectar sin contraseña y cambiarla
psql -U postgres
ALTER USER postgres PASSWORD 'nueva_contraseña';

# 5. Revertir pg_hba.conf y reiniciar
```

### Error: "role 'playcoffee' does not exist"
**Solución**:
```powershell
psql -U postgres
CREATE USER playcoffee WITH PASSWORD 'playcoffee_secret';
GRANT ALL PRIVILEGES ON DATABASE playcoffee TO playcoffee;
```

## 📊 Comandos útiles de psql

```sql
-- Ver bases de datos
\l

-- Conectar a una base de datos
\c playcoffee

-- Ver tablas
\dt

-- Ver usuarios/roles
\du

-- Salir
\q

-- Ejecutar SQL desde archivo
\i path/to/script.sql
```

## 🔄 Backup y Restore

```powershell
# Backup
pg_dump -U postgres playcoffee > backup.sql

# Restore
psql -U postgres playcoffee < backup.sql
```

---

## ✅ Checklist final

- [ ] PostgreSQL 16 instalado
- [ ] Servicio corriendo (puerto 5432)
- [ ] Base de datos `playcoffee` creada
- [ ] Usuario `playcoffee` creado con permisos
- [ ] psql funciona en terminal
- [ ] DATABASE_URL configurado en .env

Una vez completado, regresa a [DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md) para continuar con el setup del proyecto.
