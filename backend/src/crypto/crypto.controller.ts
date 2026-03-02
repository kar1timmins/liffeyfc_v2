import { Controller, Post, Body, UseGuards, Logger, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CryptoService } from './crypto.service';
import { CreateOnrampSessionDto } from './dto/create-onramp-session.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientIp } from './client-ip.decorator';

@Controller('crypto')
@UseGuards(AuthGuard('jwt'))
export class CryptoController {
  private readonly logger = new Logger(CryptoController.name);

  constructor(private readonly cryptoService: CryptoService) {}

  /**
   * POST /crypto/create-onramp-session
   *
   * Creates a Stripe Crypto Onramp session and returns a client secret
   * that the frontend uses to mount the hosted onramp UI widget.
   *
   * Requires authentication so the session is tied to a registered user.
   */
  @Post('create-onramp-session')
  async createOnrampSession(
    @Body() body: CreateOnrampSessionDto,
    @ClientIp() ip: string,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`User ${user?.id} requesting onramp session from IP ${ip}`);
    const result = await this.cryptoService.createOnrampSession(body, ip);
    // record the request so user can see history later
    await this.cryptoService.logPurchase(user.id, body.transaction_details);
    return result;
  }

  /**
   * GET /crypto/history
   * Returns the most recent 20 purchases by the authenticated user.
   */
  @Get('history')
  async getHistory(@CurrentUser() user: any) {
    return {
      success: true,
      data: await this.cryptoService.getPurchaseHistory(user.id),
    };
  }
}
