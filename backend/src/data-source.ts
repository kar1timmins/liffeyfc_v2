import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Wallet } from './entities/wallet.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Company } from './entities/company.entity';
import { WishlistItem } from './entities/wishlist-item.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { CompanyWallet } from './entities/company-wallet.entity';
import { EscrowDeployment } from './entities/escrow-deployment.entity';
import { Contribution } from './entities/contribution.entity';
import { ContractDeploymentHistory } from './entities/contract-deployment-history.entity';
import { Payment } from './entities/payment.entity';
import { CreateCryptoPurchases1680000000000 } from './migrations/1680000000000-create-crypto-purchases';
import { AddPasswordResetFields1733508000000 } from './migrations/1733508000000-add-password-reset-fields';
import { AddAmountRaisedToWishlistItems1733508100000 } from './migrations/1733508100000-add-amount-raised-to-wishlist-items';
import { AddEscrowFieldsToWishlistItems1733990400000 } from './migrations/1733990400000-add-escrow-fields-to-wishlist-items';
import { AddEscrowTrackingTables1734000000000 } from './migrations/1734000000000-add-escrow-tracking-tables';
import { AddContractDeploymentHistoryTable1734060000000 } from './migrations/1734060000000-add-contract-deployment-history-table';
import { AddUserIdToWallets1762294400000 } from './migrations/1762294400000-add-userId-to-wallets';
import { CreateCompaniesAndWishlist1762294500000 } from './migrations/1762294500000-create-companies-and-wishlist';
import { RemoveDeprecatedCompanyFieldsFromUsers1762294600000 } from './migrations/1762294600000-remove-deprecated-company-fields-from-users';
import { AddWalletAddressesToCompanies1762294700000 } from './migrations/1762294700000-add-wallet-addresses-to-companies';
import { CreateWalletTables1762294800000 } from './migrations/1762294800000-create-wallet-tables';
import { AddUsdcWalletToUsers1765892400000 } from './migrations/1765892400000-add-usdc-wallet-to-users';
import { AddCampaignMetadataToEscrowDeployments1769999999999 } from './migrations/1769999999999-add-campaign-metadata-to-escrow-deployments';
import { AddMultichainAddressesToUserWallets1771000000000 } from './migrations/1771000000000-add-multichain-addresses-to-user-wallets';
import { AddMultichainToCompanyWallets1771000000001 } from './migrations/1771000000001-add-multichain-to-company-wallets';
import { CrossChainContributions1771000000002 } from './migrations/1771000000002-cross-chain-contributions';
import { AddNonEvmEscrowAddresses1771000000003 } from './migrations/1771000000003-add-non-evm-escrow-addresses';
import { CreatePaymentsTable1772000000000 } from './migrations/1772000000000-create-payments-table';
import { AddCompanySolanaStellarBitcoinAddresses1772000000001 } from './migrations/1772000000001-add-company-solana-stellar-bitcoin-addresses';
import { EnsureCompanyCryptoAddresses1773000000000 } from './migrations/1773000000000-ensure-company-crypto-addresses';

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
      if (process.env.NODE_ENV !== 'production') {
        console.log('Falling back to individual DB_* env vars');
      }
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
  entities: [
    User,
    Wallet,
    RefreshToken,
    Company,
    WishlistItem,
    UserWallet,
    CompanyWallet,
    EscrowDeployment,
    Contribution,
    ContractDeploymentHistory,
    Payment,
  ],
  migrations: [
    CreateCryptoPurchases1680000000000,
    AddPasswordResetFields1733508000000,
    AddAmountRaisedToWishlistItems1733508100000,
    AddEscrowFieldsToWishlistItems1733990400000,
    AddEscrowTrackingTables1734000000000,
    AddContractDeploymentHistoryTable1734060000000,
    AddUserIdToWallets1762294400000,
    CreateCompaniesAndWishlist1762294500000,
    RemoveDeprecatedCompanyFieldsFromUsers1762294600000,
    AddWalletAddressesToCompanies1762294700000,
    CreateWalletTables1762294800000,
    AddUsdcWalletToUsers1765892400000,
    AddCampaignMetadataToEscrowDeployments1769999999999,
    AddMultichainAddressesToUserWallets1771000000000,
    AddMultichainToCompanyWallets1771000000001,
    CrossChainContributions1771000000002,
    AddNonEvmEscrowAddresses1771000000003,
    CreatePaymentsTable1772000000000,
    AddCompanySolanaStellarBitcoinAddresses1772000000001,
    EnsureCompanyCryptoAddresses1773000000000,
  ],
  migrationsRun: false, // Don't auto-run migrations - use CLI explicitly
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  logging:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
});

export default AppDataSource;
