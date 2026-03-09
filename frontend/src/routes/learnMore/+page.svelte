<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import {
		generateRandomCircles,
		animateCircles,
		type Circle
	} from '$lib/animations';
	import { dur } from '$lib/transitions';
	import { ArrowLeftRight } from 'lucide-svelte';

	import AboutEvents from '$lib/components/learnMore/AboutEvents.svelte';
	import InterestForm from '$lib/components/learnMore/InterestForm.svelte';
	import EventRegistration from '$lib/components/learnMore/EventRegistration.svelte';

	type View = 'about' | 'interest' | 'register';
	let view: View = 'about';
	let formSubmitted = false;
	let showLM = true;
	let navTarget: string | null = null;
	let mounted = false;

	const tabs: { key: View; label: string }[] = [
		{ key: 'about', label: 'About Events' },
		{ key: 'interest', label: 'Register Interest' },
		{ key: 'register', label: 'Event Registration' }
	];

	// Dynamic floating circles
	let circles: Circle[] = [];
	let animationFrame: number;

	const routeOpacity = (node: Element) =>
		fade(node as HTMLElement, { duration: dur.fast });

	function backToPitch(e: Event) {
		e.preventDefault();
		navTarget = '/pitch';
		showLM = false;
	}

	function handleFormSuccess() {
		formSubmitted = true;
		// Stay on 'interest' tab — InterestForm shows its own full success screen
	}

	onMount(() => {
		circles = generateRandomCircles(12);
		function animate() {
			circles = animateCircles(circles);
			animationFrame = requestAnimationFrame(animate);
		}
		animate();
		mounted = true;
		return () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
		};
	});
</script>

<svelte:head>
	<title>Join Liffey Founders Club - Dublin's Premier Startup Community | Register Now</title>
	<meta name="description" content="Register to join Dublin's leading startup community. Practice your pitch, connect with investors, and grow your business at our quarterly events. Open to entrepreneurs, founders, and investors." />
	<link rel="canonical" href="https://liffeyfoundersclub.com/learnMore" />
	<meta name="robots" content="index, follow" />
	
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://liffeyfoundersclub.com/learnMore" />
	<meta property="og:title" content="Join Liffey Founders Club - Dublin's Premier Startup Community" />
	<meta property="og:description" content="Register to join Dublin's leading startup community. Practice your pitch, connect with investors, and grow your business." />
	<meta property="og:image" content="https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png" />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1668" />
	<meta property="og:image:height" content="2388" />
	<meta property="og:image:alt" content="Liffey Founders Club Logo" />
	
	<!-- Twitter -->
	<meta property="twitter:card" content="summary" />
	<meta property="twitter:url" content="https://liffeyfoundersclub.com/learnMore" />
	<meta property="twitter:title" content="Join Liffey Founders Club - Dublin's Premier Startup Community" />
	<meta property="twitter:description" content="Register to join Dublin's leading startup community. Practice your pitch, connect with investors, and grow your business." />
	<meta property="twitter:image" content="https://liffeyfoundersclub.com/img/logo/Liffey_Founders_Club_Logo.png" />
	<meta property="twitter:image:alt" content="Liffey Founders Club Logo" />
	
	<!-- Breadcrumb Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		"itemListElement": [
			{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://liffeyfoundersclub.com/" },
			{ "@type": "ListItem", "position": 2, "name": "Join Community", "item": "https://liffeyfoundersclub.com/learnMore" }
		]
	})}</script>`}
</svelte:head>

{#if showLM}
	<section
		class="flex min-h-screen items-center justify-center px-3 py-10 md:px-4 md:py-16 relative overflow-hidden"
		out:routeOpacity
		on:outroend={() => {
			if (navTarget) goto(navTarget);
		}}
	>
		<!-- Floating background elements -->
		<div class="absolute inset-0 pointer-events-none">
			{#each circles as circle (circle.id)}
				<div
					class="absolute rounded-full glass-subtle animate-pulse transition-all duration-1000 ease-out"
					style="
						left: {circle.x}%; 
						top: {circle.y}%; 
						width: {circle.size}px; 
						height: {circle.size}px;
						animation-delay: {circle.animationDelay}s;
						transform: translate(-50%, -50%);
						opacity: {circle.opacity};
					"
				></div>
			{/each}
		</div>

		<div class="w-full max-w-4xl relative z-10">
			<div class="mb-8 text-center md:mb-12">
				<div class="glass-subtle rounded-3xl px-6 py-4 md:px-8 md:py-6 inline-block mb-4">
					<h1 class="text-primary text-3xl font-bold md:text-5xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
						Learn More
					</h1>
				</div>
				<p class="text-base-content/90 mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
					Connect with founders, investors, and the community in our quarterly events.
				</p>
			</div>

			<div class="glass glass-learn-more overflow-hidden rounded-3xl backdrop-blur-xl">
				<div class="p-4 md:p-6 lg:p-8 backdrop-blur-sm">
					<div class="flex justify-center px-2">
						<div
							role="tablist"
							class="tabs tabs-boxed bg-transparent border-0 backdrop-blur-md rounded-3xl p-1 md:p-2 mb-4 md:mb-6 flex flex-col sm:flex-row gap-1 sm:gap-0.5 w-full sm:w-auto justify-center"
						>
						{#each tabs as tab}
								<button
									role="tab"
									class="tab h-10 sm:h-9 md:h-10 text-xs sm:text-xs md:text-sm lg:text-base font-medium transition-all duration-300 rounded-2xl btn-neon-subtle whitespace-nowrap px-3 sm:px-2.5 md:px-4 flex-shrink-0 {view === tab.key
										? 'glass-subtle text-primary shadow-md'
										: 'text-base-content/70 hover:text-base-content hover:bg-white/5'}"
									on:click={() => (view = tab.key)}
								>
									{tab.label}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="p-4 pt-0 md:p-6 md:pt-0 lg:p-8 lg:pt-0">
					<div class="glass-learn-more rounded-3xl p-4 md:p-6 lg:p-8 backdrop-blur-md">
						{#if view === 'about'}
							<AboutEvents onGetStarted={() => (view = 'interest')} />
						{:else if view === 'interest'}
							<InterestForm onSuccess={handleFormSuccess} />
						{:else if view === 'register'}
							<EventRegistration submitted={formSubmitted} />
						{/if}
					</div>
				</div>
			</div>

			<div class="flex justify-center mt-8 md:mt-12">
				<div class="glass-subtle rounded-full p-2 backdrop-blur-md">
					<a
						href="/pitch"
						class="btn btn-ghost glass-subtle btn-neon-cool flex items-center gap-2 rounded-full px-6 py-3 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
						on:click={backToPitch}
					>
						<ArrowLeftRight size={18} />
						Back to Pitch
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}