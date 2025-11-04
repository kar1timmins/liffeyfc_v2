import { Module, Provider } from '@nestjs/common';
import { Web3Controller } from './web3.controller';
import { Web3Service } from './web3.service';
import { NonceService } from './nonce.service';
import { RedisNonceService } from './nonce.redis.service';

const nonceProvider: Provider = {
  provide: NonceService,
  useFactory: () => {
    // If REDIS_URL is configured, use RedisNonceService, otherwise fall back to in-memory NonceService
    if (process.env.REDIS_URL) {
      return new RedisNonceService() as unknown as NonceService;
    }
    return new NonceService();
  },
};

@Module({
  controllers: [Web3Controller],
  providers: [Web3Service, nonceProvider],
  exports: [Web3Service, NonceService],
})
export class Web3Module {}
