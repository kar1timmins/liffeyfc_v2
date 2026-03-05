<script lang="ts">
	import { fade } from 'svelte/transition';
	import {
		CheckCircle2,
		CalendarDays,
		Clock,
		MapPin,
		BadgeDollarSign,
		ExternalLink
	} from 'lucide-svelte';
	import { getNextEvent } from '$lib/animations';

	let {
		submitted = false,
	}: {
		submitted?: boolean;
	} = $props();

	const nextEvent = getNextEvent();
</script>

<div in:fade={{ duration: 200 }}>
	{#if submitted}
		<div
			class="alert alert-success mb-6 shadow-lg glass-subtle backdrop-blur-md rounded-2xl border-0"
			in:fade={{ duration: 250 }}
		>
			<CheckCircle2 class="h-6 w-6 shrink-0 stroke-current text-success" />
			<div class="flex-1">
				<h3 class="font-bold text-success-content text-lg mb-2">Welcome to Liffey Founders Club!</h3>
				<div class="text-sm text-success-content/90 space-y-2">
					<p class="font-medium">Registration confirmed for {nextEvent.displayQuarter} {nextEvent.year}</p>
					<div class="text-xs space-y-1">
						<p>Your information has been submitted successfully</p>
						<p>Welcome details have been sent</p>
						<p>Welcome to Dublin's premier startup community!</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="text-center mb-6">
		<div class="glass-subtle rounded-full px-6 py-3 inline-block mb-4">
			<h3 class="text-base-content text-xl font-bold md:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
				Event Registration
			</h3>
		</div>
	</div>

	<div class="glass-subtle mb-8 rounded-2xl p-6 md:p-8 backdrop-blur-md">
		<div class="flex items-center justify-center mb-6">
			<div class="glass-subtle rounded-full px-4 py-2 inline-flex items-center gap-2">
				<span class="w-3 h-3 bg-accent rounded-full animate-pulse"></span>
				<h3 class="text-lg font-bold md:text-xl text-accent">
					Next Event: {nextEvent.displayQuarter} {nextEvent.year}
				</h3>
			</div>
		</div>
		<div class="grid grid-cols-1 gap-4 text-sm text-base-content md:grid-cols-2">
			<div class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
				<CalendarDays class="text-accent h-6 w-6 flex-shrink-0" />
				<div><span class="font-semibold">Date:</span> Tuesday 10th March</div>
			</div>
			<div class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
				<Clock class="text-accent h-6 w-6 flex-shrink-0" />
				<div><span class="font-semibold">Time:</span> Evening Session</div>
			</div>
			<div class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
				<MapPin class="text-accent h-6 w-6 flex-shrink-0" />
				<div><span class="font-semibold">Location:</span> Dublin, Ireland</div>
			</div>
			<div class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
				<BadgeDollarSign class="text-accent h-6 w-6 flex-shrink-0" />
				<div><span class="font-semibold">Cost:</span> Free Event</div>
			</div>
		</div>
	</div>

	<div class="flex justify-center">
		<a
			href="https://luma.com/xd6tye51"
			target="_blank"
			rel="noopener noreferrer"
			class="luma-checkout--button luma-cta btn glass-subtle btn-neon-adaptive btn-lg focus:ring-accent/50 flex transform items-center gap-3 rounded-full px-8 py-4 text-base shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-accent/20 focus:outline-none focus:ring-4 md:px-10 md:text-lg"
		>
			<span>
				<ExternalLink class="h-5 w-5" />
			</span>
			Register via Luma
		</a>
	</div>
</div>
