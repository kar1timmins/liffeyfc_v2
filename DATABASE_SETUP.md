# Database Setup Guide

This guide explains how to set up PostgreSQL for local development.

## Option 1: Using Docker Compose (Recommended)

This is the easiest way to get started without installing PostgreSQL locally.

```bash
# From project root
docker-compose up postgres redis

# Wait for the services to start (you'll see "database system is ready to accept connections")
# The database will be created automatically with values from .env
```

The database will be available at:
- **Host**: `localhost`
- **Port**: `5433` (mapped from 5432 inside container)
- **User**: `lfc_user`
- **Password**: `lfc_pass` (or your configured password)
- **Database**: `lfc_db`

## Option 2: Local PostgreSQL Installation

### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create the database and user
psql postgres << EOF
CREATE USER lfc_user WITH PASSWORD 'postgres';
CREATE DATABASE lfc_db OWNER lfc_user;
GRANT ALL PRIVILEGES ON DATABASE lfc_db TO lfc_user;
EOF

# Verify connection
psql -h localhost -U lfc_user -d lfc_db -c "SELECT 1"
```

### Linux (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Create user and database
sudo -u postgres psql << EOF
CREATE USER lfc_user WITH PASSWORD 'postgres';
CREATE DATABASE lfc_db OWNER lfc_user;
GRANT ALL PRIVILEGES ON DATABASE lfc_db TO lfc_user;
EOF

# Verify connection
psql -h localhost -U lfc_user -d lfc_db -c "SELECT 1"
```

### Windows

1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer
3. When prompted, set password for `postgres` user
4. Choose PostgreSQL as service name
5. Run pgAdmin (comes with PostgreSQL)
6. Connect and create database:
   - Right-click "Databases" → "Create" → "Database"
   - Name: `lfc_db`
   - Owner: Create new user `lfc_user` with password `postgres`

## Verify Database Connection

```bash
# Test with command line
psql -h localhost -U lfc_user -d lfc_db -c "SELECT 1"

# Or with different credentials if you changed them
psql -h localhost -U <your_user> -d <your_db> -c "SELECT 1"
```

Expected output:
```
 ?column?
----------
        1
(1 row)
```

## Update .env if Using Different Credentials

If you used different credentials than the defaults, update `backend/.env`:

```dotenv
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_database_name
```

## Running Migrations

Once the database is set up and the backend connects successfully:

```bash
cd backend

# Run migrations to create tables
pnpm run migration:run

# Or let TypeORM auto-sync (if TYPEORM_SYNCHRONIZE=true in .env)
pnpm start:dev
```

## Troubleshooting

### Error: "database does not exist"

This is normal on first startup - the database needs to be created:

```bash
# With Docker Compose - database auto-created
docker-compose up postgres

# With local PostgreSQL - create manually
createdb -h localhost -U postgres -p 5432 lfc_db
```

### Error: "FATAL: Peer authentication failed for user"

On Linux, PostgreSQL may require local socket authentication. Update `pg_hba.conf`:

```bash
# Find pg_hba.conf (usually /etc/postgresql/15/main/pg_hba.conf)
# Change "peer" to "md5" for localhost connections
# Then restart PostgreSQL
```

### Error: "could not translate host name 'postgres' to address"

This error in Docker Compose means the service isn't running. Make sure you're using `docker-compose up` from the project root.

### Can't connect with psql

Try these steps:

```bash
# List running PostgreSQL processes
ps aux | grep postgres

# Check if PostgreSQL is listening
netstat -an | grep 5432

# Try connecting with verbose output
psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=on
```

## Resetting the Database

To completely reset the database and start fresh:

```bash
# With Docker Compose
docker-compose down -v postgres  # -v removes volumes
docker-compose up postgres

# With local PostgreSQL
psql -h localhost -U postgres << EOF
DROP DATABASE IF EXISTS lfc_db;
DROP USER IF EXISTS lfc_user;
CREATE USER lfc_user WITH PASSWORD 'postgres';
CREATE DATABASE lfc_db OWNER lfc_user;
GRANT ALL PRIVILEGES ON DATABASE lfc_db TO lfc_user;
EOF
```

## Next Steps

1. ✅ Database created and running
2. Start backend: `cd backend && pnpm start:dev`
3. Migrations run automatically (if TYPEORM_SYNCHRONIZE=true)
4. Backend connects successfully
5. Start frontend: `cd frontend && pnpm dev`

See `DEVELOPMENT_TESTING.md` for testing the full application.
