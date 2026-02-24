<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Send,
		AlertCircle,
		Loader,
		CheckCircle,
		Copy,
		WalletCards,
		ChevronLeft,
		ChevronRight,
		ExternalLink
	} from 'lucide-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { devLog } from '$lib/env';
	import { authStore } from '$lib/stores/auth';
	import { toastStore } from '$lib/stores/toast';

	// Form state
	let selectedChain = $state<'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin'>(
		'ethereum'
	);
	let recipientAddress = $state('');
	let amount = $state<number | ''>('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);
	let txHash = $state<string | null>(null);
	let explorerUrl = $state<string | null>(null);

	// Display state
	let userBalance = $state<{
		ethereum: string;
		avalanche: string;
		solana?: string;
		stellar?: string;
		bitcoin?: string;
	}>({ ethereum: '0', avalanche: '0' });
	let userWalletAddress = $state<{
		ethereum?: string;
		avalanche?: string;
		solana?: string;
		stellar?: string;
		bitcoin?: string;
	} | null>(null);
	let isLoadingWallet = $state(false);
	let isLoadingBalance = $state(false);
	let totalCost = $state<number>(0);

	// Address lookup and bounty selection
	interface BountyOption {
		id: string;
		title: string;
		description?: string;
		targetAmount: number;
		currentAmount: number;
		chain: 'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin';
		status: 'active' | 'funded' | 'expired';
		contractAddress: string; // Escrow contract for this bounty
		deployments?: Array<{
			campaignName?: string | null;
			campaignDescription?: string | null;
			chain?: string;
			network?: string;
			deploymentTxHash?: string | null;
			deployedAt?: string;
			[key: string]: unknown;
		}>;
	}

	interface WalletLookupResult {
		company: {
			id: string;
			name: string;
			description?: string;
			industry?: string;
			logo?: string;
		};
		bounties: BountyOption[];
	}

	let isLookingUpAddress = $state(false);
	let lookupError = $state<string | null>(null);
	let lookedUpCompany = $state<WalletLookupResult | null>(null);
	let selectedBountyId = $state<string | null>(null);
	let lookupDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Transaction history
	interface Transaction {
		id: string;
		chain: 'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin';
		amount: number;
		recipient: string;
		hash: string;
		timestamp: Date;
		status: 'pending' | 'confirmed' | 'failed';
	}
	let transactions = $state<Transaction[]>([]);
	let isLoadingHistory = $state(false);
	let currentPage = $state(1);
	let itemsPerPage = 5;

	// Step tracking
	let currentStep = $state<'check' | 'form' | 'submitting' | 'success'>('check');

	const CHAIN_NAMES: {
		[K in 'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin']: string;
	} = {
		ethereum: 'Ethereum Sepolia',
		avalanche: 'Avalanche Fuji',
		solana: 'Solana',
		stellar: 'Stellar',
		bitcoin: 'Bitcoin Testnet'
	};

	const EXPLORER_URLS: {
		[K in 'ethereum' | 'avalanche' | 'solana' | 'stellar' | 'bitcoin']: string;
	} = {
		ethereum: 'https://sepolia.etherscan.io/tx/',
		avalanche: 'https://testnet.snowtrace.io/tx/',
		solana: 'https://explorer.solana.com/tx/',
		stellar: 'https://stellarscan.io/tx/',
		bitcoin: 'https://www.blockstream.info/tx/'
	};

	// Reactive effect: Update recipient address when bounty is selected
	$effect(() => {
		if (selectedBountyId && lookedUpCompany?.bounties) {
			const selectedBounty = lookedUpCompany.bounties.find((b) => b.id === selectedBountyId);
			if (selectedBounty?.contractAddress) {
				recipientAddress = selectedBounty.contractAddress;
			}
		}
	});

	async function fetchUserWallet() {
		if (!$authStore.accessToken) return;

		isLoadingWallet = true;
		error = null;

		try {
			const response = await fetch(`${PUBLIC_API_URL}/wallet/addresses`, {
				headers: {
					Authorization: `Bearer ${$authStore.accessToken}`
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch wallet addresses');
			}

			const result = await response.json();
			if (result.success && result.data) {
				// Map backend keys to component keys
				userWalletAddress = {
					ethereum: result.data.ethAddress,
					avalanche: result.data.avaxAddress,
					solana: result.data.solanaAddress,
					stellar: result.data.stellarAddress,
					bitcoin: result.data.bitcoinAddress
				};
				devLog('Wallet addresses loaded:', userWalletAddress);
				currentStep = 'form';
				// Auto-fetch balance when wallet is loaded
				// Use setTimeout to ensure reactivity and proper chain selection
				setTimeout(async () => {
					devLog('Auto-fetching balance for chain:', selectedChain);
					await fetchUserBalance();
				}, 100);
				// Fetch transaction history
				await fetchTransactionHistory();
			} else {
				error = 'No wallet found. Please generate a wallet first from your profile.';
				currentStep = 'check';
			}
		} catch (err) {
			console.error('Wallet fetch error:', err);
			error = 'Failed to load wallet information. Please try again.';
			toastStore.add({
				message: 'Failed to load wallet',
				type: 'error',
				ttl: 3000
			});
		} finally {
			isLoadingWallet = false;
		}
	}

	async function fetchUserBalance() {
		if (!userWalletAddress?.[selectedChain]) {
			devLog('No wallet address for chain:', selectedChain);
			return;
		}

		isLoadingBalance = true;
		try {
			const walletAddr = userWalletAddress[selectedChain];
			const url = `${PUBLIC_API_URL}/wallet-balance?address=${walletAddr}&chain=${selectedChain}`;
			devLog('Fetching balance from:', url);

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			devLog('Balance response:', data);

			// pick correct field depending on chain
			let balanceVal = '0';
			if (selectedChain === 'ethereum') {
				balanceVal = data.balanceEth;
			} else if (selectedChain === 'avalanche') {
				balanceVal = data.balanceAvax;
			} else if (selectedChain === 'solana') {
				balanceVal = data.balanceSol;
			} else if (selectedChain === 'stellar') {
				balanceVal = data.balanceXlm;
			} else if (selectedChain === 'bitcoin') {
				balanceVal = data.balanceBtc || '0';
			}
			userBalance[selectedChain] = parseFloat(balanceVal || '0').toFixed(6);
			devLog(`Updated ${selectedChain} balance to:`, userBalance[selectedChain]);
		} catch (err) {
			console.error('Balance fetch error:', err);
			userBalance[selectedChain] = '0';
			toastStore.add({
				message: `Failed to fetch ${selectedChain} balance: ${err instanceof Error ? err.message : 'Unknown error'}`,
				type: 'error',
				ttl: 4000
			});
		} finally {
			isLoadingBalance = false;
		}
	}

	async function fetchTransactionHistory() {
		if (!$authStore.accessToken) return;

		isLoadingHistory = true;
		try {
			// Mock transactions for now - replace with actual API call
			const mockTransactions: Transaction[] = [
				{
					id: '1',
					chain: 'ethereum',
					amount: 0.5,
					recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f42fA1',
					hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
					timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
					status: 'confirmed'
				},
				{
					id: '2',
					chain: 'avalanche',
					amount: 1.0,
					recipient: '0x842d35Cc6634C0532925a3b844Bc9e7595f42fA2',
					hash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
					timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
					status: 'confirmed'
				}
			];
			transactions = mockTransactions;
		} catch (err) {
			console.error('Failed to fetch transaction history:', err);
		} finally {
			isLoadingHistory = false;
		}
	}

	function validateAddress(addr: string): boolean {
		switch (selectedChain) {
			case 'ethereum':
			case 'avalanche':
				return /^0x[a-fA-F0-9]{40}$/.test(addr);
			case 'solana':
				return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
			case 'stellar':
				return /^G[A-Z0-9]{55}$/.test(addr);
			case 'bitcoin':
				// simple bech32 or legacy address check
				return /^(?:bc1)[a-z0-9]{25,39}$/.test(addr);
			default:
				return false;
		}
	}

	async function lookupWalletAddress(address: string) {
		if (!address || !validateAddress(address)) {
			lookedUpCompany = null;
			selectedBountyId = null;
			lookupError = null;
			return;
		}

		isLookingUpAddress = true;
		lookupError = null;
		lookedUpCompany = null;
		selectedBountyId = null;

		try {
			const response = await fetch(
				`${PUBLIC_API_URL}/wallet/lookup?address=${address}&chain=${selectedChain}`,
				{
					headers: {
						Authorization: `Bearer ${$authStore.accessToken}`
					}
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.data) {
				lookedUpCompany = result.data;
				// Auto-select first active bounty if available
				const activeBounty = result.data.bounties?.find((b: BountyOption) => b.status === 'active');
				if (activeBounty) {
					selectedBountyId = activeBounty.id;
				}
				devLog('Address lookup success:', result.data);
			} else {
				lookupError = result.message || 'Wallet address not found in system';
				lookedUpCompany = null;
				devLog('Address not found or not associated with any company');
			}
		} catch (err: any) {
			console.error('Address lookup error:', err);
			lookedUpCompany = null;
			lookupError = err instanceof Error ? err.message : 'Failed to lookup wallet address';
		} finally {
			isLookingUpAddress = false;
		}
	}

	// Debounced address lookup
	function onAddressChange(newAddress: string) {
		recipientAddress = newAddress;

		// Clear existing timer
		if (lookupDebounceTimer) {
			clearTimeout(lookupDebounceTimer);
		}

		// Set new timer for debounced lookup (300ms delay)
		lookupDebounceTimer = setTimeout(() => {
			lookupWalletAddress(newAddress);
		}, 300);
	}

	function updateTotalCost() {
		const numAmount = typeof amount === 'number' ? amount : parseFloat(amount as any) || 0;
		totalCost = numAmount;
	}

	function formatAddress(addr: string): string {
		return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'confirmed':
				return 'badge-success';
			case 'pending':
				return 'badge-warning';
			case 'failed':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	// Pagination
	const paginatedTransactions = $derived.by(() => {
		return transactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
	});

	const totalPages = $derived.by(() => {
		return Math.ceil(transactions.length / itemsPerPage);
	});

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	async function handleSubmit() {
		// Validate inputs
		if (!recipientAddress.trim()) {
			error = 'Please enter a recipient address';
			return;
		}

		if (!validateAddress(recipientAddress)) {
			error = `Invalid ${CHAIN_NAMES[selectedChain]} address`;
			return;
		}

		const numAmount = typeof amount === 'number' ? amount : parseFloat(amount as any);
		if (!numAmount || numAmount <= 0) {
			error = 'Please enter a valid amount greater than 0';
			return;
		}

		const balanceNum = parseFloat(userBalance[selectedChain] || '0');
		if (numAmount > balanceNum) {
			// simple symbol map for each supported chain
			const unit =
				selectedChain === 'ethereum'
					? 'ETH'
					: selectedChain === 'avalanche'
						? 'AVAX'
						: selectedChain === 'solana'
							? 'SOL'
							: selectedChain === 'stellar'
								? 'XLM'
								: selectedChain === 'bitcoin'
									? 'BTC'
									: '';
		}

		isSubmitting = true;
		error = null;
		currentStep = 'submitting';

		try {
			const response = await fetch(`${PUBLIC_API_URL}/wallet/send`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${$authStore.accessToken}`
				},
				body: JSON.stringify({
					recipientAddress,
					chain: selectedChain,
					amountEth: numAmount
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Transaction failed');
			}

			// Success!
			txHash = result.data.transactionHash;
			explorerUrl = result.data.explorerUrl;
			success = true;
			currentStep = 'success';

			toastStore.add({
				message: 'Transaction sent successfully!',
				type: 'success',
				ttl: 5000
			});

			// Add to transaction history
			const newTx: Transaction = {
				id: Date.now().toString(),
				chain: selectedChain,
				amount: numAmount,
				recipient: recipientAddress,
				hash: txHash || '',
				timestamp: new Date(),
				status: 'pending'
			};
			transactions = [newTx, ...transactions];
			currentPage = 1; // Reset to first page
		} catch (err: any) {
			error = err.message || 'Failed to send transaction';
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

	function resetForm() {
		recipientAddress = '';
		amount = '';
		error = null;
		success = false;
		txHash = null;
		explorerUrl = null;
		currentStep = 'form';
		fetchUserBalance(); // Refresh balance
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		toastStore.add({
			message: 'Copied to clipboard',
			type: 'success',
			ttl: 2000
		});
	}

	onMount(async () => {
		await fetchUserWallet();
	});

	// Fetch balance when chain changes
	$effect(() => {
		if (selectedChain && userWalletAddress?.[selectedChain]) {
			devLog('Chain changed to:', selectedChain, 'Fetching balance...');
			fetchUserBalance();
		}
	});

	// Update total cost when amount changes
	$effect(() => {
		updateTotalCost();
	});
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<!-- Header -->
		<div class="mb-6 flex items-center gap-3">
			<div class="rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 p-3">
				<Send size={24} class="text-primary" />
			</div>
			<div>
				<h2 class="card-title text-2xl">Send Funds</h2>
				<p class="text-sm text-base-content/70">Transfer crypto using your generated wallet</p>
			</div>
		</div>

		{#if currentStep === 'check'}
			<!-- Check Wallet State -->
			<div class="space-y-4">
				{#if isLoadingWallet}
					<div class="alert">
						<Loader size={20} class="animate-spin" />
						<div>
							<div class="font-semibold">Loading Wallet...</div>
							<div class="text-sm">Please wait while we fetch your wallet information</div>
						</div>
					</div>
				{:else if error}
					<div class="alert alert-warning">
						<AlertCircle size={20} />
						<div>
							<div class="font-semibold">Wallet Not Found</div>
							<div class="text-sm">{error}</div>
						</div>
					</div>
					<a href="/profile" class="btn w-full gap-2 btn-primary">
						<WalletCards size={20} />
						Go to Profile to Generate Wallet
					</a>
				{/if}
			</div>
		{:else if currentStep === 'success'}
			<!-- Success State - PERSISTENT (doesn't auto-close) -->
			<div class="space-y-4">
				<div class="alert alert-success">
					<CheckCircle size={20} />
					<div>
						<div class="font-semibold">Transaction Submitted!</div>
						<div class="text-sm">Your transaction has been sent to the blockchain.</div>
					</div>
				</div>

				{#if txHash && explorerUrl}
					<div class="space-y-3 rounded-lg border border-success/20 bg-success/10 p-4">
						<div class="text-xs font-semibold text-success uppercase">Transaction Hash</div>
						<div class="flex items-center gap-2">
							<code class="flex-1 truncate rounded bg-base-200 px-3 py-2 font-mono text-xs"
								>{txHash}</code
							>
							<button
								class="btn btn-ghost btn-sm"
								onclick={() => copyToClipboard(txHash || '')}
								title="Copy hash"
							>
								<Copy size={16} />
							</button>
						</div>
						<a
							href={explorerUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="block flex link items-center gap-1 text-sm link-primary"
						>
							View on {selectedChain === 'ethereum' ? 'Etherscan' : 'Snowtrace'}
							<ExternalLink size={14} />
						</a>
					</div>

					<!-- Transaction Details -->
					<div class="grid grid-cols-2 gap-3 rounded-lg bg-base-200/50 p-4">
						<div>
							<div class="text-xs opacity-60">Amount</div>
							<div class="font-mono font-semibold">
								{amount}
								{selectedChain === 'ethereum'
									? ' ETH'
									: selectedChain === 'avalanche'
										? ' AVAX'
										: selectedChain === 'solana'
											? ' SOL'
											: selectedChain === 'stellar'
												? ' XLM'
												: selectedChain === 'bitcoin'
													? ' BTC'
													: ''}
							</div>
						</div>
						<div>
							<div class="text-xs opacity-60">To</div>
							<div class="font-mono text-sm">{formatAddress(recipientAddress)}</div>
						</div>
						<div>
							<div class="text-xs opacity-60">Network</div>
							<div class="font-semibold">{CHAIN_NAMES[selectedChain]}</div>
						</div>
						<div>
							<div class="text-xs opacity-60">Status</div>
							<div class="badge badge-sm badge-warning">Pending</div>
						</div>
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="flex gap-3">
					<button class="btn flex-1 btn-outline" onclick={() => resetForm()}> Send Another </button>
					{#if explorerUrl}
						<a
							href={explorerUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="btn flex-1 gap-2 btn-primary"
						>
							<ExternalLink size={18} />
							View in Explorer
						</a>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Form State -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-6"
			>
				<!-- Chain Selection -->
				<div class="form-control">
					<div class="label">
						<span class="label-text font-semibold">Select Network</span>
					</div>
					<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
						<button
							type="button"
							class="btn {selectedChain === 'ethereum' ? 'btn-primary' : 'btn-outline'} gap-2"
							disabled={!userWalletAddress?.ethereum || isSubmitting}
							onclick={() => (selectedChain = 'ethereum')}
						>
							<span class="text-xl">⟠</span>
							Ethereum Sepolia
						</button>
						<button
							type="button"
							class="btn {selectedChain === 'avalanche' ? 'btn-primary' : 'btn-outline'} gap-2"
							disabled={!userWalletAddress?.avalanche || isSubmitting}
							onclick={() => (selectedChain = 'avalanche')}
						>
							<span class="text-xl">▲</span>
							Avalanche Fuji
						</button>
						<button
							type="button"
							class="btn {selectedChain === 'solana' ? 'btn-primary' : 'btn-outline'} gap-2"
							disabled={!userWalletAddress?.solana || isSubmitting}
							onclick={() => (selectedChain = 'solana')}
						>
							<span class="text-xl">◎</span>
							Solana
						</button>
						<button
							type="button"
							class="btn {selectedChain === 'stellar' ? 'btn-primary' : 'btn-outline'} gap-2"
							disabled={!userWalletAddress?.stellar || isSubmitting}
							onclick={() => (selectedChain = 'stellar')}
						>
							<span class="text-xl">★</span>
							Stellar
						</button>
						<button
							type="button"
							class="btn {selectedChain === 'bitcoin' ? 'btn-primary' : 'btn-outline'} gap-2"
							disabled={!userWalletAddress?.bitcoin || isSubmitting}
							onclick={() => (selectedChain = 'bitcoin')}
						>
							<span class="text-xl">₿</span>
							Bitcoin
						</button>
					</div>
				</div>

				<!-- Balance Display -->
				<div class="stat rounded-lg bg-base-200/50 p-4">
					<div class="stat-title text-xs">Wallet Balance</div>
					{#if isLoadingBalance}
						<div class="h-8 skeleton"></div>
					{:else}
						<div class="stat-value text-2xl">
							{userBalance[selectedChain]}
							{selectedChain === 'ethereum'
								? ' ETH'
								: selectedChain === 'avalanche'
									? ' AVAX'
									: selectedChain === 'solana'
										? ' SOL'
										: selectedChain === 'stellar'
											? ' XLM'
											: selectedChain === 'bitcoin'
												? ' BTC'
												: ''}
						</div>
					{/if}
					<div class="stat-desc text-xs opacity-50">On {CHAIN_NAMES[selectedChain]}</div>
					{#if userWalletAddress?.[selectedChain]}
						<div class="mt-2 font-mono text-xs opacity-60">
							From: {userWalletAddress[selectedChain]?.slice(0, 10)}...{userWalletAddress[
								selectedChain
							]?.slice(-8)}
						</div>
					{/if}
				</div>

				<!-- Recipient Address -->
				<div class="form-control">
					<label class="label" for="recipient-address">
						<span class="label-text font-semibold">Recipient Address</span>
						{#if selectedBountyId}
							<span class="badge badge-sm badge-success">Auto-set from bounty</span>
						{/if}
					</label>
					<input
						id="recipient-address"
						type="text"
						placeholder={selectedChain === 'ethereum' || selectedChain === 'avalanche'
							? '0x...'
							: selectedChain === 'solana'
								? 'Solana address'
								: selectedChain === 'stellar'
									? 'Stellar address'
									: selectedChain === 'bitcoin'
										? 'Bitcoin address (bc1...)'
										: ''}
						class="input-bordered input font-mono text-sm"
						value={recipientAddress}
						onchange={(e) => onAddressChange((e.target as HTMLInputElement).value)}
						oninput={(e) => onAddressChange((e.target as HTMLInputElement).value)}
						disabled={isSubmitting}
					/>
					{#if recipientAddress && !validateAddress(recipientAddress)}
						<label class="label" for="recipient-address">
							<span class="label-text-alt text-xs text-error"
								>Invalid {CHAIN_NAMES[selectedChain]} address</span
							>
						</label>
					{/if}

					<!-- Address Lookup Status -->
					{#if isLookingUpAddress}
						<label class="label" for="recipient-address">
							<span class="label-text-alt flex items-center gap-1 text-xs text-info">
								<span class="loading loading-xs loading-spinner"></span>
								Verifying address...
							</span>
						</label>
					{/if}

					{#if lookupError}
						<label class="label" for="recipient-address">
							<span class="label-text-alt text-xs text-warning">{lookupError}</span>
						</label>
					{/if}
				</div>

				<!-- Company & Bounty Selection (if address found) -->
				{#if lookedUpCompany}
					<div class="space-y-4 rounded-lg border border-success/30 bg-success/10 p-4">
						<!-- Company Info -->
						<div class="space-y-2">
							<div class="text-xs font-semibold text-success uppercase">Recipient Company</div>
							<div class="space-y-1">
								<h3 class="text-lg font-bold">{lookedUpCompany.company.name}</h3>
								{#if lookedUpCompany.company.description}
									<p class="text-sm opacity-70">{lookedUpCompany.company.description}</p>
								{/if}
								{#if lookedUpCompany.company.industry}
									<div class="badge badge-outline badge-sm">{lookedUpCompany.company.industry}</div>
								{/if}
							</div>
						</div>

						<!-- Bounty Selection -->
						{#if lookedUpCompany.bounties && lookedUpCompany.bounties.length > 0}
							<div class="space-y-3">
								<div class="text-xs font-semibold text-success uppercase">
									Active Bounties / Wishlist Items
								</div>
								<select
									class="select-bordered select w-full text-sm"
									bind:value={selectedBountyId}
									disabled={isSubmitting}
								>
									<option value="">-- Select a bounty (optional) --</option>
									{#each lookedUpCompany.bounties as bounty (bounty.id)}
										{#if bounty.status === 'active'}
											<option value={bounty.id}>
												{bounty.deployments &&
												bounty.deployments.length > 0 &&
												bounty.deployments[0].campaignName
													? bounty.deployments[0].campaignName
													: bounty.title} ({bounty.currentAmount}/{bounty.targetAmount}
												{bounty.chain === 'ethereum' ? 'ETH' : 'AVAX'})
											</option>
										{/if}
									{/each}
								</select>

								<!-- Selected Bounty Details -->
								{#if selectedBountyId}
									{@const selectedBounty = lookedUpCompany.bounties.find(
										(b) => b.id === selectedBountyId
									)}
									{#if selectedBounty}
										<div class="space-y-2 rounded border border-success/20 bg-base-200/50 p-3">
											<div class="flex items-start justify-between">
												<div>
													<div class="font-semibold">
														{selectedBounty.deployments &&
														selectedBounty.deployments.length > 0 &&
														selectedBounty.deployments[0].campaignName
															? selectedBounty.deployments[0].campaignName
															: selectedBounty.title}
													</div>
													{#if selectedBounty.description}
														<p class="mt-1 text-xs opacity-70">{selectedBounty.description}</p>
													{/if}
												</div>
												<div
													class="badge badge-sm"
													class:badge-success={selectedBounty.status === 'active'}
												>
													{selectedBounty.status}
												</div>
											</div>
											<div
												class="flex items-center justify-between border-t border-base-300 pt-2 text-sm"
											>
												<span class="opacity-70">Progress</span>
												<span class="font-mono font-semibold"
													>{selectedBounty.currentAmount} / {selectedBounty.targetAmount}
													{selectedBounty.chain === 'ethereum' ? 'ETH' : 'AVAX'}</span
												>
											</div>
											<div class="h-2 w-full rounded-full bg-base-300">
												<div
													class="h-2 rounded-full bg-success transition-all"
													style="width: {Math.min(
														100,
														(selectedBounty.currentAmount / selectedBounty.targetAmount) * 100
													)}%"
												></div>
											</div>
											<!-- Contract Address Info -->
											<div class="mt-3 rounded border border-success/30 bg-success/10 p-2">
												<div class="mb-1 text-xs font-semibold text-success">
													Escrow Contract (Auto-set)
												</div>
												<div class="font-mono text-xs break-all text-success opacity-90">
													{selectedBounty.contractAddress}
												</div>
												<div class="mt-2 text-xs opacity-70">
													Funds will be sent to this bounty's escrow contract, not the company
													wallet.
												</div>
											</div>
										</div>
									{/if}
								{:else}
									<p class="text-xs opacity-60">
										Select a bounty above to contribute to a specific wishlist item
									</p>
								{/if}
							</div>
						{:else}
							<div class="alert-sm alert alert-info">
								<AlertCircle size={16} />
								<span class="text-sm">No active bounties for this company</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Amount -->
				<div class="form-control">
					<label class="label" for="send-amount">
						<span class="label-text font-semibold">Amount to Send</span>
						<span class="label-text-alt text-xs">
							Max: {userBalance[selectedChain]}
							{selectedChain === 'ethereum'
								? 'ETH'
								: selectedChain === 'avalanche'
									? 'AVAX'
									: selectedChain === 'solana'
										? 'SOL'
										: selectedChain === 'stellar'
											? 'XLM'
											: 'BTC'}
						</span>
					</label>
					<div class="relative">
						<input
							id="send-amount"
							type="number"
							placeholder="0.5"
							class="input-bordered input w-full pr-16"
							step="0.0001"
							min="0"
							bind:value={amount}
							disabled={isSubmitting}
						/>
						<button
							type="button"
							class="btn absolute top-1/2 right-1 -translate-y-1/2 btn-ghost btn-sm"
							onclick={() => (amount = parseFloat(userBalance[selectedChain] || '0') || 0)}
							title="Use max balance"
						>
							MAX
						</button>
					</div>
				</div>

				<!-- Cost Summary -->
				{#if amount && typeof amount === 'number' && amount > 0}
					<div class="rounded-lg bg-base-200/50 p-4">
						<div class="flex items-center justify-between font-semibold">
							<span>Total to Send:</span>
							<span class="font-mono text-lg"
								>{totalCost.toFixed(6)}
								{selectedChain === 'ethereum'
									? 'ETH'
									: selectedChain === 'avalanche'
										? 'AVAX'
										: selectedChain === 'solana'
											? 'SOL'
											: selectedChain === 'stellar'
												? 'XLM'
												: 'BTC'}</span
							>
						</div>
						{#if totalCost > parseFloat(userBalance[selectedChain] || '0')}
							<div class="alert-sm mt-3 alert alert-warning">
								<AlertCircle size={16} />
								<span class="text-xs">Insufficient balance</span>
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
					class="btn w-full gap-2 btn-lg btn-primary"
					disabled={isSubmitting ||
						!recipientAddress ||
						!amount ||
						totalCost > parseFloat(userBalance[selectedChain] || '0')}
				>
					{#if isSubmitting}
						<Loader size={20} class="animate-spin" />
						Sending...
					{:else}
						<Send size={20} />
						Send {selectedChain === 'ethereum' ? 'ETH' : selectedChain === 'avalanche' ? 'AVAX' : selectedChain === 'solana' ? 'SOL' : selectedChain === 'stellar' ? 'XLM' : selectedChain === 'bitcoin' ? 'BTC' : ''}
					{/if}
				</button>
			</form>
		{/if}
	</div>
</div>

<!-- Transaction History Section -->
<div class="card mt-6 bg-base-100 shadow-xl">
	<div class="card-body">
		<!-- Header -->
		<div class="mb-6 flex items-center gap-3">
			<div class="rounded-lg bg-gradient-to-br from-info/20 to-info/10 p-3">
				<Send size={24} class="text-info" />
			</div>
			<div>
				<h2 class="card-title text-2xl">Transaction History</h2>
				<p class="text-sm text-base-content/70">Your recent fund transfers</p>
			</div>
		</div>

		{#if isLoadingHistory}
			<div class="space-y-3">
				<div class="h-12 skeleton rounded-lg"></div>
				<div class="h-12 skeleton rounded-lg"></div>
				<div class="h-12 skeleton rounded-lg"></div>
			</div>
		{:else if transactions.length === 0}
			<div class="alert alert-info">
				<AlertCircle size={20} />
				<div>
					<div class="font-semibold">No transactions yet</div>
					<div class="text-sm">Your transactions will appear here</div>
				</div>
			</div>
		{:else}
			<!-- Transactions Table -->
			<div class="overflow-x-auto">
				<table class="table w-full table-zebra table-sm">
					<thead>
						<tr class="border-base-300">
							<th class="text-xs">Date & Time</th>
							<th class="text-xs">Amount</th>
							<th class="text-xs">Recipient</th>
							<th class="text-xs">Chain</th>
							<th class="text-xs">Status</th>
							<th class="text-center text-xs">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedTransactions as tx (tx.id)}
							<tr class="hover:bg-base-200/50">
								<td class="text-xs">
									<div>{formatDate(tx.timestamp)}</div>
								</td>
								<td class="font-mono text-xs font-semibold">
									{tx.amount}
									{tx.chain === 'ethereum' ? 'ETH' : 'AVAX'}
								</td>
								<td class="font-mono text-xs">
									<div title={tx.recipient}>{formatAddress(tx.recipient)}</div>
								</td>
								<td class="text-xs">
									<span
										class="badge badge-sm {tx.chain === 'ethereum'
											? 'badge-warning'
											: 'badge-error'}"
									>
										{tx.chain === 'ethereum' ? '⟠' : '▲'}
										{tx.chain === 'ethereum' ? 'Sepolia' : 'Fuji'}
									</span>
								</td>
								<td class="text-xs">
									<span class="badge badge-sm {getStatusColor(tx.status)}">
										{tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
									</span>
								</td>
								<td class="text-center text-xs">
									<a
										href={EXPLORER_URLS[tx.chain] + tx.hash}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex link items-center gap-1 link-primary"
										title="View transaction"
									>
										<ExternalLink size={14} />
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="mt-6 flex items-center justify-between border-t border-base-300 pt-4">
					<div class="text-sm text-base-content/60">
						Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
							currentPage * itemsPerPage,
							transactions.length
						)} of {transactions.length} transactions
					</div>
					<div class="flex gap-2">
						<button
							class="btn btn-outline btn-sm"
							onclick={() => goToPage(currentPage - 1)}
							disabled={currentPage === 1}
						>
							<ChevronLeft size={16} />
						</button>

						<div class="flex items-center gap-1">
							{#each Array(totalPages) as _, i}
								{@const page = i + 1}
								<button
									class="btn btn-sm {currentPage === page ? 'btn-primary' : 'btn-ghost'}"
									onclick={() => goToPage(page)}
								>
									{page}
								</button>
							{/each}
						</div>

						<button
							class="btn btn-outline btn-sm"
							onclick={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages}
						>
							<ChevronRight size={16} />
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	:global(.btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
