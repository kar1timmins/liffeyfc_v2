import {
  Controller,
  Post,
  Get,
  UseGuards,
  Param,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletGenerationService } from './wallet-generation.service';
import { SendTransactionDto } from './dto/send-transaction.dto';
import { EscrowContractService } from './escrow-contract.service';
import { BountiesService } from './bounties.service';

@Controller('wallet')
export class WalletController {
  private logger: Logger;

  constructor(
    private readonly walletService: WalletGenerationService,
    private readonly escrowService: EscrowContractService,
    private readonly bountiesService: BountiesService,
  ) {
    this.logger = new Logger(WalletController.name);
  }

  /**
   * Generate master wallet for user
   * POST /wallet/generate
   * Returns wallet data for download (mnemonic, private key)
   */
  @Post('generate')
  @UseGuards(AuthGuard('jwt'))
  async generateMasterWallet(@CurrentUser() user: any) {
    try {
      this.logger.log(
        `🔑 Generating master wallet for user: ${JSON.stringify(user)}`,
      );

      if (!user || !user.sub) {
        this.logger.error(
          `❌ User or user.sub is missing: ${JSON.stringify(user)}`,
        );
        return {
          success: false,
          message: 'User not authenticated properly',
        };
      }

      const walletData = await this.walletService.generateMasterWallet(
        user.sub,
      );

      return {
        success: true,
        message:
          'Master wallet generated successfully. Please download and store this information securely.',
        data: walletData,
      };
    } catch (error: any) {
      this.logger.error(`❌ Wallet generation failed: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Failed to generate wallet',
      };
    }
  }

  /**
   * Restore a master wallet from mnemonic or private key
   * POST /wallet/restore
   * Accepts: { input: "12/24 word mnemonic or 0x prefixed private key" }
   * Returns: Restored wallet data (address, derivation path, etc)
   *
   * IMPORTANT: If restoring from the same mnemonic, all previously derived company
   * wallets will regenerate with identical addresses, allowing funds to flow correctly.
   */
  @Post('restore')
  @UseGuards(AuthGuard('jwt'))
  async restoreMasterWallet(
    @CurrentUser() user: any,
    @Body() dto: { input: string },
  ) {
    try {
      this.logger.log(`🔑 Restoring master wallet for user: ${user.sub}`);

      if (!user || !user.sub) {
        this.logger.error(
          `❌ User or user.sub is missing: ${JSON.stringify(user)}`,
        );
        return {
          success: false,
          message: 'User not authenticated properly',
        };
      }

      if (!dto.input || typeof dto.input !== 'string') {
        return {
          success: false,
          message: 'Input must be a valid mnemonic phrase or private key',
        };
      }

      const walletData = await this.walletService.restoreMasterWallet(
        user.sub,
        dto.input,
      );

      return {
        success: true,
        message:
          'Master wallet restored successfully. All derived company wallets will regenerate automatically.',
        data: walletData,
      };
    } catch (error: any) {
      this.logger.error(`❌ Wallet restoration failed: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Failed to restore wallet',
      };
    }
  }

  /**
   * Check if user has a master wallet
   * GET /wallet/check
   */
  @Get('check')
  @UseGuards(AuthGuard('jwt'))
  async checkWallet(@CurrentUser() user: any) {
    const hasWallet = await this.walletService.hasMasterWallet(user.sub);
    const addresses = hasWallet
      ? await this.walletService.getMasterWalletAddresses(user.sub)
      : null;

    return {
      success: true,
      data: {
        hasWallet,
        addresses,
      },
    };
  }

  /**
   * Download master wallet secrets (mnemonic & private key)
   * GET /wallet/download
   */
  @Get('download')
  @UseGuards(AuthGuard('jwt'))
  async downloadMasterWallet(@CurrentUser() user: any) {
    const data = await this.walletService.getMasterWalletDownload(user.sub);
    if (!data) {
      return { success: false, message: 'No master wallet found' };
    }
    return { success: true, data };
  }

  /**
   * Get user's wallet addresses
   * GET /wallet/addresses
   */
  @Get('addresses')
  @UseGuards(AuthGuard('jwt'))
  async getWalletAddresses(@CurrentUser() user: any) {
    const addresses = await this.walletService.getMasterWalletAddresses(
      user.sub,
    );

    if (!addresses) {
      return {
        success: false,
        message: 'No wallet found. Generate a master wallet first.',
      };
    }

    return {
      success: true,
      data: addresses,
    };
  }

