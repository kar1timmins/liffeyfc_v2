// Lightweight web3 helper without external modal or wagmi to avoid build issues

declare global {
    // we only ever want to interact with window.ethereum; malicious injected
    // libraries (eg. evmAsk) may add window.eth which has a fake "request"
    // method that throws runtime errors.  by narrowing here we avoid that
    // attack surface.
    interface Window { ethereum?: any; eth?: any }
}

/**
 * Safe provider accessor.  Returns the EIP‑1193 provider if one is
 * available and exposes `request()`.  Any other injected objects such
 * as `window.eth` are ignored on purpose.
 *
 * Exported so other modules (tests, utilities) can re‑use the same
 * safety checks instead of directly touching `window`.
 */
export function getProvider(): any | null {
    if (typeof window === 'undefined') return null;
    const prov = window.ethereum;
    if (prov && typeof prov.request === 'function') {
        return prov;
    }
    return null;
}

async function requestAccounts(): Promise<string[]> {
    const prov = getProvider();
    if (!prov) return [];
    try {
        return await prov.request({ method: 'eth_requestAccounts' });
    } catch {
        return [];
    }
}

async function getAccounts(): Promise<string[]> {
    const prov = getProvider();
    if (!prov) return [];
    try {
        return await prov.request({ method: 'eth_accounts' });
    } catch {
        return [];
    }
}

export const web3modal = {
    // Keep API parity with previous usage
    async openModal() {
        return requestAccounts();
    },
    async open() {
        return requestAccounts();
    },
    async getAccounts() {
        return getAccounts();
    }
};