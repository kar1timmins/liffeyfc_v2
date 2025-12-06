import { Controller, Post, Get, UseGuards, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletGenerationService } from './wallet-generation.service';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletGenerationService,
  ) {}

  /**
   * Generate master wallet for user
   * POST /wallet/generate
   * Returns wallet data for download (mnemonic, private key)
   */
  @Post('generate')
  @UseGuards(AuthGuard('jwt'))
  async generateMasterWallet(@CurrentUser() user: any) {
    try {
      const walletData = await this.walletService.generateMasterWallet(user.sub);
      
      return {
        success: true,
        message: 'Master wallet generated successfully. Please download and store this information securely.',
        data: walletData,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to generate wallet',
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
    const addresses = hasWallet ? await this.walletService.getMasterWalletAddresses(user.sub) : null;

    return {
      success: true,
      data: {
        hasWallet,
        addresses,
      },
    };
  }

  /**
   * Get user's wallet addresses
   * GET /wallet/addresses
   */
  @Get('addresses')
  @UseGuards(AuthGuard('jwt'))
  async getWalletAddresses(@CurrentUser() user: any) {
    const addresses = await this.walletService.getMasterWalletAddresses(user.sub);

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
      const addresses = await this.walletService.generateCompanyWallet(user.sub, companyId);

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
}
