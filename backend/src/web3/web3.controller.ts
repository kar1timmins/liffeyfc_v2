import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { Web3Service } from './web3.service';
import { ConnectWalletDto, VerifySignatureDto } from './dto/connect-wallet.dto';

@Controller('web3')
export class Web3Controller {
  constructor(private readonly web3Service: Web3Service) {}

  /**
   * Connect a wallet
   * POST /web3/connect
   */
  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connectWallet(@Body(ValidationPipe) dto: ConnectWalletDto) {
    const connection = await this.web3Service.connectWallet(dto);
    return {
      success: true,
      data: connection,
      message: 'Wallet connected successfully',
    };
  }

  /**
   * Get wallet balance
   * GET /web3/balance/:address
   */
  @Get('balance/:address')
  async getBalance(
    @Param('address') address: string,
    @Query('chainId') chainId: string = '0x1',
  ) {
    const balance = await this.web3Service.getBalance(address, chainId);
    return {
      success: true,
      data: balance,
    };
  }

  /**
   * Generate sign-in message
   * GET /web3/message/:address
   */
  @Get('message/:address')
  getSignInMessage(@Param('address') address: string) {
    const message = this.web3Service.generateSignInMessage(address);
    return {
      success: true,
      data: { message },
    };
  }

  /**
   * Verify signature
   * POST /web3/verify
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifySignature(@Body(ValidationPipe) dto: VerifySignatureDto) {
    const verification = await this.web3Service.verifySignature(dto);
    return {
      success: verification.isValid,
      data: verification,
      message: verification.isValid
        ? 'Signature verified successfully'
        : 'Invalid signature',
    };
  }

  /**
   * Get supported chains
   * GET /web3/chains
   */
  @Get('chains')
  getSupportedChains() {
    const chains = this.web3Service.getSupportedChains();
    return {
      success: true,
      data: chains,
    };
  }

  /**
   * Get chain info
   * GET /web3/chains/:chainId
   */
  @Get('chains/:chainId')
  getChainInfo(@Param('chainId') chainId: string) {
    const chainInfo = this.web3Service.getChainInfo(chainId);
    if (!chainInfo) {
      return {
        success: false,
        message: 'Chain not found',
      };
    }
    return {
      success: true,
      data: chainInfo,
    };
  }

  /**
   * Validate address
   * GET /web3/validate/:address
   */
  @Get('validate/:address')
  validateAddress(@Param('address') address: string) {
    const isValid = this.web3Service.isValidAddress(address);
    return {
      success: true,
      data: { address, isValid },
    };
  }
}
