// Lightweight web3 helper without external modal or wagmi to avoid build issues

declare global {
    interface Window { ethereum?: any }
}

async function requestAccounts(): Promise<string[]> {
    if (typeof window === 'undefined' || !window.ethereum) return [];
    return window.ethereum.request({ method: 'eth_requestAccounts' });
}

async function getAccounts(): Promise<string[]> {
    if (typeof window === 'undefined' || !window.ethereum) return [];
    return window.ethereum.request({ method: 'eth_accounts' });
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