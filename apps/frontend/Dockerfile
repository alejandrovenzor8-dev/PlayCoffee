FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend ./apps/frontend

RUN pnpm install --frozen-lockfile --prod=false

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN test -n "$NEXT_PUBLIC_API_URL" && test -n "$NEXT_PUBLIC_WS_URL"
RUN pnpm --dir apps/frontend run build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY --from=builder /app /app
EXPOSE 3000

CMD ["sh", "-c", "pnpm --dir apps/frontend exec next start -p ${PORT:-3000}"]
