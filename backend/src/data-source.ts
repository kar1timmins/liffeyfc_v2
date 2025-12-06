import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Wallet } from './entities/wallet.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Company } from './entities/company.entity';
import { WishlistItem } from './entities/wishlist-item.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { CompanyWallet } from './entities/company-wallet.entity';

/**
 * Parse DATABASE_URL if present (format: postgres://user:password@host:port/database)
 * Otherwise fall back to individual env vars
 */
function parseDatabaseConfig() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      return {
        host: url.hostname,
        port: Number(url.port) || 5432,
        username: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading /
      };
    } catch (err) {
      console.error('Invalid DATABASE_URL format:', err.message);
      console.log('Falling back to individual DB_* env vars');
    }
  }

  // Fallback to individual env vars
  return {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
    username: process.env.DB_USERNAME || process.env.POSTGRES_USER,
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.DB_DATABASE || process.env.POSTGRES_DB,
  };
}

const dbConfig = parseDatabaseConfig();

const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  entities: [User, Wallet, RefreshToken, Company, WishlistItem, UserWallet, CompanyWallet],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
});

export default AppDataSource;
