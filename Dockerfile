# EsiFit — production image.
# Next.js needs a live Node process; this image is the portable unit that runs
# on a VPS, a Node PaaS (Liara/ArvanCloud/Railway) or any Docker host.
# Build:  docker build -t esifit .
# Run:    docker run -p 3000:3000 --env-file .env esifit

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The client must be generated from the schema before the app is compiled.
RUN bunx prisma generate
# Baked into the client bundle at build time, so it cannot be supplied at runtime.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN bun run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 1001 esifit

# `output: "standalone"` already contains the pruned node_modules it needs.
COPY --from=builder --chown=esifit:esifit /app/.next/standalone ./
COPY --from=builder --chown=esifit:esifit /app/.next/static ./.next/static
COPY --from=builder --chown=esifit:esifit /app/public ./public
# Schema + migrations, so `prisma migrate deploy` can run from this image.
COPY --from=builder --chown=esifit:esifit /app/prisma ./prisma
COPY --from=builder --chown=esifit:esifit /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=esifit:esifit /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=esifit:esifit /app/node_modules/prisma ./node_modules/prisma

USER esifit
EXPOSE 3000

# DATABASE_URL and SESSION_SECRET must be supplied by the host at runtime.
CMD ["node", "server.js"]
