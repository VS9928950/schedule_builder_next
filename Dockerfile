# syntax=docker/dockerfile:1
# Сборка образа Next.js (режим standalone). См. docs/install.md
# Сетевые RUN через host: на bridge часто нет рабочего IPv6 при AAAA у CDN; sysctl в build часто read-only (BuildKit).
FROM node:20-alpine AS base

FROM base AS deps
RUN --network=host apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN --network=host npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --network=host npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
