import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, HDNodeWallet } from 'ethers';
import * as crypto from 'crypto';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';

export interface GeneratedWallet {
  address: string;
  mnemonic: string;
  privateKey: string;
  derivationPath: string;
}

export interface WalletDownloadData {
  address: string;
  ethAddress: string;
  avaxAddress: string;
  mnemonic: string;
  privateKey: string;
  derivationPath: string;
  warning: string;
  createdAt: string;
}

@Injectable()
export class WalletGenerationService {
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly ENCRYPTION_KEY: Buffer;
  private readonly ETH_DERIVATION_BASE = "m/44'/60'/0'/0"; // Ethereum HD path
  private readonly AVAX_DERIVATION_BASE = "m/44'/9000'/0'/0"; // Avalanche HD path (placeholder)

  constructor(
    @InjectRepository(UserWallet)
    private userWalletRepo: Repository<UserWallet>,
    @InjectRepository(CompanyWallet)
    private companyWalletRepo: Repository<CompanyWallet>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
  ) {
    // Get encryption key from environment variable
    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error('WALLET_ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)');
    }
    this.ENCRYPTION_KEY = Buffer.from(key, 'hex');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.ENCRYPTION_ALGORITHM,
      this.ENCRYPTION_KEY,
      iv,
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      this.ENCRYPTION_ALGORITHM,
      this.ENCRYPTION_KEY,
      iv,
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate a new master HD wallet for a user
   * Can only be called once per user
   */
  async generateMasterWallet(userId: string): Promise<WalletDownloadData> {
    // Check if user already has a wallet
    const existing = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (existing) {
      throw new Error('User already has a master wallet. Only one wallet per user is allowed.');
    }

    // Generate new random wallet
    const wallet = Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase;
    if (!mnemonic) {
      throw new Error('Failed to generate mnemonic');
    }

    // Derive Ethereum address (standard path)
    const ethWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, `${this.ETH_DERIVATION_BASE}/0`);
    
    // For Avalanche, we use the same address format (EVM compatible)
    // In production, you might want to use different derivation paths
    const avaxAddress = ethWallet.address;

    // Encrypt sensitive data
    const encryptedMnemonic = this.encrypt(mnemonic);
    const encryptedPrivateKey = this.encrypt(ethWallet.privateKey);

    // Create user wallet record
    const userWallet = this.userWalletRepo.create({
      userId,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      encryptedMnemonic,
      encryptedPrivateKey,
      derivationPath: `${this.ETH_DERIVATION_BASE}/0`,
      nextChildIndex: 0,
    });

    await this.userWalletRepo.save(userWallet);

    // Return data for download (unencrypted for user to save)
    return {
      address: ethWallet.address,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      mnemonic,
      privateKey: ethWallet.privateKey,
      derivationPath: `${this.ETH_DERIVATION_BASE}/0`,
      warning: 'CRITICAL: Store this information securely offline. Never share your private key or mnemonic phrase. Loss of this data means permanent loss of access to your funds.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a child wallet for a company
   * Derives from the user's master wallet
   */
  async generateCompanyWallet(userId: string, companyId: string): Promise<{ ethAddress: string; avaxAddress: string }> {
    // Get user's master wallet
    const userWallet = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (!userWallet) {
      throw new Error('User does not have a master wallet. Generate a master wallet first.');
    }

    // Check if company already has a wallet
    const existingCompanyWallet = await this.companyWalletRepo.findOne({
      where: { companyId },
    });

    if (existingCompanyWallet) {
      // Return existing wallet addresses
      return {
        ethAddress: existingCompanyWallet.ethAddress,
        avaxAddress: existingCompanyWallet.avaxAddress,
      };
    }

    // Decrypt master wallet mnemonic
    const mnemonic = this.decrypt(userWallet.encryptedMnemonic);

    // Get next child index
    const childIndex = userWallet.nextChildIndex;
    const derivationPath = `${this.ETH_DERIVATION_BASE}/${childIndex}`;

    // Derive child wallet
    const childWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
    const avaxAddress = childWallet.address; // Same for Avalanche (EVM compatible)

    // Encrypt child private key
    const encryptedPrivateKey = this.encrypt(childWallet.privateKey);

    // Create company wallet record
    const companyWallet = this.companyWalletRepo.create({
      companyId,
      parentWalletId: userWallet.id,
      ethAddress: childWallet.address,
      avaxAddress: avaxAddress,
      encryptedPrivateKey,
      derivationPath,
      childIndex,
    });

    await this.companyWalletRepo.save(companyWallet);

    // Update parent wallet's next child index
    userWallet.nextChildIndex = childIndex + 1;
    await this.userWalletRepo.save(userWallet);

    // Update company entity with wallet addresses
    await this.companyRepo.update(companyId, {
      ethAddress: childWallet.address,
      avaxAddress: avaxAddress,
    });

    return {
      ethAddress: childWallet.address,
      avaxAddress: avaxAddress,
    };
  }

  /**
   * Check if user has a master wallet
   */
  async hasMasterWallet(userId: string): Promise<boolean> {
    const wallet = await this.userWalletRepo.findOne({
      where: { userId },
    });
    return !!wallet;
  }

  /**
   * Get user's master wallet addresses (public info only)
   */
  async getMasterWalletAddresses(userId: string): Promise<{ ethAddress: string; avaxAddress: string } | null> {
    const wallet = await this.userWalletRepo.findOne({
      where: { userId },
      select: ['ethAddress', 'avaxAddress'],
    });

    if (!wallet) {
      return null;
    }

    return {
      ethAddress: wallet.ethAddress,
      avaxAddress: wallet.avaxAddress,
    };
  }

  /**
   * Get all company wallets derived from user's master wallet
   */
  async getUserCompanyWallets(userId: string): Promise<Array<{ companyId: string; companyName: string; ethAddress: string; avaxAddress: string }>> {
    const userWallet = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (!userWallet) {
      return [];
    }

    const companyWallets = await this.companyWalletRepo.find({
      where: { parentWalletId: userWallet.id },
      relations: ['company'],
    });

    return companyWallets.map(cw => ({
      companyId: cw.companyId,
      companyName: cw.company.name,
      ethAddress: cw.ethAddress,
      avaxAddress: cw.avaxAddress,
    }));
  }
}
