# Single image that can run either the web app or a worker.
#   web:     docker run -e DATABASE_URL=... IMAGE                     (default CMD)
#   ingest:  docker run -e DATABASE_URL=... IMAGE npm run worker:ingest
#   report:  docker run -e DATABASE_URL=... IMAGE npm run worker:report:loop
FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps ───────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── build ──────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime ────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Workers run TypeScript through tsx and the migration runner reads
# db/migrations at runtime, so the full install and source tree are kept
# rather than a minimal standalone bundle.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json package-lock.json next.config.mjs tsconfig.json ./
COPY db ./db
COPY src ./src
COPY workers ./workers
COPY scripts ./scripts

EXPOSE 3000
CMD ["npm", "run", "start"]
