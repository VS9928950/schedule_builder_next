# Сборка образа Next.js (режим standalone). См. docs/install.md
FROM node:20-alpine AS base

FROM base AS deps
# Без маршрута IPv6 из docker bridge (часто в облаке): dualstack CDN отдаёт AAAA — apk/npm иначе долго ждут.
RUN echo 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null || true \
  && echo 1 > /proc/sys/net/ipv6/conf/default/disable_ipv6 2>/dev/null || true \
  && apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN echo 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null || true \
  && echo 1 > /proc/sys/net/ipv6/conf/default/disable_ipv6 2>/dev/null || true \
  && npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN echo 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null || true \
  && echo 1 > /proc/sys/net/ipv6/conf/default/disable_ipv6 2>/dev/null || true \
  && npm run build

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
