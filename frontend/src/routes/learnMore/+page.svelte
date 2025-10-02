<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		generateRandomCircles,
		animateCircles,
		getNextEvent,
		type Circle
	} from '$lib/animations';
	import {
		makeCrossfade,
		noIntro,
		dur,
		crossEase
	} from '$lib/transitions';
	import {
		ArrowLeftRight,
		BadgeDollarSign,
		MapPin,
		Clock,
		AlertTriangle,
		CheckCircle2,
		CalendarDays,
		ExternalLink
	} from 'lucide-svelte';

	// Dev logger (visible by default in dev; can force with ?debug=1)
	let DBG_ENABLED = process.env.NODE_ENV === 'development';
	const dbg = (...args: any[]) => {
		if (DBG_ENABLED) console.log('[learnMore]', ...args);
	};

	let submitted: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	let step = 0;
	let view: 'about' | 'interest' | 'register' = 'about';

	const interests = ['Attending', 'Pitching my business', 'Investing / Partnering'];
	let name = '';
	let email = '';
	let interest: string | null = null;
	let message = '';
	let consent = false;
	let formError = '';
	let fieldErrors: Record<string, string> = {};

	let nameInputEl: HTMLInputElement | null = null;
	let emailInputEl: HTMLInputElement | null = null;
	let showStep2Errors = false;
	let mountedLM = false;

	// --- reCAPTCHA v3 State ---
	let recaptchaReady = false;
	const siteKey = PUBLIC_RECAPTCHA_SITE_KEY || '';

	// Web3Forms access key - access from environment
	function getWeb3FormsAccessKey(): string {
		// Try to get from the public environment variable
		if (typeof window !== 'undefined') {
			// Client-side: try to get from meta tag or directly from env
			const metaKey = document.querySelector('meta[name="web3forms-access-key"]')?.getAttribute('content');
			if (metaKey) return metaKey;
		}
		// Fallback to the known access key
		return 'c6083f7c-0367-4417-be5e-9e2ca45fcac8';
	}

	// Crossfade between Interest and Registration views
	const [send, receive] = makeCrossfade(() => mountedLM, {
		duration: dur.crossfade + 120,
		fallbackDuration: dur.fast
	});
	let showLM = true;
	let navTarget: string | null = null;
	function backToPitch(e: Event) {
		e.preventDefault();
		navTarget = '/pitch';
		showLM = false;
	}
	const outView = noIntro(() => mountedLM, send);
	const inView = noIntro(() => mountedLM, receive);

	// Smooth step transitions within the Interest form
	const outStep = noIntro(
		() => mountedLM,
		(node: Element) =>
			fade(node as HTMLElement, { duration: Math.round(dur.base * 0.9), easing: crossEase })
	);
	const inStep = noIntro(
		() => mountedLM,
		(node: Element) => fade(node as HTMLElement, { duration: dur.base, easing: crossEase })
	);

	// Route transition for navigation
	const routeOpacity = (node: Element) => {
		return fade(node as HTMLElement, { duration: dur.fast });
	};

	type YesNo = 'Yes' | 'No' | null;
	let pitchedBefore: YesNo = null;

	// Derived fields and validation helpers
	$: nameClean = name.trim();
	$: emailClean = email.trim();
	$: emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailClean);
	$: step2NameOk = nameClean.length >= 2;
	$: step2EmailOk = emailValid;

	// Reactive statement to ensure button state updates
	$: buttonCanNext = (() => {
		if (step === 0) return pitchedBefore !== null;
		if (step === 1) return !!interest;
		if (step === 2) return step2NameOk && step2EmailOk;
		if (step === 3) return true; // message optional
		if (step === 4) return consent;
		return false;
	})();

	// Dynamic floating circles
	let circles: Circle[] = [];
	let animationFrame: number;

	function initCircles() {
		circles = generateRandomCircles(12);
	}

	function startAnimation() {
		circles = animateCircles(circles);
		animationFrame = requestAnimationFrame(startAnimation);
	}

	// Compute the next event details
	const nextEvent = getNextEvent();

	function next() {
		if (step < 4) step += 1;
	}
	function prev() {
		if (step > 0) step -= 1;
	}
	function canNext() {
		if (step === 0) return pitchedBefore !== null;
		if (step === 1) return !!interest;
		if (step === 2) return step2NameOk && step2EmailOk;
		if (step === 3) return true; // message optional
		if (step === 4) return consent;
		return false;
	}

	function handleNext() {
		if (step === 2) {
			showStep2Errors = true;
			if (step2NameOk && step2EmailOk) {
				step += 1;
				showStep2Errors = false;
			}
			return;
		}
		if (canNext()) step += 1;
	}

	async function submitForm() {
		submitted = 'submitting';
		formError = '';
		fieldErrors = {};

		// Validate required fields
		if (!nameClean || nameClean.length < 2) {
			formError = 'Please enter a valid name.';
			submitted = 'error';
			return;
		}
		if (!emailValid) {
			formError = 'Please enter a valid email address.';
			submitted = 'error';
			return;
		}
		if (!consent) {
			formError = 'Please agree to be contacted about upcoming events.';
			submitted = 'error';
			return;
		}

		const web3formsAccessKey = getWeb3FormsAccessKey();
		if (!web3formsAccessKey) {
			formError = 'Form configuration error. Please try again later.';
			submitted = 'error';
			return;
		}

		try {
			// Optional reCAPTCHA token (for logging/analytics only, not sent to Web3Forms)
			let recaptchaToken = '';
			if (siteKey && recaptchaReady) {
				try {
					recaptchaToken = await (window as any).grecaptcha.execute(siteKey, { action: 'submit' });
					console.log('reCAPTCHA token generated for security logging');
				} catch (error) {
					console.warn('reCAPTCHA failed, continuing without it:', error);
				}
			}

			// Create FormData for Web3Forms (FREE PLAN - NO RECAPTCHA)
			const formData = new FormData();
			
			// Web3Forms required fields
			formData.append('access_key', web3formsAccessKey);
			formData.append('subject', `New Interest Form - ${nameClean}`);
			formData.append('from_name', nameClean);
			formData.append('email', emailClean);
			
			// Web3Forms bot protection (required for free plan)
			formData.append('botcheck', '');
			
			// Custom fields
			formData.append('name', nameClean);
			formData.append('pitched_before', pitchedBefore ?? '');
			formData.append('interest', interest ?? '');
			formData.append('message', message?.trim() || 'No additional message');
			formData.append('event_year', nextEvent.year.toString());
			formData.append('event_quarter', nextEvent.displayQuarter);
			
			// NOTE: NO reCAPTCHA field sent to Web3Forms (Pro feature)
			// reCAPTCHA token generated above for potential future use/logging only

			const res = await fetch('https://api.web3forms.com/submit', {
				method: 'POST',
				headers: {
					'Accept': 'application/json'
				},
				body: formData
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const result = await res.json();

			if (result.success) {
				submitted = 'success';
				view = 'register'; // Switch to registration tab on success
				
				// Clear form
				name = '';
				email = '';
				interest = null;
				message = '';
				consent = false;
				step = 0;
			} else {
				// Handle Web3Forms specific error messages
				if (result.message) {
					formError = result.message;
				} else if (result.errors && Array.isArray(result.errors)) {
					formError = result.errors.join(', ');
				} else {
					formError = 'Submission failed. Please try again later.';
				}
				submitted = 'error';
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			if (error instanceof TypeError && error.message.includes('fetch')) {
				formError = 'Network error. Please check your connection and try again.';
			} else if (error instanceof Error) {
				formError = `Error: ${error.message}`;
			} else {
				formError = 'An unexpected error occurred. Please try again.';
			}
			submitted = 'error';
		}
	}

	onMount(() => {
		try {
			if (typeof window !== 'undefined') {
				const qs = new URLSearchParams(window.location.search);
				if (qs.has('debug')) DBG_ENABLED = true;
			}
		} catch {}

		// --- reCAPTCHA v3 Script Loader ---
		if (siteKey && typeof window !== 'undefined' && !document.getElementById('recaptcha-script')) {
			const script = document.createElement('script');
			script.id = 'recaptcha-script';
			script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
			script.async = true;
			script.defer = true;
			script.onload = () => {
				(window as any).grecaptcha.ready(() => {
					recaptchaReady = true;
				});
			};
			script.onerror = () => {
				console.error('Failed to load reCAPTCHA script.');
				formError = 'Could not load reCAPTCHA. Please check your connection.';
			};
			document.head.appendChild(script);
		}

		// Initialize floating circles
		initCircles();
		startAnimation();
		mountedLM = true;

		// Cleanup animation on destroy
		return () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
		};
	});

	// Ensure autofilled values are synced on the Details step
	$: if (step === 2) {
		if (nameInputEl && name !== nameInputEl.value) name = nameInputEl.value;
		if (emailInputEl && email !== emailInputEl.value) email = emailInputEl.value;
	}
</script>

<svelte:head>
	<title>Learn More - Liffey FC</title>
	<meta name="description" content="Learn more about our events and register your interest." />
	<meta name="web3forms-access-key" content="c6083f7c-0367-4417-be5e-9e2ca45fcac8" />
	<link rel="canonical" href="https://liffeyfoundersclub.com/learnMore" />
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
					<h1
						class="text-primary text-3xl font-bold md:text-5xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
					>
						Learn More
					</h1>
				</div>
				<p class="text-base-content/90 mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
					Connect with founders, investors, and the community in our quarterly events.
				</p>
			</div>

			<div class="glass glass-learn-more overflow-hidden rounded-3xl backdrop-blur-xl">
				<div class="p-4 md:p-6 lg:p-8 backdrop-blur-sm">
					<div class="flex justify-center">
						<div
							role="tablist"
							class="tabs tabs-boxed bg-transparent border-0 backdrop-blur-md rounded-3xl p-1 mb-4 md:mb-6"
						>
							<button
								role="tab"
								class="tab h-10 md:h-12 text-xs md:text-sm lg:text-base font-medium transition-all duration-300 rounded-2xl btn-neon-subtle {view ===
								'about'
									? 'glass-subtle text-primary shadow-md'
									: 'text-base-content/70 hover:text-base-content hover:bg-white/5'}"
								on:click={() => (view = 'about')}
							>
								About Events
							</button>
							<button
								role="tab"
								class="tab h-10 md:h-12 text-xs md:text-sm lg:text-base font-medium transition-all duration-300 rounded-2xl btn-neon-subtle {view ===
								'interest'
									? 'glass-subtle text-primary shadow-md'
									: 'text-base-content/70 hover:text-base-content hover:bg-white/5'}"
								on:click={() => (view = 'interest')}
							>
								Register Interest
							</button>
							<button
								role="tab"
								class="tab h-10 md:h-12 text-xs md:text-sm lg:text-base font-medium transition-all duration-300 rounded-2xl btn-neon-subtle {view ===
								'register'
									? 'glass-subtle text-primary shadow-md'
									: 'text-base-content/70 hover:text-base-content hover:bg-white/5'}"
								on:click={() => (view = 'register')}
							>
								Event Registration
							</button>
						</div>
					</div>
				</div>

				<div class="p-4 pt-0 md:p-6 md:pt-0 lg:p-8 lg:pt-0">
					<div class="relative overflow-hidden">
						<div class="grid grid-cols-1 grid-rows-1">
							{#if view === 'about'}
								<div
									class="col-start-1 row-start-1 glass-learn-more rounded-3xl p-4 md:p-6 lg:p-8 backdrop-blur-md"
									out:outView={{ key: 'lm-view' }}
									in:inView={{ key: 'lm-view' }}
								>
									<div class="text-center mb-6 md:mb-8">
										<h2
											class="text-base-content text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-base-content to-base-content/80 bg-clip-text mb-3 md:mb-4"
										>
											Quarterly Startup Events
										</h2>
										<p
											class="text-sm md:text-base lg:text-lg text-base-content/80 max-w-2xl mx-auto leading-relaxed"
										>
											Join Dublin's most exciting entrepreneurial community for networking, pitching, and
											learning opportunities.
										</p>
									</div>

									<div class="grid gap-4 md:gap-6 lg:gap-8 md:grid-cols-2 mb-6 md:mb-8">
										<div class="glass-subtle rounded-2xl p-4 md:p-6 backdrop-blur-sm">
											<div class="flex items-center gap-3 mb-3">
												<div
													class="w-8 h-8 md:w-10 md:h-10 bg-primary/20 rounded-full flex items-center justify-center"
												>
													<ArrowLeftRight class="w-4 h-4 md:w-5 md:h-5 text-primary" />
												</div>
												<h4 class="text-base md:text-lg font-semibold text-base-content">
													Pitch Your Business
												</h4>
											</div>
											<p class="text-sm md:text-base text-base-content/80 leading-relaxed">
												Present your business idea to investors, mentors, and fellow entrepreneurs in a
												supportive environment.
											</p>
										</div>

										<div class="glass-subtle rounded-2xl p-4 md:p-6 backdrop-blur-sm">
											<div class="flex items-center gap-3 mb-3">
												<div
													class="w-8 h-8 md:w-10 md:h-10 bg-accent/20 rounded-full flex items-center justify-center"
												>
													<BadgeDollarSign class="w-4 h-4 md:w-5 md:h-5 text-accent" />
												</div>
												<h4 class="text-base md:text-lg font-semibold text-base-content">
													Connect with Investors
												</h4>
											</div>
											<p class="text-sm md:text-base text-base-content/80 leading-relaxed">
												Meet angel investors and VCs looking for the next big opportunity in Dublin's
												startup scene.
											</p>
										</div>

										<div class="glass-subtle rounded-2xl p-4 md:p-6 backdrop-blur-sm">
											<div class="flex items-center gap-3 mb-3">
												<div
													class="w-8 h-8 md:w-10 md:h-10 bg-success/20 rounded-full flex items-center justify-center"
												>
													<MapPin class="w-4 h-4 md:w-5 md:h-5 text-success" />
												</div>
												<h4 class="text-base md:text-lg font-semibold text-base-content">
													Community Building
												</h4>
											</div>
											<p class="text-sm md:text-base text-base-content/80 leading-relaxed">
												Join a thriving community of founders, entrepreneurs, and innovators in Dublin.
											</p>
										</div>

										<div class="glass-subtle rounded-2xl p-4 md:p-6 backdrop-blur-sm">
											<div class="flex items-center gap-3 mb-3">
												<div
													class="w-8 h-8 md:w-10 md:h-10 bg-warning/20 rounded-full flex items-center justify-center"
												>
													<Clock class="w-4 h-4 md:w-5 md:h-5 text-warning" />
												</div>
												<h4 class="text-base md:text-lg font-semibold text-base-content">
													Regular Events
												</h4>
											</div>
											<p class="text-sm md:text-base text-base-content/80 leading-relaxed">
												Quarterly events ensure consistent networking and growth opportunities throughout
												the year.
											</p>
										</div>
									</div>

									<div class="text-center">
										<button
											class="btn btn-primary btn-neon-adaptive px-6 py-3 md:px-8 md:py-4 text-sm md:text-base font-medium rounded-full"
											on:click={() => (view = 'interest')}
										>
											Get Started →
										</button>
									</div>
								</div>
							{:else if view === 'interest'}
								<div
									class="col-start-1 row-start-1 glass-learn-more rounded-3xl p-4 md:p-8 backdrop-blur-md"
									out:outView={{ key: 'lm-view' }}
									in:inView={{ key: 'lm-view' }}
								>
									<div class="text-center mb-6">
										<div
											class="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2 mb-4"
										>
											<span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
											<span class="text-sm font-medium text-base-content/80"
												>Step {step + 1} of 5</span
											>
										</div>
										<h2
											class="text-base-content text-xl font-bold md:text-2xl bg-gradient-to-r from-base-content to-base-content/80 bg-clip-text"
										>
											Register your interest
										</h2>
									</div>

									<form on:submit|preventDefault={submitForm} class="space-y-6">
										<div class="glass-subtle rounded-2xl p-4 backdrop-blur-sm">
											<div class="flex justify-center">
												<div class="overflow-x-auto">
													<ul
														class="steps w-max md:w-full mb-2 text-base-content text-xs md:text-sm whitespace-nowrap"
													>
														<li class="step {step >= 0 ? 'step-primary' : 'step-base-300'}">Start</li>
														<li class="step {step >= 1 ? 'step-primary' : 'step-base-300'}">
															Interest
														</li>
														<li class="step {step >= 2 ? 'step-primary' : 'step-base-300'}">
															Details
														</li>
														<li class="step {step >= 3 ? 'step-primary' : 'step-base-300'}">
															Message
														</li>
														<li class="step {step >= 4 ? 'step-primary' : 'step-base-300'}">
															Consent
														</li>
													</ul>
												</div>
											</div>
										</div>

										<div
											class="glass-subtle rounded-2xl p-6 backdrop-blur-sm min-h-[280px] flex items-center justify-center"
										>
											{#key step}
												<div
													class="absolute inset-6 flex items-center justify-center"
													out:outStep
													in:inStep
												>
													{#if step === 0}
														<div class="text-center w-full">
															<div class="glass-subtle rounded-3xl p-6 mb-4 inline-block">
																<h3
																	class="text-base-content mb-4 text-lg font-semibold md:text-xl"
																>
																	Have you pitched before?
																</h3>
																<div class="join join-vertical md:join-horizontal">
																	<button
																		type="button"
																		class="btn join-item btn-neon-subtle transition-all duration-300 border-0 {pitchedBefore ===
																		'Yes'
																			? 'btn-primary shadow-lg scale-105'
																			: 'glass-subtle hover:scale-102'}"
																		on:click={() => {
																			pitchedBefore = 'Yes';
																			next();
																		}}>Yes</button
																	>
																	<button
																		type="button"
																		class="btn join-item btn-neon-subtle transition-all duration-300 border-0 {pitchedBefore ===
																		'No'
																			? 'btn-primary shadow-lg scale-105'
																			: 'glass-subtle hover:scale-102'}"
																		on:click={() => {
																			pitchedBefore = 'No';
																			next();
																		}}>No</button
																	>
																</div>
															</div>
														</div>
													{:else if step === 1}
														<div>
															<h3
																class="text-base-content mb-3 text-center text-lg font-semibold md:text-xl"
															>
																What are you interested in?
															</h3>
															<div class="flex flex-wrap justify-center gap-2 md:gap-3">
																{#each interests as opt}
																	<button
																		type="button"
																		class="btn btn-neon-subtle {interest === opt
																			? 'btn-primary'
																			: 'btn-outline btn-base-300'}"
																		on:click={() => {
																			interest = opt;
																			next();
																		}}>{opt}</button
																	>
																{/each}
															</div>
														</div>
													{:else if step === 2}
														<div>
															<h3
																class="text-base-content mb-3 text-center text-lg font-semibold md:text-xl"
															>
																Your details
															</h3>
															<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
																<label class="form-control">
																	<div class="label">
																		<span class="label-text text-base-content/80">Full name</span>
																	</div>
																	<input
																		class="input input-bordered"
																		bind:value={name}
																		bind:this={nameInputEl}
																		placeholder="Jane Doe"
																		required
																		autocomplete="name"
																	/>
																	{#if showStep2Errors && !step2NameOk}
																		<span class="text-error mt-1 text-xs"
																			>Full name is required.</span
																		>
																	{/if}
																	{#if fieldErrors.name}
																		<span class="text-error mt-1 text-xs">{fieldErrors.name}</span>
																	{/if}
																</label>
																<label class="form-control">
																	<div class="label">
																		<span class="label-text text-base-content/80">Email</span>
																	</div>
																	<input
																		type="email"
																		class="input input-bordered"
																		bind:value={email}
																		bind:this={emailInputEl}
																		placeholder="you@example.com"
																		required
																		autocomplete="email"
																	/>
																	{#if (email && !emailValid) || (showStep2Errors && !step2EmailOk)}
																		<span class="text-error mt-1 text-xs"
																			>Enter a valid email address.</span
																		>
																	{/if}
																	{#if fieldErrors.email}
																		<span class="text-error mt-1 text-xs">{fieldErrors.email}</span>
																	{/if}
																</label>
															</div>
														</div>
													{:else if step === 3}
														<div>
															<h3
																class="text-base-content mb-3 text-center text-lg font-semibold md:text-xl"
															>
																Message (optional)
															</h3>
															<div class="mx-auto w-full max-w-xl">
																<label class="form-control">
																	<textarea
																		class="textarea textarea-bordered min-h-28 w-full"
																		bind:value={message}
																		placeholder="Tell us a little about what you're looking for..."
																	></textarea>
																</label>
															</div>
														</div>
													{:else if step === 4}
														<div class="text-center w-full max-w-md mx-auto px-4">
															<h3
																class="text-base-content mb-6 text-center text-lg font-semibold md:text-xl"
															>
																Consent & Verification
															</h3>
															
															<!-- Mobile-optimized consent checkbox -->
															<div class="glass-subtle rounded-2xl p-4 md:p-6 mb-6 text-left">
																<label class="flex items-start gap-3 cursor-pointer">
																	<input
																		type="checkbox"
																		class="checkbox checkbox-accent flex-shrink-0 mt-1"
																		bind:checked={consent}
																		required
																	/>
																	<div class="flex-1">
																		<span class="text-base-content text-sm md:text-base leading-relaxed block">
																			I agree to be contacted about upcoming quarterly events and startup community updates.
																		</span>
																		<span class="text-base-content/60 text-xs mt-2 block">
																			You can unsubscribe at any time. We respect your privacy.
																		</span>
																	</div>
																</label>
															</div>
															
															<!-- reCAPTCHA info - now optional -->
															<div class="text-xs text-base-content/50 leading-relaxed px-2">
																{#if siteKey && recaptchaReady}
																	<p class="mb-2">🔒 Enhanced with reCAPTCHA protection</p>
																{:else}
																	<p class="mb-2">🔒 Form secured with basic validation</p>
																{/if}
																<p>
																	Powered by 
																	<a href="https://web3forms.com" class="link link-hover" target="_blank" rel="noopener">Web3Forms</a>
																	• 
																	<a href="https://policies.google.com/privacy" class="link link-hover">Google Privacy Policy</a>
																</p>
															</div>
															
															{#if fieldErrors.consent}
																<div class="alert alert-error mt-4 text-sm">
																	<AlertTriangle class="h-4 w-4" />
																	<span>{fieldErrors.consent}</span>
																</div>
															{/if}
														</div>
													{/if}
												</div>
											{/key}
										</div>

										{#if formError}
											<div class="alert alert-error glass-subtle backdrop-blur-md rounded-2xl border-0">
												<AlertTriangle class="h-6 w-6" />
												<span class="text-sm">{formError}</span>
											</div>
										{/if}

										<!-- Mobile-Friendly Form Navigation -->
										<div class="mt-6 grid grid-cols-2 gap-4">
											<button
												type="button"
												class="btn btn-outline btn-base-300 btn-neon-subtle"
												on:click={prev}
												disabled={step === 0 || submitted === 'submitting'}>Back</button
											>
											{#if step < 4}
												<button
													type="button"
													class="btn btn-neon-subtle {buttonCanNext
														? 'btn-primary'
														: 'btn-disabled'}"
													on:click={handleNext}
													disabled={!buttonCanNext || submitted === 'submitting'}
												>
													Next
												</button>
											{:else}
												<button
													type="submit"
													class="btn btn-primary btn-neon-accent"
													disabled={!consent || submitted === 'submitting'}
												>
													{#if submitted === 'submitting'}
														<span class="loading loading-spinner"></span>
														Submitting...
													{:else}
														Submit
													{/if}
												</button>
											{/if}
										</div>
									</form>
								</div>
							{:else if view === 'register'}
								<div
									class="col-start-1 row-start-1 glass-learn-more rounded-3xl p-6 md:p-8 backdrop-blur-md"
									out:outView={{ key: 'lm-view' }}
									in:inView={{ key: 'lm-view' }}
								>
									{#if submitted === 'success'}
										<div
											class="alert alert-success mb-6 shadow-lg glass-subtle backdrop-blur-md rounded-2xl border-0"
										>
											<CheckCircle2 class="h-6 w-6 shrink-0 stroke-current text-success" />
											<div class="flex-1">
												<h3 class="font-bold text-success-content text-lg mb-2">Welcome to Liffey Founders Club!</h3>
												<div class="text-sm text-success-content/90 space-y-2">
													<p class="font-medium">Registration confirmed for {nextEvent.displayQuarter} {nextEvent.year}</p>
													<div class="text-xs space-y-1">
														<p>✅ Your information has been submitted successfully</p>
														<p>📧 We'll contact you soon with event details and agenda</p>
														<p>🌟 Join Dublin's premier startup community networking event</p>
														<p class="font-medium mt-2">Next steps: Check your email for updates from our team</p>
													</div>
												</div>
											</div>
										</div>
									{/if}
									<div class="text-center mb-6">
										<div class="glass-subtle rounded-full px-6 py-3 inline-block mb-4">
											<h3
												class="text-base-content text-xl font-bold md:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
											>
												Event Registration
											</h3>
										</div>
									</div>

									<div class="glass-subtle mb-8 rounded-2xl p-6 md:p-8 backdrop-blur-md">
										<div class="flex items-center justify-center mb-6">
											<div
												class="glass-subtle rounded-full px-4 py-2 inline-flex items-center gap-2"
											>
												<span class="w-3 h-3 bg-accent rounded-full animate-pulse"></span>
												<h3 class="text-lg font-bold md:text-xl text-accent">
													Next Event: {nextEvent.displayQuarter} {nextEvent.year}
												</h3>
											</div>
										</div>
										<div class="grid grid-cols-1 gap-4 text-sm text-base-content md:grid-cols-2">
											<div
												class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm"
											>
												<CalendarDays class="text-accent h-6 w-6 flex-shrink-0" />
												<div><span class="font-semibold">Date:</span> {nextEvent.nextEventDate}</div>
											</div>
											<div
												class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm"
											>
												<Clock class="text-accent h-6 w-6 flex-shrink-0" />
												<div><span class="font-semibold">Time:</span> Evening Session</div>
											</div>
											<div
												class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm"
											>
												<MapPin class="text-accent h-6 w-6 flex-shrink-0" />
												<div><span class="font-semibold">Location:</span> Dublin, Ireland</div>
											</div>
											<div
												class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm"
											>
												<BadgeDollarSign class="text-accent h-6 w-6 flex-shrink-0" />
												<div><span class="font-semibold">Cost:</span> Free Event</div>
											</div>
										</div>
									</div>

									<div class="flex justify-center">
										<a
											href="https://lu.ma/event/evt-Hs6RP2j7Bkc8jGQ"
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
							{/if}
						</div>
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