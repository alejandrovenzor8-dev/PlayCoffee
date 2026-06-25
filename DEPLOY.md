# PlayCoffee Deploy en Railway

Guia de produccion para desplegar PlayCoffee como dos servicios Railway:

- Backend: `apps/backend`
- Frontend: `apps/frontend`
- Base de datos: Railway PostgreSQL
- Redis: preparado como variable `REDIS_URL` para uso operativo futuro

## Estructura

```txt
apps/backend      NestJS + Prisma + Socket.io
apps/frontend     Next.js
packages/shared   Tipos/utilidades compartidas
pnpm-workspace.yaml
turbo.json
```

## Variables Backend

Configurar en el servicio Railway del backend:

```env
NODE_ENV=production
PORT=${{PORT}}
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<random-64-chars>
JWT_REFRESH_SECRET=<different-random-64-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://TU-FRONTEND.up.railway.app
```

Notas:
- `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser distintos y de 32+ caracteres.
- En produccion `CORS_ORIGIN=*` esta bloqueado.
- Si hay mas de un frontend permitido, usar lista separada por coma.

## Variables Frontend

Configurar en el servicio Railway del frontend:

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://TU-BACKEND.up.railway.app
NEXT_PUBLIC_WS_URL=https://TU-BACKEND.up.railway.app
```

`NEXT_PUBLIC_*` se inyecta al build de Next.js. Si cambia el dominio del backend, redeployar frontend.

## Backend Railway

Crear un servicio Railway desde el repo usando:

- Root: repo raiz
- Dockerfile: `apps/backend/Dockerfile`
- Healthcheck path: `/health`

El Dockerfile ejecuta:

```sh
pnpm --dir apps/backend exec prisma migrate deploy
pnpm --dir apps/backend run start:prod
```

No usa `migrate dev` en produccion.

Comandos manuales utiles:

```sh
corepack pnpm --filter backend exec prisma migrate deploy
corepack pnpm --filter backend exec prisma generate
corepack pnpm --filter backend exec prisma validate
```

## Frontend Railway

Crear otro servicio Railway desde el mismo repo usando:

- Root: repo raiz
- Dockerfile: `apps/frontend/Dockerfile`

El frontend escucha el `PORT` dinamico de Railway:

```sh
next start -p ${PORT:-3000}
```

## Socket.io

Realtime usa:

- Namespace: `/realtime`
- Rooms por sucursal: `branch:{branchId}`
- Auth: JWT en handshake `auth.token`
- URL frontend: `NEXT_PUBLIC_WS_URL=https://TU-BACKEND.up.railway.app`

El backend valida el JWT, busca usuario activo y solo une al room de su `branchId`.

## Seed Seguro

El seed local conserva datos demo. En produccion no usar credenciales demo.

Para crear admin inicial con seed:

```env
NODE_ENV=production
SEED_ADMIN_EMAIL=admin@tuempresa.com
SEED_ADMIN_PASSWORD=<password-seguro-12+>
```

Luego ejecutar manualmente:

```sh
corepack pnpm --filter backend db:seed
```

Recomendacion: ejecutar seed solo una vez, rotar la contrasena al primer login y retirar las variables `SEED_ADMIN_*`.

## Instalacion Local

```sh
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm dev
```

## Build Local

```sh
corepack pnpm lint
corepack pnpm build
corepack pnpm db:generate
corepack pnpm --filter backend exec prisma validate
```

## Checklist Post-Deploy

- Abrir `https://TU-BACKEND.up.railway.app/health`.
- Confirmar que `/api/v1/auth/login` responde.
- Confirmar que el frontend usa el backend publico, no localhost.
- Abrir dos ventanas y probar realtime en mesas u ordenes.
- Crear una orden, pagarla y confirmar que caja/reportes reflejan datos.
- Revisar logs de Railway por errores Prisma o CORS.
- Confirmar que `CORS_ORIGIN` coincide exactamente con el dominio frontend.
- Confirmar que migraciones aparecen aplicadas en PostgreSQL.

## Riesgos Operativos

- Railway cambia dominios si se recrea el servicio; actualizar `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WS_URL`.
- Cambios en `NEXT_PUBLIC_*` requieren rebuild del frontend.
- No ejecutar `prisma migrate dev` contra produccion.
- No versionar `.env`; ya esta ignorado por `.gitignore`.
