#!/bin/sh
set -e

echo "🔄 Starting migration process..."
echo "📊 Database URL: ${DATABASE_URL:0:50}..."
echo "📁 Current directory: $(pwd)"
echo "📂 Contents of /app:"
ls -la /app
echo "📂 Contents of /app/src:"
ls -la /app/src || echo "❌ /app/src does not exist"
echo "📂 Contents of /app/src/migrations:"
ls -la /app/src/migrations || echo "❌ /app/src/migrations does not exist"
echo "📂 Checking if data-source.ts exists:"
ls -la /app/src/data-source.ts || echo "❌ /app/src/data-source.ts does not exist"
echo "📦 Checking TypeORM CLI:"
ls -la ./node_modules/typeorm/cli.js || echo "❌ TypeORM CLI not found"

# Run migrations
echo "🚀 Running TypeORM migrations..."
npx ts-node --transpile-only ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts

# Check migration status
if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migrations failed with exit code $?"
  exit 1
fi

# Start the application
echo "🌟 Starting NestJS application..."
exec node dist/main.js
