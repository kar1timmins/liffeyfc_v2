import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Wallet } from './entities/wallet.entity';
import { RefreshToken } from './entities/refresh-token.entity';

const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const port = Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432);
const username = process.env.DB_USERNAME || process.env.POSTGRES_USER;
const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const database = process.env.DB_DATABASE || process.env.POSTGRES_DB;

const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  entities: [User, Wallet, RefreshToken],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
});

export default AppDataSource;
