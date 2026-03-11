/**
 * NotificationsService
 *
 * Manages per-user Server-Sent Events (SSE) streams for the Svelte frontend.
 * Every time the SentinelListenerService receives an event from Redis and
 * resolves the target user, it calls emit() here. The matching SSE stream
 * (if the user's browser tab is open) receives the message within milliseconds.
 *
 * Design:
 *  - A single RxJS Subject acts as the internal event bus.
 *  - SSE subscribers filter by userId, so each client sees only their events.
 *  - No persistent storage — events are fire-and-forget to the WebSocket layer.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface UserNotification {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly bus$ = new Subject<UserNotification>();

  /**
   * Push an event to a specific user's SSE stream.
   * Called by SentinelListenerService after it resolves the userId from the chain event.
   */
  emit(notification: UserNotification): void {
    this.logger.debug(
      `📣 Emitting ${notification.type} to user ${notification.userId}`,
    );
    this.bus$.next(notification);
  }

  /**
   * Returns an Observable<MessageEvent> filtered for the given userId.
   * Pass this directly to an @Sse() controller endpoint.
   *
   * The Svelte frontend reads event.data and switches on the `type` field:
   *   X402_PAYMENT_DETECTED  — payment arrived; UI shows "deploying..."
   *   DEPLOYMENT_COMPLETE    — escrow contracts are live
   *   NEW_CONTRIBUTION       — someone contributed to your bounty
   */
  streamForUser(userId: string): Observable<MessageEvent> {
    return this.bus$.pipe(
      filter((n) => n.userId === userId),
      map(
        (n) =>
          ({
            data: { type: n.type, ...n.payload },
          }) as MessageEvent,
      ),
    );
  }
}
