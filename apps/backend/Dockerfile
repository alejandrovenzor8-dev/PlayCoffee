FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ─── Build shared ─────────────────────────────────────────────────────────────
FROM deps AS shared-build
WORKDIR /app
COPY packages/shared ./packages/shared
RUN cd packages/shared && pnpm run build

# ─── Build backend ────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY --from=shared-build /app/packages/shared/dist ./packages/shared/dist
COPY apps/backend ./apps/backend
RUN cd apps/backend && npx prisma generate && pnpm run build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./package.json

EXPOSE 3001

CMD ["node", "dist/main"]
