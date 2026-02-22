import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, HDNodeWallet, Mnemonic } from 'ethers';
import * as crypto from 'crypto';
import { derivePath } from 'ed25519-hd-key';
import * as nacl from 'tweetnacl';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58: { encode: (buf: Buffer | Uint8Array) => string } = require('bs58');
import { Keypair as StellarKeypair } from '@stellar/stellar-base';
import { bech32 } from 'bech32';
import { UserWallet } from '../entities/user-wallet.entity';
import { CompanyWallet } from '../entities/company-wallet.entity';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';

// Dev mode logging helper
const isDev = process.env.NODE_ENV !== 'production';
const devLog = {
  log: (msg: string, ...args: any[]) => isDev && console.log(`[WalletGeneration] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[WalletGeneration] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WalletGeneration] ${msg}`, ...args),
};

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
  solanaAddress?: string;
  stellarAddress?: string;
  bitcoinAddress?: string;
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
  private readonly SOL_DERIVATION_PATH = "m/44'/501'/0'/0'"; // Solana SLIP-0010 path
  private readonly XLM_DERIVATION_PATH = "m/44'/148'/0'"; // Stellar SLIP-0010 path
  private readonly BTC_DERIVATION_BASE = "m/84'/0'/0'/0"; // Bitcoin native SegWit (P2WPKH)

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
      devLog.warn('Attempting to decrypt empty encrypted data');
      throw new Error('No encrypted data to decrypt');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      devLog.error('Invalid encrypted data format. Expected 3 parts, got:', parts.length);
      devLog.error('First 50 chars:', encryptedData.substring(0, 50));
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      devLog.error('Decryption error:', errorMessage);
      throw new Error(`Failed to decrypt data: ${errorMessage}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Multi-chain address derivation helpers
  // ---------------------------------------------------------------------------

  /**
   * Derive Solana, Stellar and Bitcoin addresses from a BIP39 mnemonic.
   * Called during wallet generation / restore so all addresses are stored
   * in a single DB row alongside the existing EVM addresses.
   */
  private deriveNonEvmAddresses(mnemonic: string, childIndex = 0): {
    solanaAddress: string;
    stellarAddress: string;
    bitcoinAddress: string;
  } {
    // Compute the 64-byte BIP39 seed (no passphrase) from the mnemonic
    const mnemonicObj = Mnemonic.fromPhrase(mnemonic);
    const seedHex = mnemonicObj.computeSeed(); // hex string

    // Build per-chain derivation paths that vary by childIndex.
    // childIndex=0 produces the same paths as the legacy hardcoded master constants.
    const solPath = `m/44'/501'/${childIndex}'/0'`;
    const xlmPath = `m/44'/148'/${childIndex}'`;

    // ---- Solana (ed25519, path varies by childIndex) -----------------------
    const { key: solKey } = derivePath(solPath, seedHex);
    const solKeypair = nacl.sign.keyPair.fromSeed(new Uint8Array(solKey));
    const solanaAddress = bs58.encode(Buffer.from(solKeypair.publicKey));

    // ---- Stellar (ed25519, path varies by childIndex) ----------------------
    const { key: xlmKey } = derivePath(xlmPath, seedHex);
    const stellarKeypair = StellarKeypair.fromRawEd25519Seed(Buffer.from(xlmKey));
    const stellarAddress = stellarKeypair.publicKey(); // G...

    // ---- Bitcoin P2WPKH native SegWit (path varies by childIndex) ----------
    const btcWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, `${this.BTC_DERIVATION_BASE}/${childIndex}`);
    const pubkeyBytes = Buffer.from(btcWallet.signingKey.compressedPublicKey.slice(2), 'hex'); // strip 0x
    const sha256Hash = crypto.createHash('sha256').update(pubkeyBytes).digest();
    const hash160 = crypto.createHash('ripemd160').update(sha256Hash).digest();
    const words = bech32.toWords(hash160);
    words.unshift(0x00); // witness version 0
    const bitcoinAddress = bech32.encode('bc', words); // mainnet bc1q...

    return { solanaAddress, stellarAddress, bitcoinAddress };
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

    // Derive non-EVM addresses (Solana, Stellar, Bitcoin) from the same mnemonic
    const { solanaAddress, stellarAddress, bitcoinAddress } = this.deriveNonEvmAddresses(mnemonic);

    // Encrypt sensitive data
    const encryptedMnemonic = this.encrypt(mnemonic);
    const encryptedPrivateKey = this.encrypt(ethWallet.privateKey);

    // Create user wallet record
    const userWallet = this.userWalletRepo.create({
      userId,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      solanaAddress,
      stellarAddress,
      bitcoinAddress,
      encryptedMnemonic,
      encryptedPrivateKey,
      derivationPath: `${this.ETH_DERIVATION_BASE}/0`,
      nextChildIndex: 1,
    });

    await this.userWalletRepo.save(userWallet);

    // Also record the USDC wallet address on the user (same as ETH address)
    try {
      await this.userRepo.update(userId, { usdcWalletAddress: ethWallet.address });
      devLog.log('Saved usdcWalletAddress for user:', userId, ethWallet.address);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      devLog.error('Failed to save usdcWalletAddress on user:', errorMessage);
    }

    // Return data for download (unencrypted for user to save)
    return {
      address: ethWallet.address,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      solanaAddress,
      stellarAddress,
      bitcoinAddress,
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

    // Derive non-EVM addresses only when restoring from mnemonic (private key restore cannot derive them)
    let solanaAddress: string | null = null;
    let stellarAddress: string | null = null;
    let bitcoinAddress: string | null = null;
    if (mnemonic) {
      try {
        ({ solanaAddress, stellarAddress, bitcoinAddress } = this.deriveNonEvmAddresses(mnemonic));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        devLog.warn('Could not derive non-EVM addresses during restore:', errorMessage);
      }
    }

    // Encrypt sensitive data
    const encryptedMnemonic = mnemonic ? this.encrypt(mnemonic) : '';
    const encryptedPrivateKey = this.encrypt(ethWallet.privateKey);

    // Create user wallet record with restored keys
    const userWallet = this.userWalletRepo.create({
      userId,
      ethAddress: ethWallet.address,
      avaxAddress: avaxAddress,
      solanaAddress,
      stellarAddress,
      bitcoinAddress,
      encryptedMnemonic,
      encryptedPrivateKey,
      derivationPath: `${this.ETH_DERIVATION_BASE}/0`,
      nextChildIndex: 1, // Start at 1 for first child wallet
    });

    await this.userWalletRepo.save(userWallet);

    // Also record the USDC wallet address on the user (same as ETH address)
    try {
      await this.userRepo.update(userId, { usdcWalletAddress: ethWallet.address });
      devLog.log('Saved usdcWalletAddress for user (restore):', userId, ethWallet.address);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      devLog.error('Failed to save usdcWalletAddress on user (restore):', errorMessage);
    }

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
      ...(solanaAddress && { solanaAddress }),
      ...(stellarAddress && { stellarAddress }),
      ...(bitcoinAddress && { bitcoinAddress }),
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
    devLog.log('Starting generateCompanyWallet for userId:', userId, 'companyId:', companyId);
    
    // Get user's master wallet
    const userWallet = await this.userWalletRepo.findOne({
      where: { userId },
    });

    if (!userWallet) {
      devLog.log('No master wallet found for user:', userId);
      throw new Error('User does not have a master wallet. Generate a master wallet first.');
    }

    devLog.log('Found user master wallet:', userWallet.id);

    // Check if company already has a wallet
    const existingCompanyWallet = await this.companyWalletRepo.findOne({
      where: { companyId },
    });

    if (existingCompanyWallet) {
      devLog.log('Company already has wallet:', existingCompanyWallet.ethAddress);
      // Return existing wallet addresses
      return {
        ethAddress: existingCompanyWallet.ethAddress,
        avaxAddress: existingCompanyWallet.avaxAddress,
      };
    }

    devLog.log('No existing wallet found, generating new one');

    try {
      let childWallet: HDNodeWallet | Wallet;
      let derivationPath: string;
      let childIndex: number;

      // Check if we have a mnemonic (from generated wallet) or only private key (from restored wallet)
      const hasMnemonic = userWallet.encryptedMnemonic && userWallet.encryptedMnemonic.trim() !== '';
      
      if (hasMnemonic) {
        // HD Wallet with mnemonic - can derive child wallets
        devLog.log('Master wallet has mnemonic - using HD derivation');
        
        try {
          const mnemonic = this.decrypt(userWallet.encryptedMnemonic);
          
          // Get next child index for HD derivation
          childIndex = userWallet.nextChildIndex;
          derivationPath = `${this.ETH_DERIVATION_BASE}/${childIndex}`;
          devLog.log('Using child index:', childIndex, 'path:', derivationPath);

          // Derive child wallet from mnemonic
          childWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
          devLog.log('Derived child wallet address via HD:', childWallet.address);
        } catch (decryptError) {
          const errorMessage = decryptError instanceof Error ? decryptError.message : String(decryptError);
          console.error('[WalletGeneration] Failed to decrypt or use mnemonic:', errorMessage);
          throw new Error(
            'Master wallet mnemonic is corrupted. ' +
            'Please regenerate your master wallet from your backup. ' +
            'Go to your profile and generate a new master wallet.'
          );
        }
      } else {
        // Private key only (restored from private key) - generate independent child wallet
        devLog.log('Master wallet has no mnemonic (restored from private key) - generating independent child wallet');
        
        // For wallets restored from private key only, we generate independent random wallets
        // Each company gets a unique wallet (not derived from the same key)
        const newWallet = Wallet.createRandom();
        childWallet = newWallet;
        childIndex = userWallet.nextChildIndex;
        derivationPath = `independent-wallet-${childIndex}`;
        devLog.log('Generated independent wallet for company:', childWallet.address);
      }

      const avaxAddress = childWallet.address; // Same for Avalanche (EVM compatible)

      // Derive non-EVM addresses at the same child index when mnemonic is available
      let solanaAddress: string | null = null;
      let stellarAddress: string | null = null;
      let bitcoinAddress: string | null = null;
      if (hasMnemonic) {
        try {
          const mnemonic = this.decrypt(userWallet.encryptedMnemonic);
          ({ solanaAddress, stellarAddress, bitcoinAddress } = this.deriveNonEvmAddresses(mnemonic, childIndex));
          devLog.log('Derived non-EVM addresses for company wallet at index:', childIndex);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          devLog.warn('Could not derive non-EVM addresses for company wallet:', msg);
        }
      }

      // Encrypt child private key
      const encryptedPrivateKey = this.encrypt(childWallet.privateKey);

      // Create company wallet record (includes SOL/XLM/BTC when derivable)
      const companyWallet = this.companyWalletRepo.create({
        companyId,
        parentWalletId: userWallet.id,
        ethAddress: childWallet.address,
        avaxAddress: avaxAddress,
        solanaAddress,
        stellarAddress,
        bitcoinAddress,
        encryptedPrivateKey,
        derivationPath,
        childIndex,
      });

      const savedWallet = await this.companyWalletRepo.save(companyWallet);
      devLog.log('Saved company wallet record:', savedWallet.id);

      // Update parent wallet's next child index
      userWallet.nextChildIndex = childIndex + 1;
      await this.userWalletRepo.save(userWallet);
      devLog.log('Updated parent wallet nextChildIndex to:', childIndex + 1);

      // Update company entity with wallet addresses
      const updateResult = await this.companyRepo.update(companyId, {
        ethAddress: childWallet.address,
        avaxAddress: avaxAddress,
      });
      devLog.log('Company update result:', updateResult.affected, 'rows affected');

      // Verify the update by fetching the company
      const updatedCompany = await this.companyRepo.findOne({
        where: { id: companyId }
      });
      devLog.log('Verified company addresses - ETH:', updatedCompany?.ethAddress, 'AVAX:', updatedCompany?.avaxAddress);

      return {
        ethAddress: childWallet.address,
        avaxAddress: avaxAddress,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('[WalletGeneration] Error during wallet generation:', errorMessage, errorStack);
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
  async getMasterWalletAddresses(userId: string): Promise<{
    ethAddress: string;
    avaxAddress: string;
    solanaAddress: string | null;
    stellarAddress: string | null;
    bitcoinAddress: string | null;
  } | null> {
    const wallet = await this.userWalletRepo.findOne({
      where: { userId },
      select: ['id', 'ethAddress', 'avaxAddress', 'solanaAddress', 'stellarAddress', 'bitcoinAddress', 'encryptedMnemonic'],
    });

    if (!wallet) {
      return null;
    }

    // Auto-derive SOL/XLM/BTC for wallets created before multi-chain support was added.
    // Safe no-op when addresses already exist.
    if (!wallet.solanaAddress && wallet.encryptedMnemonic?.trim()) {
      try {
        const mnemonic = this.decrypt(wallet.encryptedMnemonic);
        const { solanaAddress, stellarAddress, bitcoinAddress } = this.deriveNonEvmAddresses(mnemonic, 0);
        await this.userWalletRepo.update(wallet.id, { solanaAddress, stellarAddress, bitcoinAddress });
        wallet.solanaAddress = solanaAddress;
        wallet.stellarAddress = stellarAddress;
        wallet.bitcoinAddress = bitcoinAddress;
        devLog.log('Auto-derived multichain addresses for user:', userId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        devLog.warn('Auto-derive multichain addresses failed:', errorMessage);
      }
    }

    return {
      ethAddress: wallet.ethAddress,
      avaxAddress: wallet.avaxAddress,
      solanaAddress: wallet.solanaAddress ?? null,
      stellarAddress: wallet.stellarAddress ?? null,
      bitcoinAddress: wallet.bitcoinAddress ?? null,
    };
  }

  /**
   * Retrieve decrypted mnemonic/private key for the user’s master wallet.
   * Returns null if no wallet exists.
   */
  async getMasterWalletDownload(userId: string): Promise<WalletDownloadData | null> {
    const wallet = await this.userWalletRepo.findOne({ where: { userId } });
    if (!wallet) return null;

    let mnemonic = '';
    if (wallet.encryptedMnemonic && wallet.encryptedMnemonic.trim()) {
      try {
        mnemonic = this.decrypt(wallet.encryptedMnemonic);
      } catch (err) {
        devLog.error('Failed to decrypt mnemonic for download:', err instanceof Error ? err.message : err);
      }
    }

    let privateKey = '';
    if (wallet.encryptedPrivateKey && wallet.encryptedPrivateKey.trim()) {
      try {
        privateKey = this.decrypt(wallet.encryptedPrivateKey);
      } catch (err) {
        devLog.error('Failed to decrypt private key for download:', err instanceof Error ? err.message : err);
      }
    }

    return {
      address: wallet.ethAddress,
      ethAddress: wallet.ethAddress,
      avaxAddress: wallet.avaxAddress,
      solanaAddress: wallet.solanaAddress || undefined,
      stellarAddress: wallet.stellarAddress || undefined,
      bitcoinAddress: wallet.bitcoinAddress || undefined,
      mnemonic: mnemonic || '[unavailable]',
      privateKey: privateKey || '[unavailable]',
      derivationPath: wallet.derivationPath || '',
      warning: 'This information is sensitive. Do not share it. Download and store securely.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Derive and persist Solana, Stellar and Bitcoin addresses for an existing
   * wallet that was generated before multi-chain support was added.
   * Safe to call if addresses already exist (will skip derivation).
   */
  async addMultichainAddresses(userId: string): Promise<{
    solanaAddress: string;
    stellarAddress: string;
    bitcoinAddress: string;
  }> {
    const userWallet = await this.userWalletRepo.findOne({ where: { userId } });
    if (!userWallet) throw new Error('No master wallet found');

    // Already have all addresses — return them without touching the DB
    if (userWallet.solanaAddress && userWallet.stellarAddress && userWallet.bitcoinAddress) {
      return {
        solanaAddress: userWallet.solanaAddress,
        stellarAddress: userWallet.stellarAddress,
        bitcoinAddress: userWallet.bitcoinAddress,
      };
    }

    if (!userWallet.encryptedMnemonic || userWallet.encryptedMnemonic.trim() === '') {
      throw new Error('Wallet was restored from a private key only — multi-chain derivation requires the mnemonic phrase.');
    }

    const mnemonic = this.decrypt(userWallet.encryptedMnemonic);
    const { solanaAddress, stellarAddress, bitcoinAddress } = this.deriveNonEvmAddresses(mnemonic);

    await this.userWalletRepo.update(userWallet.id, { solanaAddress, stellarAddress, bitcoinAddress });

    return { solanaAddress, stellarAddress, bitcoinAddress };
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
