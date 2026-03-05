<script lang="ts">
  import { Copy, Loader, ExternalLink } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { toastStore } from '$lib/stores/toast';

  let { 
    masterWallet = null
  }: {
    masterWallet?: {
      ethAddress?: string;
      avaxAddress?: string;
      solanaAddress?: string;
      stellarAddress?: string;
    } | null;
  } = $props();

  type Chain = 'ethereum' | 'avalanche' | 'solana' | 'stellar';

  let selectedChain = $state<Chain>('ethereum');
  let balance = $state<string | null>(null);
  let isLoadingBalance = $state(false);

  // The USDC address is always the master wallet address for the selected chain
  let displayWallet = $derived((() => {
    if (selectedChain === 'ethereum') return masterWallet?.ethAddress || '';
    if (selectedChain === 'avalanche') return masterWallet?.avaxAddress || '';
    if (selectedChain === 'solana') return masterWallet?.solanaAddress || '';
    if (selectedChain === 'stellar') return masterWallet?.stellarAddress || '';
    return '';
  })());

  // Shorten non-EVM addresses for display
  let displayAddress = $derived(
    (selectedChain === 'solana' || selectedChain === 'stellar') && displayWallet
      ? `${displayWallet.slice(0, 10)}…${displayWallet.slice(-8)}`
      : displayWallet
  );

  async function fetchBalance() {
    if (!displayWallet) {
      balance = null;
      return;
    }
    isLoadingBalance = true;
    try {
      const response = await fetch(
        `${PUBLIC_API_URL}/wallet-balance/usdc?address=${encodeURIComponent(displayWallet)}&chain=${selectedChain}`
      );
      if (!response.ok) {
        balance = 'Unable to fetch USDC balance';
        return;
      }
      const data = await response.json();
      balance = `${parseFloat(data.balanceUsdc).toFixed(2)} USDC`;
    } catch (err) {
      console.error('Error fetching USDC balance:', err);
      balance = 'Error fetching balance';
    } finally {
      isLoadingBalance = false;
    }
  }

  function copyToClipboard() {
    if (displayWallet) {
      navigator.clipboard.writeText(displayWallet);
      toastStore.add({ message: '📋 Copied to clipboard', type: 'success', ttl: 2000 });
    }
  }

  function getBlockExplorerUrl(address: string, chain: Chain) {
    if (chain === 'ethereum') return `https://sepolia.etherscan.io/address/${address}`;
    if (chain === 'avalanche') return `https://testnet.snowtrace.io/address/${address}`;
    if (chain === 'solana') return `https://solscan.io/account/${address}`;
    if (chain === 'stellar') return `https://stellar.expert/explorer/public/account/${address}`;
    return '#';
  }

  function getExplorerLabel(chain: Chain) {
    if (chain === 'ethereum') return 'View on Etherscan (Sepolia)';
    if (chain === 'avalanche') return 'View on Snowtrace (Fuji)';
    if (chain === 'solana') return 'View on Solscan';
    if (chain === 'stellar') return 'View on Stellar Expert';
    return 'View on Explorer';
  }

  function getTestnetFaucetUrls(chain: Chain) {
    if (chain === 'ethereum') {
      return [
        { name: 'Sepolia Faucet', url: 'https://faucets.chain.link/sepolia' },
        { name: 'Alchemy Faucet', url: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
        { name: 'QuickNode Faucet', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
      ];
    } else if (chain === 'avalanche') {
      return [
        { name: 'Avalanche Faucet', url: 'https://faucets.avax.network/' },
        { name: 'QuickNode Faucet', url: 'https://faucet.quicknode.com/avalanche/fuji' },
      ];
    } else if (chain === 'solana') {
      return [
        { name: 'Circle USDC (Devnet)', url: 'https://faucet.circle.com/' },
        { name: 'Solana Faucet', url: 'https://faucet.solana.com/' },
      ];
    } else {
      return [
        { name: 'Circle USDC (Stellar)', url: 'https://faucet.circle.com/' },
        { name: 'Stellar Laboratory', url: 'https://laboratory.stellar.org/' },
      ];
    }
  }

  function getFaucetNote(chain: Chain) {
    if (chain === 'ethereum') return 'Use these faucets to get free Sepolia ETH for gas fees';
    if (chain === 'avalanche') return 'Use these faucets to get free Fuji AVAX for gas fees';
    if (chain === 'solana') return 'USDC on Solana mainnet — use Circle Faucet for devnet testing';
    return 'USDC on Stellar mainnet — use Circle Faucet for testnet USDC';
  }
</script>

<div class="card bg-base-100 shadow-lg border border-base-300 mb-6">
  <div class="card-body">
    <h3 class="card-title text-lg flex items-center gap-2">
      💳 USDC Payment Wallet
    </h3>
    <p class="text-sm opacity-70 mb-4">
      Your platform-generated master wallet address is used for USDC payments on Ethereum, Avalanche, Solana, and Stellar.
    </p>

    {#if displayWallet}
      <div class="bg-base-200 rounded-lg p-4 space-y-4">
        <!-- Address display -->
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs opacity-60 mb-1">Wallet Address</p>
            <p class="font-mono text-sm break-all">{displayAddress}</p>
          </div>
          <button class="btn btn-ghost btn-sm ml-2 shrink-0" onclick={copyToClipboard} title="Copy full address">
            <Copy class="w-4 h-4" />
          </button>
        </div>

        <!-- Chain Selection & Balance -->
        <div class="space-y-2">
          <div class="flex gap-2 items-center">
            <select
              bind:value={selectedChain}
              class="select select-sm select-bordered flex-1"
              onchange={() => { balance = null; fetchBalance(); }}
            >
              <option value="ethereum">🔷 Ethereum Sepolia</option>
              <option value="avalanche">🔺 Avalanche Fuji</option>
              <option value="solana">◎ Solana</option>
              <option value="stellar">✦ Stellar</option>
            </select>
            <button
              class="btn btn-sm btn-outline gap-1"
              onclick={fetchBalance}
              disabled={isLoadingBalance}
            >
              {#if isLoadingBalance}
                <Loader class="w-4 h-4 animate-spin" />
              {/if}
              Refresh
            </button>
          </div>

          {#if balance !== null}
            <div class="bg-base-100 rounded p-3 border border-base-300">
              <p class="text-xs opacity-60">USDC Balance</p>
              <p class="text-lg font-semibold">{balance}</p>
            </div>
          {/if}
        </div>

        <!-- Block Explorer Link -->
        <a
          href={getBlockExplorerUrl(displayWallet, selectedChain)}
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-sm btn-outline gap-2 w-full"
        >
          <ExternalLink class="w-4 h-4" />
          {getExplorerLabel(selectedChain)}
        </a>

        <!-- Testnet Faucet Links -->
        <div class="bg-info/10 border border-info rounded-lg p-3">
          <p class="text-xs font-semibold mb-2 text-info">Get Testnet / USDC Tokens</p>
          <div class="space-y-1">
            {#each getTestnetFaucetUrls(selectedChain) as faucet}
              <a
                href={faucet.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs link link-primary flex items-center gap-1 hover:underline"
              >
                {faucet.name}
                <ExternalLink class="w-3 h-3" />
              </a>
            {/each}
          </div>
          <p class="text-xs opacity-70 mt-2">
            {getFaucetNote(selectedChain)}
          </p>
        </div>
      </div>
    {:else}
      <div class="alert alert-warning py-3">
        <div class="text-sm">
          <p class="font-semibold">No master wallet generated yet</p>
          <p class="text-xs opacity-80">Generate a wallet in the Master Wallet section above to enable USDC payments.</p>
        </div>
      </div>
    {/if}
  </div>
</div>
