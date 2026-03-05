<script lang="ts">
	import {
		ArrowLeftRight,
		BadgeDollarSign,
		MapPin,
		Clock
	} from 'lucide-svelte';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	export let onGetStarted: () => void = () => {};

	const features = [
		{
			icon: ArrowLeftRight,
			title: 'Pitch Your Business',
			description: 'Present your business idea to investors, mentors, and fellow entrepreneurs in a supportive environment.',
			color: 'primary'
		},
		{
			icon: BadgeDollarSign,
			title: 'Connect with Investors',
			description: "Meet angel investors and VCs looking for the next big opportunity in Dublin's startup scene.",
			color: 'accent'
		},
		{
			icon: MapPin,
			title: 'Community Building',
			description: 'Join a thriving community of founders, entrepreneurs, and innovators in Dublin.',
			color: 'success'
		},
		{
			icon: Clock,
			title: 'Regular Events',
			description: 'Quarterly events ensure consistent networking and growth opportunities throughout the year.',
			color: 'warning'
		}
	];
</script>

<div class="space-y-6 md:space-y-8" in:fade={{ duration: 200 }}>
	<div class="text-center">
		<h2
			class="text-base-content text-xl md:text-2xl lg:text-3xl font-bold mb-3 md:mb-4"
		>
			Quarterly Startup Events
		</h2>
		<p class="text-sm md:text-base lg:text-lg text-base-content/80 max-w-2xl mx-auto leading-relaxed">
			Join Dublin's most exciting entrepreneurial community for networking, pitching, and
			learning opportunities.
		</p>
	</div>

	<div class="grid gap-3 md:gap-4 md:grid-cols-2">
		{#each features as feature, i}
			<div
				class="glass-subtle rounded-2xl p-4 md:p-5 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200"
				in:fly={{ y: 20, duration: 300, delay: i * 80, easing: quintOut }}
			>
				<div class="flex items-center gap-3 mb-2">
					<div
						class="w-9 h-9 md:w-10 md:h-10 bg-{feature.color}/20 rounded-full flex items-center justify-center flex-shrink-0"
					>
						<svelte:component this={feature.icon} class="w-4 h-4 md:w-5 md:h-5 text-{feature.color}" />
					</div>
					<h4 class="text-sm md:text-base font-semibold text-base-content">
						{feature.title}
					</h4>
				</div>
				<p class="text-xs md:text-sm text-base-content/70 leading-relaxed pl-12">
					{feature.description}
				</p>
			</div>
		{/each}
	</div>

	<div class="text-center pt-2">
		<button
			class="btn btn-primary btn-neon-adaptive px-6 py-3 md:px-8 text-sm md:text-base font-medium rounded-full"
			on:click={onGetStarted}
		>
			Get Started &rarr;
		</button>
	</div>
</div>
