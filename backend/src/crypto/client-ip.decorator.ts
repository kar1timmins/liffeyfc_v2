import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Custom @ClientIp() decorator.
 *
 * In production (Railway): Express trusts the X-Forwarded-For header (set via
 * `app.set('trust proxy', 1)` in main.ts), so `request.ip` is the real client IP.
 *
 * In development: localhost loopback addresses (::1, 127.0.0.1, ::ffff:127.0.0.1,
 * or Docker bridge ::ffff:172.x.x.x) are replaced with a valid Irish residential IP
 * so Stripe's geo / region checks pass without throwing a 400.
 */
export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // With 'trust proxy' enabled, Express resolves X-Forwarded-For automatically
    const rawIp = request.ip ?? request.socket.remoteAddress ?? '';

    if (process.env.NODE_ENV !== 'production') {
      const isLocal =
        rawIp === '::1' ||
        rawIp === '127.0.0.1' ||
        rawIp === '::ffff:127.0.0.1' ||
        // Docker bridge network (172.x.x.x mapped to IPv6)
        /^::ffff:172\./.test(rawIp) ||
        /^::ffff:10\./.test(rawIp);

      if (isLocal) {
        // Dublin / Irish residential IP — passes Stripe's Onramp region check
        return '89.100.200.200';
      }
    }

    return rawIp;
  },
);
