#!/bin/sh
set -e

echo "🔄 Starting migration process..."
echo "📊 Database URL: ${DATABASE_URL:0:30}..."

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
