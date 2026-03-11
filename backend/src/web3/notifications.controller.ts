/**
 * NotificationsController
 *
 * Exposes a Server-Sent Events (SSE) endpoint for the Svelte frontend.
 *
 * The frontend opens a single persistent connection:
 *   const es = new EventSource('/api/notifications/stream');
 *
 * It receives JSON messages from the NotificationsService whenever the
 * On-Chain Sentinel publishes a relevant blockchain event to Redis.
 *
 * Message types pushed over SSE:
 *   X402_PAYMENT_DETECTED  → user's USDC payment arrived; deployment starting
 *   DEPLOYMENT_COMPLETE    → escrow contracts are live; UI can show addresses
 *   NEW_CONTRIBUTION       → someone contributed to your company's bounty
 *
 * Security:
 *   Route is protected by JWT. The user can only receive their own events.
 *   Connection lifecycle is managed by the browser (auto-reconnect on 4xx/5xx).
 */
import {
  Controller,
  Sse,
  UseGuards,
  MessageEvent,
  Logger,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notifications: NotificationsService) {}

  /**
   * GET /notifications/stream
   *
   * Opens a persistent SSE connection. The browser will automatically
   * reconnect if the connection drops (default retry = 3 seconds).
   *
   * Svelte usage:
   * ```typescript
   * const es = new EventSource(`${PUBLIC_API_URL}/notifications/stream`, {
   *   withCredentials: true,   // send JWT cookie
   * });
   * es.onmessage = (e) => {
   *   const msg = JSON.parse(e.data);
   *   if (msg.type === 'X402_PAYMENT_DETECTED') { ... }
   *   if (msg.type === 'DEPLOYMENT_COMPLETE')   { es.close(); ... }
   *   if (msg.type === 'NEW_CONTRIBUTION')      { ... }
   * };
   * ```
   */
  @Sse('stream')
  @UseGuards(AuthGuard('jwt'))
  stream(@CurrentUser() user: { sub: string }): Observable<MessageEvent> {
    this.logger.log(`📺 SSE stream opened for user ${user.sub}`);
    return this.notifications.streamForUser(user.sub);
  }
}
