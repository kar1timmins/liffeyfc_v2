#!/bin/sh
set -e

echo "🔄 Starting deployment process..."
echo "📊 Node version: $(node --version)"
echo "📊 NPM version: $(npm --version)"
echo "📊 Database URL: ${DATABASE_URL:0:50}..."
echo "📁 Current directory: $(pwd)"

echo "📂 Contents of /app:"
ls -la /app

echo "📂 Contents of /app/dist:"
if [ -d "/app/dist" ]; then
  ls -la /app/dist
else
  echo "❌ /app/dist does not exist!"
  exit 1
fi

echo "📂 Contents of /app/dist/src:"
if [ -d "/app/dist/src" ]; then
  ls -la /app/dist/src
else
  echo "❌ /app/dist/src does not exist!"
  exit 1
fi

echo "📂 Checking critical files:"
[ -f "/app/dist/src/main.js" ] && echo "✅ main.js exists" || echo "❌ main.js missing!"
[ -f "/app/dist/src/data-source.js" ] && echo "✅ data-source.js exists" || echo "❌ data-source.js missing!"

echo "📂 Contents of /app/dist/src/migrations:"
if [ -d "/app/dist/src/migrations" ]; then
  ls -la /app/dist/src/migrations
  MIGRATION_COUNT=$(ls -1 /app/dist/src/migrations/*.js 2>/dev/null | wc -l)
  echo "📊 Found $MIGRATION_COUNT compiled migration files"
else
  echo "⚠️  /app/dist/src/migrations does not exist - no migrations to run"
fi

# Run migrations using compiled JavaScript from dist/
echo "🚀 Running TypeORM migrations from compiled JavaScript..."
MIGRATION_OUTPUT=$(node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js 2>&1)
MIGRATION_EXIT_CODE=$?
echo "$MIGRATION_OUTPUT"
if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migrations FAILED with exit code $MIGRATION_EXIT_CODE"
  echo "⚠️  The application may not work correctly without the required DB columns."
  echo "⚠️  Continuing anyway - inspect migration output above for details."
fi

# Start the application
echo "🌟 Starting NestJS application..."
exec node dist/src/main.js