  /**
   * Derive and persist multi-chain addresses (Solana, Stellar, Bitcoin)
   * for wallets generated before multi-chain support was added.
   * POST /wallet/derive-multichain
   */
  @Post('derive-multichain')
  @UseGuards(AuthGuard('jwt'))
  async deriveMultichainAddresses(@CurrentUser() user: any) {
    try {
      const addresses = await this.walletService.addMultichainAddresses(
        user.sub,
      );
      return {
        success: true,
        message: 'Multi-chain addresses derived and saved.',
        data: addresses,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to derive multi-chain addresses',
      };
    }
  }

  /**
   * Get all company wallets for user
   * GET /wallet/companies
   */
  @Get('companies')
  @UseGuards(AuthGuard('jwt'))
  async getCompanyWallets(@CurrentUser() user: any) {
    const wallets = await this.walletService.getUserCompanyWallets(user.sub);

    return {
      success: true,
      data: wallets,
    };
  }

  /**
   * Generate wallet for a specific company
   * POST /wallet/company/:companyId
   */
  @Post('company/:companyId')
  @UseGuards(AuthGuard('jwt'))
  async generateCompanyWallet(
    @CurrentUser() user: any,
    @Param('companyId') companyId: string,
  ) {
    try {
      const addresses = await this.walletService.generateCompanyWallet(
        user.sub,
        companyId,
      );

      return {
        success: true,
        message: 'Company wallet generated successfully',
        data: addresses,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to generate company wallet',
      };
    }
  }

  /**
   * Lookup a wallet address to get company and bounty information
   * GET /wallet/lookup?address=0x...&chain=ethereum
   * PUBLIC endpoint - allows anyone to verify wallet addresses before sending
   * This allows users to verify they're sending to the correct bounty
   */
  @Get('lookup')
  async lookupWalletAddress(
    @Query('address') address: string,
    @Query('chain') chain: string,
  ) {
    try {
      if (
        !address ||
        !chain ||
        (chain !== 'ethereum' && chain !== 'avalanche')
      ) {
        return {
          success: false,
          message: 'Invalid address or chain parameter',
        };
      }

      const result = await this.walletService.lookupWalletAddress(
        address,
        chain,
      );

      if (!result) {
        return {
          success: false,
          message:
            'Wallet address not found in system. This address is not associated with any company.',
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      console.error('Wallet lookup error:', err);
      return {
        success: false,
        message: err.message || 'Failed to lookup wallet address',
      };
    }
  }

  /**
   * Send transaction from user's wallet
   * POST /wallet/send
   * Sends funds from user's generated wallet to recipient address
   */
  @Post('send')
  @UseGuards(AuthGuard('jwt'))
  async sendTransaction(
    @CurrentUser() user: any,
    @Body() dto: SendTransactionDto,
  ) {
    try {
      const result = await this.escrowService.sendUserTransaction(
        user.sub,
        dto.recipientAddress,
        dto.chain,
        dto.amountEth,
      );

      // If this was a bounty contribution, immediately persist a Contribution
      // record so it shows on the profile page without waiting for a sync.
      if (
        dto.wishlistItemId &&
        (dto.chain === 'ethereum' || dto.chain === 'avalanche')
      ) {
        await this.bountiesService.recordImmediateContribution(
          dto.wishlistItemId,
          result.transactionHash,
          result.from,
          user.sub,
          dto.chain,
          dto.amountEth,
        );
      }
      const chainName =
        dto.chain === 'ethereum'
          ? 'Ethereum Sepolia'
          : dto.chain === 'avalanche'
            ? 'Avalanche Fuji'
            : dto.chain === 'solana'
              ? 'Solana (mainnet)' // or devnet depending on configuration
              : dto.chain === 'stellar'
                ? 'Stellar (public)'
                : dto.chain;

      return {
        success: true,
        message: `Transaction sent successfully on ${chainName}`,
        data: {
          transactionHash: result.transactionHash,
          from: result.from,
          to: result.to,
          amount: result.amount,
          chain: dto.chain,
          explorerUrl: result.explorerUrl,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to send transaction',
      };
    }
  }
}
