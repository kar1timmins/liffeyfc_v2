<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import SendFunds from '$lib/components/SendFunds.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	async function checkAuth() {
		const ok = await authStore.verify();
		if (!ok) goto('/auth');
	}

	$: {
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
			Back to Dashboard
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
						<div>Connect your MetaMask wallet</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">2</div>
						<div>Select the network</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">3</div>
						<div>Enter recipient address and amount</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">4</div>
						<div>Review fees and confirm in MetaMask</div>
					</li>
					<li class="flex gap-3">
						<div class="badge badge-sm flex-shrink-0">5</div>
						<div>Transaction sent to blockchain</div>
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
					Do I need MetaMask installed?
				</div>
				<div class="collapse-content text-sm">
					<p>Yes, you need MetaMask or another Web3 wallet extension installed in your browser to send funds. MetaMask is available for free on Chrome, Firefox, and Safari.</p>
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
					<p>Yes. MetaMask handles all transaction signing on your device. We never see your private keys or control your funds. You always review and approve transactions in MetaMask.</p>
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
