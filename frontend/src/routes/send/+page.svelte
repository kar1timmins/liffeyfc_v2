<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth';
	import SendFunds from '$lib/components/SendFunds.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	async function checkAuth() {
		const ok = await authStore.verify();
		if (!ok) goto('/auth');
	}

	$: if (browser) {
		checkAuth();
	}
</script>

<!-- Min height ensures footer stays at bottom -->
<div class="min-h-[calc(100vh-20rem)] container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<button 
			class="btn btn-ghost btn-sm gap-2 mb-4"
			onclick={() => goto('/dashboard')}
		>
			<ArrowLeft size={18} />
			Back
		</button>
		<h1 class="text-4xl font-bold mb-2">Send Funds</h1>
		<p class="text-base-content/70">Transfer cryptocurrency to any wallet address on supported blockchain networks</p>
	</div>

	<!-- SendFunds Component -->
	<SendFunds />

	<!-- Info Section -->
	<div class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Supported Networks -->
		<div class="card bg-base-200/50">
			<div class="card-body">
				<h2 class="card-title text-lg mb-4">Supported Networks</h2>
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="badge badge-lg">⟠</div>
						<div>
							<div class="font-semibold text-sm">Ethereum Sepolia</div>
							<div class="text-xs opacity-70">Testnet for testing</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="badge badge-lg">▲</div>
						<div>
							<div class="font-semibold text-sm">Avalanche Fuji</div>
							<div class="text-xs opacity-70">Testnet for testing</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="badge badge-lg">◎</div>
						<div>
							<div class="font-semibold text-sm">Solana</div>
							<div class="text-xs opacity-70">Mainnet (or Devnet for testing)</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="badge badge-lg">★</div>
						<div>
							<div class="font-semibold text-sm">Stellar</div>
							<div class="text-xs opacity-70">Public network</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="badge badge-lg">₿</div>
						<div>
							<div class="font-semibold text-sm">Bitcoin Testnet</div>
							<div class="text-xs opacity-70">Testnet network</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- How It Works -->
		<div class="card bg-base-200/50">
			<div class="card-body">
				<h2 class="card-title text-lg mb-4">How It Works</h2>
				<ol class="space-y-3 text-sm">
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">1</div>
						<div>Your wallet is automatically generated from your account</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">2</div>
						<div>Select the network (Ethereum Sepolia, Avalanche Fuji, Solana, or Stellar)</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">3</div>
						<div>Enter recipient address and amount</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">4</div>
						<div>Review transaction details and confirm</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">5</div>
						<div>Transaction sent via secure backend wallet</div>
					</li>
				</ol>
			</div>
		</div>
	</div>

	<!-- FAQ -->
	<div class="mt-12">
		<h2 class="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
		<div class="space-y-4">
			<div class="collapse collapse-arrow bg-base-200/50">
				<input type="radio" name="faq" />
				<div class="collapse-title font-semibold">
					How does the wallet work?
				</div>
				<div class="collapse-content text-sm">
					<p>A secure wallet is automatically generated for your account. Your private keys are encrypted and stored safely on our servers. You simply enter the amount and recipient address, and we handle the transaction signing and submission for you - no MetaMask required!</p>
				</div>
			</div>

			<div class="collapse collapse-arrow bg-base-200/50">
				<input type="radio" name="faq" />
				<div class="collapse-title font-semibold">
					What testnet networks are supported?
				</div>
				<div class="collapse-content text-sm">
					<p>We support Ethereum Sepolia and Avalanche Fuji testnets for testing purposes. Support for mainnet networks will be added in the future.</p>
				</div>
			</div>

			<div class="collapse collapse-arrow bg-base-200/50">
				<input type="radio" name="faq" />
				<div class="collapse-title font-semibold">
					How much are gas fees?
				</div>
				<div class="collapse-content text-sm">
					<p>Gas fees depend on network congestion and are displayed before you submit a transaction. You can see the estimated fee breakdown in the form, which includes gas price and your specified amount.</p>
				</div>
			</div>

			<div class="collapse collapse-arrow bg-base-200/50">
				<input type="radio" name="faq" />
				<div class="collapse-title font-semibold">
					Is this secure?
				</div>
				<div class="collapse-content text-sm">
					<p>Yes. Your private keys are encrypted with AES-256-GCM and stored securely on our servers. Only authenticated users can access their wallets. All transactions are signed server-side using your encrypted keys, ensuring no private key exposure.</p>
				</div>
			</div>

			<div class="collapse collapse-arrow bg-base-200/50">
				<input type="radio" name="faq" />
				<div class="collapse-title font-semibold">
					Can I cancel a transaction?
				</div>
				<div class="collapse-content text-sm">
					<p>Once a transaction is sent to the blockchain, it cannot be cancelled. However, on testnets you can always get more test funds from faucets if needed.</p>
				</div>
			</div>
		</div>
	</div>
</div>
