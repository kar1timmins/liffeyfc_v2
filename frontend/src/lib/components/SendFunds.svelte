<script lang="ts">
	import { onMount } from 'svelte';
	import { Send, Wallet, TrendingUp, AlertCircle, Loader, CheckCircle, Copy, ArrowRight } from 'lucide-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { authStore } from '$lib/stores/auth';
	import { walletStore, isConnected, formattedAddress } from '$lib/stores/walletStore';
	import { toastStore } from '$lib/stores/toast';

	// Form state
	let selectedChain = $state<'ethereum' | 'avalanche'>('ethereum');
	let recipientAddress = $state('');
	let amount = $state<number | ''>('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);
	let txHash = $state<string | null>(null);

	// Display state
	let balance = $state<{ ethereum: string; avalanche: string }>({ ethereum: '0', avalanche: '0' });
	let gasPrice = $state<{ ethereum: string; avalanche: string }>({ ethereum: '0', avalanche: '0' });
	let estimatedGas = $state<number>(21000);
	let totalCost = $state<number>(0);
	let isLoadingBalance = $state(false);
	let isLoadingGas = $state(false);

	// Step tracking
	let currentStep = $state<'connect' | 'form' | 'submitting' | 'success'>('form');

	const CHAIN_NAMES: { [K in 'ethereum' | 'avalanche']: string } = {
		ethereum: 'Ethereum Sepolia',
		avalanche: 'Avalanche Fuji'
	};

	const CHAIN_ICONS: { [K in 'ethereum' | 'avalanche']: string } = {
		ethereum: '⟠',
		avalanche: '▲'
	};

	const EXPLORER_URLS: { [K in 'ethereum' | 'avalanche']: string } = {
		ethereum: 'https://sepolia.etherscan.io/tx/',
		avalanche: 'https://testnet.snowtrace.io/tx/'
	};

	async function fetchBalance() {
		if (!$isConnected || !$formattedAddress) return;

		isLoadingBalance = true;
		try {
			const response = await fetch(
				`${PUBLIC_API_URL}/wallet-balance?address=${$formattedAddress}&chain=${selectedChain}`,
				{
					headers: {
						'Authorization': `Bearer ${$authStore.accessToken}`
					}
				}
			);

			if (!response.ok) throw new Error('Failed to fetch balance');

			const data = await response.json();
			balance[selectedChain] = data.balanceEth || data.balanceAvax || '0';
		} catch (err) {
			console.error('Balance fetch error:', err);
			toastStore.add({
				message: 'Failed to fetch balance',
				type: 'error',
				ttl: 3000
			});
		} finally {
			isLoadingBalance = false;
		}
	}

	async function fetchGasPrice() {
		isLoadingGas = true;
		try {
			const response = await fetch(
				`${PUBLIC_API_URL}/wallet-balance/gas-price?chain=${selectedChain}`,
				{
					headers: {
						'Authorization': `Bearer ${$authStore.accessToken}`
					}
				}
			);

			if (!response.ok) throw new Error('Failed to fetch gas price');

			const data = await response.json();
			gasPrice[selectedChain] = data.gasPriceGwei || '0';
		} catch (err) {
			console.error('Gas price fetch error:', err);
		} finally {
			isLoadingGas = false;
		}
	}

	function validateAddress(addr: string): boolean {
		return /^0x[a-fA-F0-9]{40}$/.test(addr);
	}

	function updateTotalCost() {
		if (!amount || typeof amount !== 'number') {
			totalCost = 0;
			return;
		}

		const gasPriceNum = parseFloat(gasPrice[selectedChain] || '0');
		const gasFeWei = (estimatedGas * gasPriceNum) / 1e9; // Convert gwei to eth
		totalCost = amount + gasFeWei;
	}

	async function handleSubmit() {
		error = null;

		// Validation
		if (!$isConnected) {
			error = 'Please connect your wallet first';
			return;
		}

		if (!validateAddress(recipientAddress)) {
			error = 'Invalid recipient address. Must start with 0x and be 40 hex characters.';
			return;
		}

		if (!amount || amount <= 0) {
			error = 'Please enter a valid amount';
			return;
		}

		const balanceNum = parseFloat(balance[selectedChain] || '0');
		if (amount > balanceNum) {
			error = `Insufficient balance. You have ${balance[selectedChain]} ${selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}`;
			return;
		}

		if (totalCost > balanceNum) {
			error = `Insufficient balance for transaction + gas. Total needed: ${totalCost.toFixed(6)} ${selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}`;
			return;
		}

		isSubmitting = true;
		currentStep = 'submitting';

		try {
			if (!window.ethereum) {
				throw new Error('MetaMask not found');
			}

			// Get the correct chain ID
			const chainId = selectedChain === 'ethereum' ? '0xaa36a7' : '0xa869';
			const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

			if (currentChainId !== chainId) {
				try {
					await window.ethereum.request({
						method: 'wallet_switchEthereumChain',
						params: [{ chainId }]
					});
				} catch (switchError: any) {
					if (switchError.code === 4902) {
						throw new Error(`${CHAIN_NAMES[selectedChain]} not configured in MetaMask`);
					}
					throw switchError;
				}
			}

			// Send transaction
			const txParams = {
				from: $formattedAddress,
				to: recipientAddress,
				value: '0x' + (BigInt(Math.floor(amount * 1e18)).toString(16)),
				gas: '0x' + estimatedGas.toString(16),
				gasPrice: '0x' + (BigInt(Math.floor(parseFloat(gasPrice[selectedChain]) * 1e9)).toString(16))
			};

			const hash = await window.ethereum.request({
				method: 'eth_sendTransaction',
				params: [txParams]
			});

			txHash = hash;
			success = true;
			currentStep = 'success';

			// Reset form
			setTimeout(() => {
				recipientAddress = '';
				amount = '';
				success = false;
				currentStep = 'form';
				fetchBalance();
			}, 5000);
		} catch (err: any) {
			error = err.message || 'Transaction failed';
			currentStep = 'form';
			toastStore.add({
				message: error,
				type: 'error',
				ttl: 5000
			});
		} finally {
			isSubmitting = false;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		toastStore.add({
			message: 'Copied to clipboard',
			type: 'success',
			ttl: 2000
		});
	}

	onMount(() => {
		if ($isConnected) {
			currentStep = 'form';
			fetchBalance();
			fetchGasPrice();
		} else {
			currentStep = 'connect';
		}
	});

	// Reactive updates
	$effect(() => {
		if (selectedChain) {
			fetchBalance();
			fetchGasPrice();
		}
	});

	$effect(() => {
		updateTotalCost();
	});
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<!-- Header -->
		<div class="flex items-center gap-3 mb-6">
			<div class="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
				<Send size={24} class="text-primary" />
			</div>
			<div>
				<h2 class="card-title text-2xl">Send Funds</h2>
				<p class="text-sm text-base-content/70">Transfer crypto to any wallet address</p>
			</div>
		</div>

		{#if currentStep === 'connect'}
			<!-- Connect Wallet State -->
			<div class="space-y-4">
				<div class="alert alert-info">
					<AlertCircle size={20} />
					<div>
						<div class="font-semibold">Connect Your Wallet</div>
						<div class="text-sm">You need to connect a Web3 wallet to send funds.</div>
					</div>
				</div>
				<button
					class="btn btn-primary btn-lg w-full gap-2"
					onclick={() => walletStore.connect()}
				>
					<Wallet size={20} />
					Connect Wallet
				</button>
			</div>
		{:else if currentStep === 'success'}
			<!-- Success State -->
			<div class="space-y-4">
				<div class="alert alert-success">
					<CheckCircle size={20} />
					<div>
						<div class="font-semibold">Transaction Submitted!</div>
						<div class="text-sm">Your transaction has been sent to the network.</div>
					</div>
				</div>

				{#if txHash}
					<div class="bg-success/10 border border-success/20 rounded-lg p-4">
						<div class="text-xs font-semibold text-success mb-2 uppercase">Transaction Hash</div>
						<div class="flex items-center gap-2">
							<code class="text-xs font-mono bg-base-200 px-3 py-2 rounded flex-1 truncate">{txHash}</code>
							<button
								class="btn btn-ghost btn-sm"
								onclick={() => copyToClipboard(txHash || '')}
								title="Copy hash"
							>
								<Copy size={16} />
							</button>
						</div>
						<a
							href="{EXPLORER_URLS[selectedChain]}{txHash}"
							target="_blank"
							rel="noopener noreferrer"
							class="link link-primary text-xs mt-2 block"
						>
							View on {selectedChain === 'ethereum' ? 'Etherscan' : 'Snowtrace'} →
						</a>
					</div>
				{/if}

				<div class="divider my-2">Processing</div>

				<p class="text-sm text-base-content/70 text-center">
					Redirecting to form in a moment...
				</p>
			</div>
		{:else}
			<!-- Form State -->
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
				<!-- Chain Selection -->
				<div class="form-control">
					<div class="label">
						<span class="label-text font-semibold">Select Network</span>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<button
							type="button"
							class="btn {selectedChain === 'ethereum' ? 'btn-primary' : 'btn-outline'} gap-2"
							onclick={() => selectedChain = 'ethereum'}
						>
							<span class="text-xl">⟠</span>
							Ethereum Sepolia
						</button>
						<button
							type="button"
							class="btn {selectedChain === 'avalanche' ? 'btn-primary' : 'btn-outline'} gap-2"
							onclick={() => selectedChain = 'avalanche'}
						>
							<span class="text-xl">▲</span>
							Avalanche Fuji
						</button>
					</div>
				</div>

				<!-- Balance Display -->
				<div class="grid grid-cols-2 gap-4">
					<div class="stat bg-base-200/50 rounded-lg p-4">
						<div class="stat-title text-xs">Balance</div>
						{#if isLoadingBalance}
							<div class="h-6 skeleton"></div>
						{:else}
							<div class="stat-value text-lg">
								{balance[selectedChain]} {selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}
							</div>
						{/if}
						<div class="stat-desc text-xs opacity-50">On {CHAIN_NAMES[selectedChain]}</div>
					</div>

					<div class="stat bg-base-200/50 rounded-lg p-4">
						<div class="stat-title text-xs">Gas Price</div>
						{#if isLoadingGas}
							<div class="h-6 skeleton"></div>
						{:else}
							<div class="stat-value text-lg">{gasPrice[selectedChain]} Gwei</div>
						{/if}
						<div class="stat-desc text-xs opacity-50">Current rate</div>
					</div>
				</div>

				<!-- Recipient Address -->
				<div class="form-control">
					<label class="label" for="recipient-address">
						<span class="label-text font-semibold">Recipient Address</span>
						<span class="label-text-alt text-xs opacity-60">0x...</span>
					</label>
					<input
						id="recipient-address"
						type="text"
						placeholder="0x1234567890123456789012345678901234567890"
						class="input input-bordered font-mono text-sm"
						bind:value={recipientAddress}
						disabled={isSubmitting}
					/>
					{#if recipientAddress && !validateAddress(recipientAddress)}
						<label class="label" for="recipient-address">
							<span class="label-text-alt text-error text-xs">Invalid address format</span>
						</label>
					{/if}
				</div>

				<!-- Amount -->
				<div class="form-control">
					<label class="label" for="send-amount">
						<span class="label-text font-semibold">Amount to Send</span>
						<span class="label-text-alt text-xs">
							Available: {balance[selectedChain]} {selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}
						</span>
					</label>
					<div class="relative">
						<input
							id="send-amount"
							type="number"
							placeholder="0.5"
							class="input input-bordered w-full pr-16"
							step="0.0001"
							min="0"
							bind:value={amount}
							disabled={isSubmitting}
						/>
						<button
							type="button"
							class="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
							onclick={() => amount = parseFloat(balance[selectedChain]) || 0}
							title="Use max balance"
						>
							MAX
						</button>
					</div>
				</div>

				<!-- Gas Estimation -->
				{#if amount && typeof amount === 'number' && amount > 0}
					<div class="bg-base-200/50 rounded-lg p-4 space-y-3">
						<div class="flex justify-between items-center text-sm">
							<span class="opacity-70">Amount:</span>
							<span class="font-mono font-semibold">{(amount).toFixed(6)} {selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}</span>
						</div>

						<div class="flex justify-between items-center text-sm">
							<span class="opacity-70">Gas Fee:</span>
							<span class="font-mono font-semibold">
								{((estimatedGas * parseFloat(gasPrice[selectedChain])) / 1e9).toFixed(6)} {selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}
							</span>
						</div>

						<div class="divider my-2"></div>

						<div class="flex justify-between items-center">
							<span class="font-semibold">Total Cost:</span>
							<span class="font-mono font-bold text-lg">{totalCost.toFixed(6)} {selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}</span>
						</div>

						{#if totalCost > parseFloat(balance[selectedChain] || '0')}
							<div class="alert alert-warning alert-sm mt-2">
								<AlertCircle size={16} />
								<span class="text-xs">Insufficient balance for gas fees</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Error Display -->
				{#if error}
					<div class="alert alert-error">
						<AlertCircle size={20} />
						<div>
							<div class="font-semibold">Error</div>
							<div class="text-sm">{error}</div>
						</div>
					</div>
				{/if}

				<!-- Submit Button -->
				<button
					type="submit"
					class="btn btn-primary btn-lg w-full gap-2"
					disabled={isSubmitting || !recipientAddress || !amount || !$isConnected}
				>
					{#if isSubmitting}
						<Loader size={20} class="animate-spin" />
						Processing...
					{:else}
						<Send size={20} />
						Send {selectedChain === 'ethereum' ? 'ETH' : 'AVAX'}
					{/if}
				</button>

				<!-- Connected Wallet Info -->
				<div class="bg-base-200/50 rounded-lg p-3 text-center">
					<div class="text-xs opacity-70 mb-1">Sending from</div>
					<div class="font-mono text-sm font-semibold">{$formattedAddress}</div>
				</div>
			</form>
		{/if}
	</div>
</div>
