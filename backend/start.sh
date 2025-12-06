#!/bin/sh
set -e

echo "🔄 Starting migration process..."
echo "📊 Database URL: ${DATABASE_URL:0:50}..."
echo "📁 Current directory: $(pwd)"
echo "📂 Contents of /app:"
ls -la /app
echo "📂 Contents of /app/dist:"
ls -la /app/dist || echo "❌ /app/dist does not exist"
echo "📂 Contents of /app/dist/src:"
ls -la /app/dist/src || echo "❌ /app/dist/src does not exist"
echo "📂 Contents of /app/dist/src/migrations:"
ls -la /app/dist/src/migrations || echo "❌ /app/dist/src/migrations does not exist"
echo "📂 Checking if data-source.js exists:"
ls -la /app/dist/src/data-source.js || echo "❌ /app/dist/src/data-source.js does not exist"

# Run migrations using compiled JavaScript from dist/
echo "🚀 Running TypeORM migrations from compiled JavaScript..."
node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js

# Check migration status
if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migrations failed with exit code $?"
  exit 1
fi

# Start the application
echo "🌟 Starting NestJS application..."
exec node dist/src/main.js

