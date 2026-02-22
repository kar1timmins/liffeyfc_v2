import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import { CreateOnrampSessionDto } from './dto/create-onramp-session.dto';

/** Shape returned by POST /v1/crypto/onramp_sessions */
interface OnrampSession {
  id: string;
  object: 'crypto.onramp_session';
  client_secret: string;
  status: string;
  [key: string]: unknown;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    // Use the latest API version supported by stripe v20.x
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }

  async createOnrampSession(
    dto: CreateOnrampSessionDto,
    customerIp: string,
  ): Promise<{ clientSecret: string }> {
    const {
      destination_currency,
      destination_exchange_amount,
      destination_network,
      wallet_address,
    } = dto.transaction_details;

    try {
      // stripe.crypto.onrampSessions is not yet typed in v20.x — use rawRequest
      // which is the SDK-recommended path for beta / unlisted endpoints.
      // Stripe's rawRequest form-encodes nested objects automatically.
      const transactionDetails: Record<string, unknown> = {
        destination_currency,
        destination_exchange_amount,
        destination_network,
      };

      if (wallet_address) {
        // Pre-fill the destination wallet per Stripe's nested wallet_addresses param
        transactionDetails.wallet_addresses = { ethereum: wallet_address };
      }

      const session = (await this.stripe.rawRequest(
        'POST',
        '/v1/crypto/onramp_sessions',
        {
          transaction_details: transactionDetails,
          customer_ip_address: customerIp,
        },
      )) as unknown as OnrampSession;

      this.logger.log(
        `Created onramp session ${session.id} for ${destination_exchange_amount} ${destination_currency} on ${destination_network}`,
      );

      return { clientSecret: session.client_secret };
    } catch (error) {
      this.logger.error('Failed to create Stripe onramp session', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to create onramp session';
      throw new HttpException(errorMessage, HttpStatus.BAD_GATEWAY);
    }
  }
}
