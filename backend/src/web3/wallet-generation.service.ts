import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, HDNodeWallet } from 'ethers';
import * as crypto from 'crypto';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';

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
    @InjectRepository(EscrowDeployment)
    private escrowDeploymentRepo: Repository<EscrowDeployment>,
    @InjectRepository(WishlistItem)
    private wishlistItemRepo: Repository<WishlistItem>,
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
    // Handle empty or null encrypted data
    if (!encryptedData || encryptedData.trim() === '') {
      console.warn('[WalletGeneration] Attempting to decrypt empty encrypted data');
      throw new Error('No encrypted data to decrypt');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      console.error('[WalletGeneration] Invalid encrypted data format. Expected 3 parts, got:', parts.length);
      console.error('[WalletGeneration] First 50 chars:', encryptedData.substring(0, 50));
      throw new Error(`Invalid encrypted data format: expected 3 parts separated by ':', got ${parts.length} parts`);
    }

    try {
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
    } catch (error) {
      console.error('[WalletGeneration] Decryption error:', error.message);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
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
      nextChildIndex: 1,
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
   * Restore a master wallet from mnemonic phrase or private key
   * If restoring from mnemonic, all previously derived company wallets will regenerate identically
   */
  async restoreMasterWallet(
    userId: string,
    input: string,
  ): Promise<WalletDownloadData> {
    // Check if user already has a wallet
    const existing = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (existing) {
      throw new Error('User already has a master wallet. Cannot restore over existing wallet.');
    }

    let mnemonic: string;
    let ethWallet: any;

    // Determine if input is a mnemonic (12/24 words) or private key (hex string)
    const isPrivateKey = input.startsWith('0x') && input.length === 66; // 0x + 64 hex chars
    const wordCount = input.trim().split(/\s+/).length;
    const isMnemonic = (wordCount === 12 || wordCount === 24) && !input.startsWith('0x');

    if (isPrivateKey) {
      // Restore from private key - derive as master wallet
      try {
        const wallet = new Wallet(input);
        // Derive using the private key directly
        ethWallet = wallet;
        mnemonic = ''; // Private key restoration doesn't give us the mnemonic
      } catch (error) {
        throw new Error('Invalid private key format');
      }
    } else if (isMnemonic) {
      // Restore from mnemonic phrase
      try {
        // Validate mnemonic - fromPhrase returns HDNodeWallet
        ethWallet = HDNodeWallet.fromPhrase(input, undefined, `${this.ETH_DERIVATION_BASE}/0`);
        mnemonic = input.trim();
      } catch (error) {
        throw new Error('Invalid mnemonic phrase');
      }
    } else {
      throw new Error('Input must be a 12/24 word mnemonic phrase or a valid private key starting with 0x');
    }

    // For Avalanche, we use the same address format (EVM compatible)
    const avaxAddress = ethWallet.address;

    // Encrypt sensitive data
    const encryptedMnemonic = mnemonic ? this.encrypt(mnemonic) : '';
    const encryptedPrivateKey = this.encrypt(ethWallet.privateKey);

    // Create user wallet record with restored keys
    const userWallet = this.userWalletRepo.create({
      userId,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      encryptedMnemonic,
      encryptedPrivateKey,
      derivationPath: `${this.ETH_DERIVATION_BASE}/0`,
      nextChildIndex: 1, // Start at 1 for first child wallet
    });

    await this.userWalletRepo.save(userWallet);

    // Auto-generate wallets for all existing companies that don't have addresses
    try {
      const companiesWithoutAddresses = await this.companyRepo.find({
        where: {
          ownerId: userId,
          ethAddress: null as any,
        },
      });

      // Generate wallets for all companies
      for (let i = 0; i < companiesWithoutAddresses.length; i++) {
        try {
          const company = companiesWithoutAddresses[i];
          // Use the nextChildIndex incrementally
          const childIndex = (i + 1);
          const derivationPath = `${this.ETH_DERIVATION_BASE}/${childIndex}`;

          // Decrypt mnemonic if available, otherwise use private key
          const walletMnemonic = mnemonic || ethWallet.privateKey;
          let childWallet: HDNodeWallet;

          if (mnemonic) {
            childWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
          } else {
            // For private key restoration, we can't derive further
            // Just use the master wallet for all companies (simplified approach)
            childWallet = ethWallet;
          }

          const encryptedPrivateKey = this.encrypt(childWallet.privateKey);

          // Create company wallet record
          const companyWallet = this.companyWalletRepo.create({
            companyId: company.id,
            parentWalletId: userWallet.id,
            ethAddress: childWallet.address,
            avaxAddress: childWallet.address,
            encryptedPrivateKey,
            derivationPath,
            childIndex,
          });

          await this.companyWalletRepo.save(companyWallet);

          // Update company entity with wallet addresses
          await this.companyRepo.update(company.id, {
            ethAddress: childWallet.address,
            avaxAddress: childWallet.address,
          });
        } catch (error) {
          // Log but continue with other companies
          console.error(`Failed to generate wallet for company during restoration:`, error);
        }
      }

      // Update master wallet's nextChildIndex
      userWallet.nextChildIndex = companiesWithoutAddresses.length + 1;
      await this.userWalletRepo.save(userWallet);
    } catch (error) {
      // Log but don't fail restoration if company wallet generation fails
      console.error('Failed to auto-generate company wallets after restoration:', error);
    }

    // Return confirmation data
    return {
      address: ethWallet.address,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      mnemonic: mnemonic || '[Private Key - No Mnemonic]',
      privateKey: ethWallet.privateKey,
      derivationPath: `${this.ETH_DERIVATION_BASE}/0`,
      warning: 'CRITICAL: Wallet successfully restored. All previously derived company wallets will regenerate with the same addresses.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a child wallet for a company
   * Derives from the user's master wallet
   */
  async generateCompanyWallet(userId: string, companyId: string): Promise<{ ethAddress: string; avaxAddress: string }> {
    console.log('[WalletGeneration] Starting generateCompanyWallet for userId:', userId, 'companyId:', companyId);
    
    // Get user's master wallet
    const userWallet = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (!userWallet) {
      console.log('[WalletGeneration] No master wallet found for user:', userId);
      throw new Error('User does not have a master wallet. Generate a master wallet first.');
    }

    console.log('[WalletGeneration] Found user master wallet:', userWallet.id);

    // Check if company already has a wallet
    const existingCompanyWallet = await this.companyWalletRepo.findOne({
      where: { companyId },
    });

    if (existingCompanyWallet) {
      console.log('[WalletGeneration] Company already has wallet:', existingCompanyWallet.ethAddress);
      // Return existing wallet addresses
      return {
        ethAddress: existingCompanyWallet.ethAddress,
        avaxAddress: existingCompanyWallet.avaxAddress,
      };
    }

    console.log('[WalletGeneration] No existing wallet found, generating new one');

    try {
      let childWallet: HDNodeWallet | Wallet;
      let derivationPath: string;
      let childIndex: number;

      // Check if we have a mnemonic (from generated wallet) or only private key (from restored wallet)
      const hasMnemonic = userWallet.encryptedMnemonic && userWallet.encryptedMnemonic.trim() !== '';
      
      if (hasMnemonic) {
        // HD Wallet with mnemonic - can derive child wallets
        console.log('[WalletGeneration] Master wallet has mnemonic - using HD derivation');
        
        try {
          const mnemonic = this.decrypt(userWallet.encryptedMnemonic);
          
          // Get next child index for HD derivation
          childIndex = userWallet.nextChildIndex;
          derivationPath = `${this.ETH_DERIVATION_BASE}/${childIndex}`;
          console.log('[WalletGeneration] Using child index:', childIndex, 'path:', derivationPath);

          // Derive child wallet from mnemonic
          childWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
          console.log('[WalletGeneration] Derived child wallet address via HD:', childWallet.address);
        } catch (decryptError) {
          console.error('[WalletGeneration] Failed to decrypt or use mnemonic:', decryptError.message);
          throw new Error(
            'Master wallet mnemonic is corrupted. ' +
            'Please regenerate your master wallet from your backup. ' +
            'Go to your profile and generate a new master wallet.'
          );
        }
      } else {
        // Private key only (restored from private key) - generate independent child wallet
        console.log('[WalletGeneration] Master wallet has no mnemonic (restored from private key) - generating independent child wallet');
        
        // For wallets restored from private key only, we generate independent random wallets
        // Each company gets a unique wallet (not derived from the same key)
        const newWallet = Wallet.createRandom();
        childWallet = newWallet;
        childIndex = userWallet.nextChildIndex;
        derivationPath = `independent-wallet-${childIndex}`;
        console.log('[WalletGeneration] Generated independent wallet for company:', childWallet.address);
      }

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

      const savedWallet = await this.companyWalletRepo.save(companyWallet);
      console.log('[WalletGeneration] Saved company wallet record:', savedWallet.id);

      // Update parent wallet's next child index
      userWallet.nextChildIndex = childIndex + 1;
      await this.userWalletRepo.save(userWallet);
      console.log('[WalletGeneration] Updated parent wallet nextChildIndex to:', childIndex + 1);

      // Update company entity with wallet addresses
      const updateResult = await this.companyRepo.update(companyId, {
        ethAddress: childWallet.address,
        avaxAddress: avaxAddress,
      });
      console.log('[WalletGeneration] Company update result:', updateResult.affected, 'rows affected');

      // Verify the update by fetching the company
      const updatedCompany = await this.companyRepo.findOne({
        where: { id: companyId }
      });
      console.log('[WalletGeneration] Verified company addresses - ETH:', updatedCompany?.ethAddress, 'AVAX:', updatedCompany?.avaxAddress);

      return {
        ethAddress: childWallet.address,
        avaxAddress: avaxAddress,
      };
    } catch (error) {
      console.error('[WalletGeneration] Error during wallet generation:', error.message, error.stack);
      throw error;
    }
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

  /**
   * Look up a wallet address and return company + bounty information
   * Supports both:
   * 1. Company wallet addresses (child addresses from company wallet derivation)
   * 2. User master wallet addresses (parent wallet from user wallet derivation)
   * 
   * Used to verify recipient before sending funds
   */
  async lookupWalletAddress(address: string, chain: 'ethereum' | 'avalanche') {
    const address_lower = address.toLowerCase();

    // Try to find company with this wallet address (company child wallet)
    let company: Company | null = null;

    if (chain === 'ethereum') {
      company = await this.companyRepo
        .createQueryBuilder('company')
        .leftJoinAndSelect('company.wishlistItems', 'wishlistItems')
        .where('LOWER(company.ethAddress) = :ethAddress', { ethAddress: address_lower })
        .getOne();
    } else {
      company = await this.companyRepo
        .createQueryBuilder('company')
        .leftJoinAndSelect('company.wishlistItems', 'wishlistItems')
        .where('LOWER(company.avaxAddress) = :avaxAddress', { avaxAddress: address_lower })
        .getOne();
    }

    // If not found as company wallet, try finding as user master wallet
    if (!company) {
      let user: User | null = null;

      if (chain === 'ethereum') {
        user = await this.userRepo
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.userWallet', 'userWallet')
          .leftJoinAndSelect('user.companies', 'companies')
          .leftJoinAndSelect('companies.wishlistItems', 'wishlistItems')
          .where('LOWER(userWallet.ethAddress) = :ethAddress', { ethAddress: address_lower })
          .getOne();
      } else {
        user = await this.userRepo
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.userWallet', 'userWallet')
          .leftJoinAndSelect('user.companies', 'companies')
          .leftJoinAndSelect('companies.wishlistItems', 'wishlistItems')
          .where('LOWER(userWallet.avaxAddress) = :avaxAddress', { avaxAddress: address_lower })
          .getOne();
      }

      // If found as user with companies, aggregate bounties from all their companies
      if (user && user.companies && user.companies.length > 0) {
        // Get all wishlist items from all user's companies
        const allWishlistIds = user.companies.flatMap(comp => 
          comp.wishlistItems?.map(w => w.id) || []
        );

        let bounties: any[] = [];
        if (allWishlistIds.length > 0) {
          const deployments = await this.escrowDeploymentRepo.createQueryBuilder('ed')
            .where('ed.wishlistItemId IN (:...wishlistIds)', { wishlistIds: allWishlistIds })
            .andWhere('ed.chain = :chain', { chain })
            .leftJoinAndSelect('ed.wishlistItem', 'wi')
            .getMany();

          bounties = deployments
            .filter(d => {
              // Only show active bounties (not expired)
              const now = new Date();
              return d.deadline > now;
            })
            .map(d => ({
              id: d.id,
              title: d.wishlistItem?.title || 'Unnamed Bounty',
              description: d.wishlistItem?.description,
              targetAmount: parseFloat(d.targetAmountEth.toString()),
              currentAmount: 0, // TODO: fetch from blockchain or database
              chain: d.chain as 'ethereum' | 'avalanche',
              status: 'active',
              contractAddress: d.contractAddress,
              deadline: d.deadline,
            }));
        }

        // Return all companies and their bounties
        return {
          isUserMasterWallet: true,
          companies: user.companies.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            industry: c.industry,
          })),
          bounties, // Combined bounties from all user's companies
        };
      }

      return null;
    }

    // Found as company wallet - return single company
    const wishlistIds = company.wishlistItems?.map(w => w.id) || [];
    
    let bounties: any[] = [];
    if (wishlistIds.length > 0) {
      const deployments = await this.escrowDeploymentRepo.createQueryBuilder('ed')
        .where('ed.wishlistItemId IN (:...wishlistIds)', { wishlistIds })
        .andWhere('ed.chain = :chain', { chain })
        .leftJoinAndSelect('ed.wishlistItem', 'wi')
        .getMany();

      bounties = deployments
        .filter(d => {
          // Only show active bounties (not expired)
          const now = new Date();
          return d.deadline > now;
        })
        .map(d => ({
          id: d.id,
          title: d.wishlistItem?.title || 'Unnamed Bounty',
          description: d.wishlistItem?.description,
          targetAmount: parseFloat(d.targetAmountEth.toString()),
          currentAmount: 0, // TODO: fetch from blockchain or database
          chain: d.chain as 'ethereum' | 'avalanche',
          status: 'active',
          contractAddress: d.contractAddress,
          deadline: d.deadline,
        }));
    }

    return {
      isUserMasterWallet: false,
      company: {
        id: company.id,
        name: company.name,
        description: company.description,
        industry: company.industry,
      },
      bounties,
    };
  }
}
