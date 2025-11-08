#!/bin/bash
# Check Railway database tables

echo "📊 Checking Railway PostgreSQL database..."

# Get the public DATABASE_URL from Railway dashboard
# You need to replace this with the actual public URL from Railway dashboard
# Format: postgresql://postgres:PASSWORD@gondola.proxy.rlwy.net:PORT/railway

PUBLIC_DB_URL="postgresql://postgres:TklcCJXNCvOvaBVUinCHHbJyDuTJKxyx@gondola.proxy.rlwy.net:32433/railway"

echo "🔍 Listing all tables in database..."
PGPASSWORD="TklcCJXNCvOvaBVUinCHHbJyDuTJKxyx" psql -h gondola.proxy.rlwy.net -p 32433 -U postgres -d railway -c "\dt"

echo ""
echo "🔍 Checking if 'users' table exists..."
PGPASSWORD="TklcCJXNCvOvaBVUinCHHbJyDuTJKxyx" psql -h gondola.proxy.rlwy.net -p 32433 -U postgres -d railway -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='users';"
