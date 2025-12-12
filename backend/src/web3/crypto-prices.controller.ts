import { Controller, Get, Post, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CryptoPricesService } from './crypto-prices.service';

@Controller('crypto-prices')
export class CryptoPricesController {
  private readonly logger = new Logger(CryptoPricesController.name);

  constructor(private readonly pricesService: CryptoPricesService) {}

  @Get()
  async getPrices() {
    try {
      const prices = await this.pricesService.getPrices();
      return {
        success: true,
        data: prices
      };
    } catch (error) {
      this.logger.error('Failed to get crypto prices:', error);
      throw new HttpException(
        'Failed to fetch crypto prices',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('refresh')
  async refreshPrices() {
    try {
      await this.pricesService.clearCache();
      const prices = await this.pricesService.getPrices();
      return {
        success: true,
        message: 'Prices refreshed from Chainlink',
        data: prices
      };
    } catch (error) {
      this.logger.error('Failed to refresh prices:', error);
      throw new HttpException(
        'Failed to refresh crypto prices',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('test')
  async testChainlink() {
    this.logger.log('🧪 Manual Chainlink test triggered...');
    await this.pricesService.clearCache();
    
    try {
      const result = await this.pricesService.testChainlinkRaw();
      this.logger.log('✅ Test completed successfully');
      return {
        success: true,
        message: 'Chainlink test completed successfully',
        data: {
          ethEur: result.ethEur,
          avaxEur: result.avaxEur
        },
        debug: result.debug
      };
    } catch (error) {
      this.logger.error('❌ Test failed:', error);
      return {
        success: false,
        message: 'Chainlink test failed - see error and debug for details',
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack
        }
      };
    }
  }
}
