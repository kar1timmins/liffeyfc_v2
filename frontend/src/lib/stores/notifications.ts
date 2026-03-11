/**
 * Notifications Store
 *
 * Connects to the backend SSE stream at GET /notifications/stream and routes
 * incoming events to the toast store and custom DOM events.
 *
 * Uses fetch + ReadableStream instead of EventSource so we can pass the JWT
 * Authorization header (EventSource does not support custom headers).
 *
 * Usage (in +layout.svelte or any authenticated component):
 *   import { notificationsStore } from '$lib/stores/notifications';
 *   // On mount after auth:
 *   notificationsStore.connect($authStore.accessToken);
 *   // On logout:
 *   notificationsStore.disconnect();
 */
import { writable } from 'svelte/store';
import { PUBLIC_API_URL } from '$env/static/public';
import { toastStore } from './toast';

// ── Event payload types (mirror backend SentinelListenerService) ──────────────

export interface X402PaymentDetectedPayload {
  paymentId: string;
  transactionHash: string;
  chain: string;
  amountUsdc: string;
  message: string;
}

export interface X402PaymentOrphanedPayload {
  transactionHash: string;
  chain: string;
  amountUsdc: string;
}

export interface DeploymentCompletePayload {
  wishlistItemId: string;
  campaignName: string;
  contracts: { chain: string; address: string }[];
  message: string;
}

export interface NewContributionPayload {
  wishlistItemId: string;
  contractAddress: string;
  chain: string;
  contributorAddress: string;
  amountNative: string;
  amountEur: string;
  totalRaisedEur: string;
  isTargetMet: boolean;
  transactionHash: string;
}

export interface NativePaymentReceivedPayload {
  wishlistItemId: string;
  chain: 'bitcoin' | 'stellar';
  senderAddress: string;
  receiverAddress: string;
  amount: string;
  currencySymbol: string;
  amountEur: string;
  totalRaisedEur: string;
  transactionHash: string;
  confirmed: boolean;
}

export type SseNotification =
  | ({ type: 'X402_PAYMENT_DETECTED' } & X402PaymentDetectedPayload)
  | ({ type: 'X402_PAYMENT_ORPHANED' } & X402PaymentOrphanedPayload)
  | ({ type: 'DEPLOYMENT_COMPLETE' } & DeploymentCompletePayload)
  | ({ type: 'NEW_CONTRIBUTION' } & NewContributionPayload)
  | ({ type: 'NATIVE_PAYMENT_RECEIVED' } & NativePaymentReceivedPayload);

// ── Store ─────────────────────────────────────────────────────────────────────

function createNotificationsStore() {
  const { subscribe, update } = writable<SseNotification[]>([]);

  let abortController: AbortController | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let connected = false;

  /** Open SSE connection with JWT Bearer token. Auto-reconnects on network drops. */
  async function connect(token: string): Promise<void> {
    if (connected) return;
    connected = true;
    _startLoop(token);
  }

  /** Close SSE connection and cancel any pending reconnect. */
  function disconnect(): void {
    connected = false;
    abortController?.abort();
    abortController = null;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  async function _startLoop(token: string): Promise<void> {
    while (connected) {
      await _connect(token);
      if (!connected) break;
      // Wait 5 seconds before reconnecting
      await new Promise<void>((resolve) => {
        reconnectTimeout = setTimeout(resolve, 5000);
      });
    }
  }

  async function _connect(token: string): Promise<void> {
    abortController?.abort();
    abortController = new AbortController();

    try {
      const response = await fetch(`${PUBLIC_API_URL}/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        console.warn('[notifications] SSE stream returned', response.status);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const msg = JSON.parse(line.slice(6)) as SseNotification;
              _handle(msg);
            } catch {
              // ignore malformed lines
            }
          }
        }
      }
    } catch (err: unknown) {
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      if (!isAbort) {
        console.warn('[notifications] SSE connection error:', err);
      }
    }
  }

  function _handle(msg: SseNotification): void {
    // Keep last 50 notifications in the store
    update((list) => [...list.slice(-49), msg]);

    switch (msg.type) {
      case 'X402_PAYMENT_DETECTED':
        toastStore.add({
          message: `⚡ Payment detected (${msg.amountUsdc} USDC)! Deploying escrow contracts...`,
          type: 'info',
          ttl: 10000,
          group: `payment-${msg.transactionHash}`,
        });
        break;

      case 'X402_PAYMENT_ORPHANED':
        toastStore.add({
          message: `⚠️ Payment received but no matching record found. Tx: ${msg.transactionHash.slice(0, 10)}...`,
          type: 'warning',
          ttl: 0, // sticky — requires manual dismiss
          group: `orphan-${msg.transactionHash}`,
        });
        break;

      case 'DEPLOYMENT_COMPLETE': {
        const chainList = msg.contracts.map((c) => c.chain.replace('_', ' ')).join(', ');
        toastStore.add({
          message: `✅ Escrow deployed on ${chainList}! "${msg.campaignName || 'Your campaign'}" is now live.`,
          type: 'success',
          ttl: 10000,
          group: `deploy-${msg.wishlistItemId}`,
          data: { contracts: msg.contracts, campaignName: msg.campaignName },
        });
        // Signal the layout / company pages to refresh their data
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refresh-user-companies'));
          window.dispatchEvent(
            new CustomEvent('deployment-complete', { detail: msg }),
          );
        }
        break;
      }

      case 'NEW_CONTRIBUTION':
        toastStore.add({
          message: `💰 New contribution: €${parseFloat(msg.amountEur).toFixed(2)} received!${
            msg.isTargetMet ? ' 🎉 Target met!' : ''
          }`,
          type: 'success',
          ttl: 7000,
          group: `contribution-${msg.contractAddress}`,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('new-contribution', { detail: msg }),
          );
        }
        break;

      case 'NATIVE_PAYMENT_RECEIVED': {
        const symbol = msg.currencySymbol;
        const icon = symbol === 'BTC' ? '₿' : symbol === 'XLM' ? '🌟' : '💫';
        toastStore.add({
          message: `${icon} ${msg.amount} ${symbol} received! ≈ €${parseFloat(msg.amountEur).toFixed(2)}`,
          type: 'success',
          ttl: 7000,
          group: `native-${msg.transactionHash}`,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('native-payment-received', { detail: msg }),
          );
        }
        break;
      }
    }
  }

  return { subscribe, connect, disconnect };
}

export const notificationsStore = createNotificationsStore();
