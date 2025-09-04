<script lang="ts">
	import { makeCrossfade, dur, noIntro, routeOpacity, crossEase } from '$lib/transitions';
	import { fade } from 'svelte/transition';
	import {
		CheckCircle2,
		AlertTriangle,
		ArrowLeftRight,
		CalendarDays,
		Clock,
		MapPin,
		BadgeDollarSign,
		ExternalLink
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { env as publicEnv } from '$env/dynamic/public';
	import { goto } from '$app/navigation';

	// Dev logger (visible by default in dev; can force with ?debug=1 or PUBLIC_DEBUG_LOGS=1)
	let DBG_ENABLED = Boolean(import.meta.env?.DEV) || publicEnv.PUBLIC_DEBUG_LOGS === '1';
	const dbg = (...args: any[]) => {
		if (DBG_ENABLED) console.log('[learnMore]', ...args);
	};

	let submitted: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	let step = 0;
	let view: 'interest' | 'register' = 'interest';

	const interests = ['Attending', 'Pitching my business', 'Investing / Partnering'];
	let name = '';
	let email = '';
	let interest: string | null = null;
	let message = '';
	let consent = false;
	let recaptchaToken: string = '';
	let formError = '';
	let fieldErrors: Record<string, string> = {};
	let recaptchaWidgetId: number | null = null;
	let recaptchaEl: HTMLDivElement | null = null;
	let recaptchaRenderAttempts = 0;
	let recaptchaSize: 'compact' | 'normal' = 'normal';
	let nameInputEl: HTMLInputElement | null = null;
	let emailInputEl: HTMLInputElement | null = null;
	let showStep2Errors = false;
	let mountedLM = false;
	// Crossfade between Interest and Registration views to avoid jitter
	// Slightly longer duration for extra smoothness
	const [send, receive] = makeCrossfade(() => mountedLM, {
		duration: dur.crossfade + 120,
		fallbackDuration: dur.fast
	});
	// Local route-style fade when navigating away via the back button
	let showLM = true;
	let navTarget: string | null = null;
	function backToPitch(e: Event) {
		e.preventDefault();
		navTarget = '/pitch';
		showLM = false;
	}
	// Prevent any intro transition pre-mount
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

	type YesNo = 'Yes' | 'No' | null;
	let pitchedBefore: YesNo = null;

	// Derived fields and validation helpers
	$: nameClean = name.trim();
	$: emailClean = email.trim();
	$: emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailClean);

	// Dynamic floating circles
	interface Circle {
		id: number;
		x: number;
		y: number;
		size: number;
		animationDelay: number;
		dx: number;
		dy: number;
	}

	let circles: Circle[] = [];
	let animationFrame: number;

	function generateRandomCircles() {
		circles = Array.from({ length: 6 }, (_, i) => ({
			id: i,
			x: Math.random() * 80 + 10, // 10-90% to avoid edges
			y: Math.random() * 80 + 10,
			size: Math.random() * 20 + 10, // 10-30px sizes
			animationDelay: Math.random() * 4,
			dx: (Math.random() - 0.5) * 0.02, // Slow movement speed
			dy: (Math.random() - 0.5) * 0.02
		}));
	}

	function animateCircles() {
		circles = circles.map(circle => {
			let newX = circle.x + circle.dx;
			let newY = circle.y + circle.dy;

			// Bounce off edges
			if (newX <= 5 || newX >= 95) {
				circle.dx *= -1;
				newX = Math.max(5, Math.min(95, newX));
			}
			if (newY <= 5 || newY >= 95) {
				circle.dy *= -1;
				newY = Math.max(5, Math.min(95, newY));
			}

			return {
				...circle,
				x: newX,
				y: newY
			};
		});

		animationFrame = requestAnimationFrame(animateCircles);
	}
	$: step2NameOk = nameClean.length >= 2;
	$: step2EmailOk = emailValid;

	// reCAPTCHA v2 helpers (lazy-load script when needed)
	if (typeof window !== 'undefined') {
		const w = window as any;
		w.recaptchaCallback = (token: string) => {
			recaptchaToken = token;
			dbg('reCAPTCHA success; token length:', token?.length ?? 0);
		};
		w.recaptchaExpired = () => {
			recaptchaToken = '';
			dbg('reCAPTCHA expired');
		};
		w.recaptchaError = () => {
			console.error('reCAPTCHA error');
			recaptchaToken = '';
			dbg('reCAPTCHA error callback');
		};
	}

	let recaptchaScriptPromise: Promise<void> | null = null;
	function loadRecaptchaScript(): Promise<void> {
		if (typeof window === 'undefined' || !RECAPTCHA_SITE_KEY) return Promise.resolve();
		if ((window as any).grecaptcha) return Promise.resolve();
		if (recaptchaScriptPromise) return recaptchaScriptPromise;
		dbg('Loading reCAPTCHA script lazily');
		recaptchaScriptPromise = new Promise((resolve, reject) => {
			try {
				const s = document.createElement('script');
				s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
				s.async = true;
				s.defer = true;
				s.onload = () => {
					dbg('reCAPTCHA script loaded');
					resolve();
				};
				s.onerror = (e) => {
					console.error('Failed to load reCAPTCHA script', e);
					reject(e);
				};
				document.head.appendChild(s);
			} catch (e) {
				reject(e as any);
			}
		});
		return recaptchaScriptPromise;
	}

	// Compute the event's year and quarter (align with header logic)
	const now = new Date();
	const eventYear = now.getFullYear();
	const eventQuarter = now.getMonth() >= 6 ? 3 : 2; // mirrors the header display

	function next() {
		if (step < 4) step += 1;
	}
	function prev() {
		if (step > 0) step -= 1;
	}
	function canNext() {
		if (step === 0) return pitchedBefore !== null;
		if (step === 1) return !!interest;
		if (step === 2) {
			return step2NameOk && step2EmailOk;
		}
		if (step === 3) return true; // message optional
		return false;
	}

	function handleNext() {
		dbg('handleNext', { step, canNext: canNext() });
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

	const RECAPTCHA_SITE_KEY = publicEnv.PUBLIC_RECAPTCHA_SITE_KEY || '';

	function tryRenderRecaptcha() {
		if (!RECAPTCHA_SITE_KEY) {
			dbg('Skip reCAPTCHA render: no site key');
			return;
		}
		if (typeof window === 'undefined') {
			dbg('Skip reCAPTCHA render: no window');
			return;
		}
		const w = window as any;
		if (!recaptchaEl) {
			dbg('Skip reCAPTCHA render: element not mounted yet');
			return;
		}
		if (!w.grecaptcha || typeof w.grecaptcha.render !== 'function') {
			dbg('Skip reCAPTCHA render: grecaptcha not ready');
			return;
		}
		if (recaptchaWidgetId !== null) {
			dbg('Skip reCAPTCHA render: already rendered');
			return;
		}

		try {
			dbg('Rendering reCAPTCHA', { haveEl: !!recaptchaEl, widgetId: recaptchaWidgetId, step });
			recaptchaWidgetId = w.grecaptcha.render(recaptchaEl, {
				sitekey: RECAPTCHA_SITE_KEY,
				size: recaptchaSize,
				callback: (window as any).recaptchaCallback,
				'expired-callback': (window as any).recaptchaExpired,
				'error-callback': (window as any).recaptchaError
			});
			dbg('reCAPTCHA rendered; widgetId:', recaptchaWidgetId);
		} catch (e) {
			console.error('Failed to render reCAPTCHA:', e);
			dbg('Failed to render reCAPTCHA', e);
		}
	}

	async function scheduleRecaptchaRender() {
		if (step !== 4) {
			dbg('Not scheduling reCAPTCHA render: not on consent step');
			return;
		}
		await loadRecaptchaScript().catch(() => {});
		try {
			if (typeof window !== 'undefined') {
				recaptchaSize = window.innerWidth < 420 ? 'compact' : 'normal';
				dbg('recaptcha size chosen:', recaptchaSize);
			}
		} catch {}
		recaptchaRenderAttempts = 0;
		const max = 40; // ~10 seconds at 250ms
		const poll = () => {
			const w = typeof window !== 'undefined' ? (window as any) : null;
			if (!RECAPTCHA_SITE_KEY) return dbg('Render wait: no site key');
			if (!w) return dbg('Render wait: no window');
			if (!recaptchaEl) {
				if (recaptchaRenderAttempts++ < max) return setTimeout(poll, 250);
				return dbg('Render give up: element not mounted');
			}
			if (!w.grecaptcha || typeof w.grecaptcha.render !== 'function') {
				if (recaptchaRenderAttempts++ < max) return setTimeout(poll, 250);
				return dbg('Render give up: grecaptcha not ready');
			}
			if (recaptchaWidgetId !== null) return dbg('Render skipped: already rendered');
			tryRenderRecaptcha();
		};
		setTimeout(poll, 0);
	}

	onMount(() => {
		try {
			if (typeof window !== 'undefined') {
				const qs = new URLSearchParams(window.location.search);
				if (qs.has('debug')) DBG_ENABLED = true;
			}
		} catch {}
		dbg('debug init', {
			DEV: import.meta.env?.DEV,
			PUBLIC_DEBUG_LOGS: publicEnv.PUBLIC_DEBUG_LOGS,
			enabled: DBG_ENABLED
		});
		// Initialize floating circles
		generateRandomCircles();
		animateCircles();
		// Render will be scheduled reactively when step === 4
		mountedLM = true;

		// Cleanup animation on destroy
		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
		};
	});

	// Re-attempt render when reaching step 4
	$: if (step === 4) {
		dbg('Entered step 4; tryRenderRecaptcha');
		scheduleRecaptchaRender();
	}

	// Ensure autofilled values are synced on the Details step so Next can enable
	$: if (step === 2) {
		if (nameInputEl && name !== nameInputEl.value) name = nameInputEl.value;
		if (emailInputEl && email !== emailInputEl.value) email = emailInputEl.value;
	}

	async function submitForm() {
		if (!consent) return;
		submitted = 'submitting';
		formError = '';

		try {
			dbg('Submit start', {
				nameLen: name?.length ?? 0,
				emailLen: email?.length ?? 0,
				pitchedBefore,
				interest,
				msgLen: message?.length ?? 0,
				haveToken: !!recaptchaToken
			});
			if (!RECAPTCHA_SITE_KEY) {
				submitted = 'idle';
				formError = 'reCAPTCHA is not configured. Please set PUBLIC_RECAPTCHA_SITE_KEY.';
				dbg('Missing PUBLIC_RECAPTCHA_SITE_KEY');
				return;
			}

			// Ensure v2 checkbox was solved (with fallbacks)
			if (!recaptchaToken) {
				let fallbackToken = '';
				if (typeof window !== 'undefined' && (window as any).grecaptcha?.getResponse) {
					try {
						fallbackToken = (window as any).grecaptcha.getResponse() || '';
					} catch {}
				}
				if (!fallbackToken) {
					const ta = document.querySelector(
						'textarea[name="g-recaptcha-response"]'
					) as HTMLTextAreaElement | null;
					fallbackToken = ta?.value?.trim() || '';
				}
				if (fallbackToken) {
					recaptchaToken = fallbackToken;
					dbg('Using fallback reCAPTCHA token; len:', fallbackToken.length);
				} else {
					submitted = 'idle';
					formError = 'Please complete the reCAPTCHA to enable submission.';
					dbg('No reCAPTCHA token available at submit');
					return;
				}
			}

			const payload = {
				name,
				email,
				pitchedBefore,
				interest,
				message,
				event_year: eventYear,
				event_quarter: `Q${eventQuarter}`,
				consent,
				recaptchaToken
			};

			// On static Apache hosting this is served by PHP relay at /api/interest/submit/
			const res = await fetch('/api/interest/submit/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			dbg('Response status:', res.status);
			if (res.ok) {
				submitted = 'success';
				fieldErrors = {};
				// After successful submission, show the Event Registration section
				view = 'register';
			} else {
				const text = await res.text().catch(() => '');
				let err: any = {};
				try {
					err = text ? JSON.parse(text) : {};
				} catch {
					err = { raw: text };
				}
				dbg('Submission failed body:', err);
				if (err?.error === 'validation_failed' && err?.errors) {
					fieldErrors = err.errors;
					formError = 'Please correct the highlighted fields.';
					// Navigate back to the earliest step with an error
					if (fieldErrors.pitchedBefore) step = 0;
					else if (fieldErrors.interest) step = 1;
					else if (fieldErrors.name || fieldErrors.email) step = 2;
					else if (fieldErrors.message) step = 3;
					else if (fieldErrors.consent) step = 4;
				} else if (err?.error === 'missing_web3forms_key') {
					formError = 'Server email service is not configured. Please try again later.';
				} else if (err?.error === 'recaptcha_verification_failed') {
					formError = 'reCAPTCHA verification failed. Please retry.';
				} else {
					console.error('Submission failed:', err);
					formError = 'Submission failed. Please try again later.';
				}
				submitted = 'error';
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			dbg('Submit exception', error);
			submitted = 'error';
		} finally {
			// Reset the widget for potential resubmission
			if (typeof window !== 'undefined' && (window as any).grecaptcha) {
				try {
					if (recaptchaWidgetId !== null) {
						(window as any).grecaptcha.reset(recaptchaWidgetId);
					} else {
						(window as any).grecaptcha.reset();
					}
				} catch {}
			}
			dbg('Submit finished; grecaptcha.reset attempted');
			recaptchaToken = '';
		}
	}
</script>

<svelte:head>
	<title>Learn More - Liffey FC</title>
	<meta name="description" content="Learn more about our events and register your interest." />
	<!-- reCAPTCHA script is now lazy-loaded when reaching Consent (Step 4) -->
</svelte:head>

{#if showLM}
	<section
		class="flex min-h-screen items-center justify-center px-3 py-10 md:px-4 md:py-16 relative overflow-hidden"
		out:routeOpacity
		on:outroend={() => {
			if (navTarget) goto(navTarget);
		}}
	>
		<!-- Floating background elements for depth -->
		<div class="absolute inset-0 pointer-events-none opacity-40">
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
					"
				></div>
			{/each}
		</div>

		<div class="w-full max-w-4xl relative z-10">
			<div class="mb-8 text-center md:mb-12">
				<div class="glass-subtle rounded-3xl px-6 py-4 md:px-8 md:py-6 inline-block mb-4">
					<h1 class="text-primary text-3xl font-bold md:text-5xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Learn More</h1>
				</div>
				<p class="text-base-content/90 mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
					Connect with founders, investors, and the community in our quarterly events.
				</p>
			</div>

			<div class="glass glass-learn-more overflow-hidden rounded-3xl backdrop-blur-xl"
			>
				<div class="p-6 md:p-10 backdrop-blur-sm">
					<div role="tablist" class="tabs tabs-boxed bg-transparent border-0 backdrop-blur-md rounded-3xl p-1">
						<button
							role="tab"
							class="tab h-12 text-sm md:text-base font-medium transition-all duration-300 rounded-2xl btn-neon-subtle {view === 'interest' ? 'glass-subtle text-primary shadow-md' : 'text-base-content/70 hover:text-base-content hover:bg-white/5'}"
							on:click={() => (view = 'interest')}
						>
							Register Interest
						</button>
						<button
							role="tab"
							class="tab h-12 text-sm md:text-base font-medium transition-all duration-300 rounded-2xl btn-neon-subtle {view === 'register' ? 'glass-subtle text-primary shadow-md' : 'text-base-content/70 hover:text-base-content hover:bg-white/5'}"
							on:click={() => (view = 'register')}
						>
							Event Registration
						</button>
					</div>
				</div>

				<div class="p-6 pt-2 md:p-10 md:pt-4">
					<div class="relative overflow-hidden">
						<div class="grid grid-cols-1 grid-rows-1">
						{#if view === 'interest'}
							<div
								class="col-start-1 row-start-1 glass-learn-more rounded-3xl p-6 md:p-8 backdrop-blur-md"
								out:outView={{ key: 'lm-view' }}
								in:inView={{ key: 'lm-view' }}
							>
								<div class="text-center mb-6">
									<div class="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2 mb-4">
										<span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
										<span class="text-sm font-medium text-base-content/80">Step {step + 1} of 5</span>
									</div>
									<h2 class="text-base-content text-xl font-bold md:text-2xl bg-gradient-to-r from-base-content to-base-content/80 bg-clip-text">
										Register your interest
									</h2>
								</div>
								{#if submitted === 'success'}
									<div class="alert alert-success mb-6 shadow-lg glass-subtle backdrop-blur-md rounded-2xl border-0">
										<CheckCircle2 class="h-6 w-6 text-success" />
										<div>
											<h3 class="font-bold text-success-content">Thank you!</h3>
											<div class="text-sm text-success-content/80">
												Your submission has been received. We'll be in touch soon.
											</div>
										</div>
									</div>
								{:else if submitted === 'error'}
									<div class="alert alert-error mb-6 shadow-lg glass-subtle backdrop-blur-md rounded-2xl border-0">
										<AlertTriangle class="h-6 w-6 text-error" />
										<span class="text-error-content">Error! Task failed successfully. Please try again.</span>
									</div>
								{:else}
									<form on:submit|preventDefault={submitForm} class="space-y-6">
										<div class="glass-subtle rounded-2xl p-4 backdrop-blur-sm">
											<div class="overflow-x-auto -mx-2 px-2">
												<ul class="steps w-max md:w-full mb-2 text-base-content text-xs md:text-sm whitespace-nowrap">
													<li class="step {step >= 0 ? 'step-primary' : 'step-base-300'}">Start</li>
													<li class="step {step >= 1 ? 'step-primary' : 'step-base-300'}">Interest</li>
													<li class="step {step >= 2 ? 'step-primary' : 'step-base-300'}">Details</li>
													<li class="step {step >= 3 ? 'step-primary' : 'step-base-300'}">Message</li>
													<li class="step {step >= 4 ? 'step-primary' : 'step-base-300'}">Consent</li>
												</ul>
											</div>
										</div>

										<div class="glass-subtle rounded-2xl p-6 backdrop-blur-sm min-h-[280px] flex items-center justify-center">
											{#key step}
												<div class="absolute inset-6 flex items-center justify-center" out:outStep in:inStep>
													{#if step === 0}
														<div class="text-center w-full">
															<div class="glass-subtle rounded-3xl p-6 mb-4 inline-block">
																<h3 class="text-base-content mb-4 text-lg font-semibold md:text-xl">
																	Have you pitched before?
																</h3>
																<div class="join join-vertical md:join">
																	<button
																		type="button"
																		class="btn join-item btn-neon-subtle transition-all duration-300 border-0 {pitchedBefore === 'Yes'
																			? 'btn-primary shadow-lg scale-105'
																			: 'glass-subtle hover:scale-102'}"
																		on:click={() => {
																			pitchedBefore = 'Yes';
																			next();
																		}}>Yes</button
																	>
																	<button
																		type="button"
																		class="btn join-item btn-neon-subtle transition-all duration-300 border-0 {pitchedBefore === 'No'
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
																		placeholder="Tell us a little about what you’re looking for..."
																	></textarea>
																</label>
															</div>
														</div>
													{:else if step === 4}
														<div>
															<h3
																class="text-base-content mb-3 text-center text-lg font-semibold md:text-xl"
															>
																Consent
															</h3>
															{#if !RECAPTCHA_SITE_KEY}
																<div class="alert alert-warning mb-4 shadow">
																	<AlertTriangle class="h-6 w-6" />
																	<div>
																		<h3 class="font-bold">reCAPTCHA not configured</h3>
																		<div class="text-sm">
																			Set PUBLIC_RECAPTCHA_SITE_KEY in your environment to enable
																			submission.
																		</div>
																	</div>
																</div>
															{/if}
															<label
																class="label text-base-content/80 cursor-pointer justify-center gap-3 text-sm md:text-base"
															>
																<input
																	type="checkbox"
																	class="checkbox checkbox-accent"
																	bind:checked={consent}
																	required
																/>
																<span class="label-text text-base-content/80"
																	>I agree to be contacted about upcoming quarterly events.</span
																>
															</label>
															{#if RECAPTCHA_SITE_KEY}
																<div class="mt-4 flex justify-center">
																	<div
																		class="recaptcha-slot min-h-[78px]"
																		bind:this={recaptchaEl}
																	></div>
																</div>
																{#if formError}
																	<p class="text-error mt-2 text-center text-sm">{formError}</p>
																{/if}
															{/if}
															{#if fieldErrors.consent}
																<p class="text-error mt-2 text-center text-xs">
																	{fieldErrors.consent}
																</p>
															{/if}
														</div>
													{/if}
												</div>
											{/key}
										</div>

										<div class="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
											<button
												type="button"
												class="btn btn-outline btn-base-300 btn-neon-subtle w-full md:w-auto"
												on:click={prev}
												disabled={step === 0}>Back</button
											>
											{#if step < 4}
												<button
													type="button"
													class="btn btn-neon-subtle {canNext()
														? 'btn-primary'
														: 'btn-outline btn-base-300'} w-full md:w-auto"
													on:click={handleNext}
													disabled={submitted === 'submitting'}
												>
													Next
												</button>
											{:else}
												<button
													type="submit"
													class="btn btn-primary btn-neon-accent w-full md:w-auto"
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
								{/if}
							</div>
						{:else if view === 'register'}
							<div
								class="col-start-1 row-start-1 glass-learn-more rounded-3xl p-6 md:p-8 backdrop-blur-md"
								out:outView={{ key: 'lm-view' }}
								in:inView={{ key: 'lm-view' }}
							>
								{#if submitted === 'success'}
									<div class="alert alert-success mb-6 shadow-lg glass-subtle backdrop-blur-md rounded-2xl border-0">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-6 w-6 shrink-0 stroke-current text-success"
											fill="none"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
											/></svg
										>
										<div>
											<h3 class="font-bold text-success-content">Thank you!</h3>
											<div class="text-sm text-success-content/80">
												Your interest has been submitted. You can now register for the event below.
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
												Next Event: Q{eventQuarter} {eventYear}
											</h3>
										</div>
									</div>
									<div class="grid grid-cols-1 gap-4 text-sm text-base-content md:grid-cols-2">
										<div class="glass-subtle rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
											<CalendarDays class="text-accent h-6 w-6 flex-shrink-0" />
											<div><span class="font-semibold">Date:</span> 9th September</div>
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
