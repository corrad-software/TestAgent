# TestAgent — Express + Vite + Prisma (SQLite) + Playwright
# Pin image to the Playwright version resolved in package-lock.json for matching browser binaries.
ARG PLAYWRIGHT_VERSION=1.58.2
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS builder

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
COPY scenarios ./scenarios
COPY client ./client

RUN npm ci \
  && npm --prefix client ci \
  && npx prisma generate \
  && npm run build

# --- runtime ---
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Override in Coolify if you use a named volume for SQLite persistence
ENV DATABASE_URL=file:/app/data/testAgent.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN npx prisma generate \
  && chmod +x /docker-entrypoint.sh \
  && mkdir -p /app/data

EXPOSE 4000

# Coolify injects PORT; the app reads process.env.PORT (see src/server.ts)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/auth/me',r=>process.exit(r.statusCode===401||r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/docker-entrypoint.sh"]
