#!/bin/sh
set -e

# Ensure SQLite data directory exists (mounted as volume in production)
mkdir -p /app/data

# Run any pending migrations against the configured DATABASE_URL
npx prisma migrate deploy

# Start compiled Express server (see tsconfig: outDir=dist, rootDir=./)
exec node dist/src/server.js
