<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import { AlertTriangle, CheckCircle2, ChevronRight, User, Mail, MessageSquare, Shield } from 'lucide-svelte';
	import { getNextEvent } from '$lib/animations';

	let {
		onSuccess = () => {},
	}: {
		onSuccess?: () => void;
	} = $props();

	// Configuration
	const emailServerUrl = 'https://liffeyfcform-production.up.railway.app';
	const siteKey = PUBLIC_RECAPTCHA_SITE_KEY;
	const web3formsAccessKey = 'c6083f7c-0367-4417-be5e-9e2ca45fcac8';

	const nextEvent = getNextEvent();
	const interests = ['Attending', 'Pitching my business', 'Investing / Partnering'];

	// Form state
	let submitted = $state<'idle' | 'submitting' | 'success' | 'error'>('idle');
	let formError = $state('');
	let recaptchaReady = $state(false);

	// Field values
	let pitchedBefore: 'Yes' | 'No' | null = $state(null);
	let interest: string | null = $state(null);
	let name = $state('');
	let email = $state('');
	let message = $state('');
	let consent = $state(false);

	// Validation
	let nameClean = $derived(name.trim());
	let emailClean = $derived(email.trim());
	let emailValid = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailClean));
	let nameValid = $derived(nameClean.length >= 2);

	// Progress tracking — how far along the form is filled
	let progress = $derived.by(() => {
		let p = 0;
		if (pitchedBefore !== null) p += 1;
		if (interest !== null) p += 1;
		if (nameValid) p += 1;
		if (emailValid) p += 1;
		if (consent) p += 1;
		return p;
	});

	let canSubmit = $derived(
		pitchedBefore !== null &&
		interest !== null &&
		nameValid &&
		emailValid &&
		consent &&
		submitted !== 'submitting'
	);

	// Show validation errors only after attempting submit
	let showErrors = $state(false);

	// Section visibility — progressive reveal as you fill
	let showInterest = $derived(pitchedBefore !== null);
	let showDetails = $derived(showInterest && interest !== null);
	let showMessage = $derived(showDetails && nameValid && emailValid);
	let showConsent = $derived(showDetails); // Show consent alongside details

	// Auto-scroll into the next section
	function scrollIntoView(node: HTMLElement) {
		requestAnimationFrame(() => {
			node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		});
	}

	async function submitForm() {
		showErrors = true;
		if (!canSubmit) return;

		submitted = 'submitting';
		formError = '';

		try {
			let recaptchaToken = '';
			if (siteKey && recaptchaReady) {
				try {
					recaptchaToken = await (window as any).grecaptcha.execute(siteKey, { action: 'submit' });
				} catch {
					// Continue without reCAPTCHA
				}
			}

			const formData = new FormData();
			formData.append('access_key', web3formsAccessKey);
			formData.append('subject', `New Interest Form - ${nameClean}`);
			formData.append('from_name', nameClean);
			formData.append('email', emailClean);
			formData.append('botcheck', '');
			formData.append('name', nameClean);
			formData.append('pitched_before', pitchedBefore ?? '');
			formData.append('interest', interest ?? '');
			formData.append('message', message?.trim() || 'No additional message');
			formData.append('event_year', nextEvent.year.toString());
			formData.append('event_quarter', nextEvent.displayQuarter);

			const res = await fetch('https://api.web3forms.com/submit', {
				method: 'POST',
				headers: { 'Accept': 'application/json' },
				body: formData
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

			const result = await res.json();

			if (result.success) {
				submitted = 'success';

				// Fire-and-forget: send confirmation email to the submitter via the email server
				fetch(`${emailServerUrl}/send-welcome`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
					body: JSON.stringify({
						email: emailClean,
						name: nameClean,
						interest: interest ?? '',
						pitchedBefore: pitchedBefore ?? '',
						eventQuarter: nextEvent.displayQuarter,
						eventYear: nextEvent.year
					})
				}).catch(() => { /* silently ignore — admin already notified via Web3Forms */ });

				onSuccess();
			} else {
				formError = result.message || 'Submission failed. Please try again.';
				submitted = 'error';
			}
		} catch (error) {
			formError = error instanceof TypeError && error.message.includes('fetch')
				? 'Network error. Please check your connection.'
				: error instanceof Error ? error.message : 'An unexpected error occurred.';
			submitted = 'error';
		}
	}

	onMount(() => {
		if (siteKey && typeof window !== 'undefined' && !document.getElementById('recaptcha-script')) {
			const script = document.createElement('script');
			script.id = 'recaptcha-script';
			script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
			script.async = true;
			script.defer = true;
			script.onload = () => {
				(window as any).grecaptcha.ready(() => { recaptchaReady = true; });
			};
			document.head.appendChild(script);
		}
	});
</script>

<div class="space-y-4" in:fade={{ duration: 200 }}>
	<!-- Progress bar — hidden on success -->
	{#if submitted !== 'success'}
		<div class="glass-subtle rounded-full p-1">
			<div class="flex items-center gap-2 px-3 py-1.5">
				<span class="text-xs font-medium text-base-content/70 whitespace-nowrap">
					{progress}/5 completed
				</span>
				<div class="flex-1 bg-base-300/30 rounded-full h-2 overflow-hidden">
					<div
						class="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
						style="width: {(progress / 5) * 100}%"
					></div>
				</div>
				{#if progress === 5}
					<CheckCircle2 class="w-4 h-4 text-success flex-shrink-0" />
				{/if}
			</div>
		</div>
	{/if}

	{#if submitted === 'success'}
		<div
			class="glass-subtle rounded-2xl p-10 text-center"
			in:fly={{ y: 24, duration: 450, easing: quintOut }}
		>
			<!-- Animated check circle -->
			<div class="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6 ring-4 ring-success/20">
				<CheckCircle2 class="w-12 h-12 text-success" />
			</div>

			<h2 class="text-3xl font-bold text-base-content mb-2">You're In!</h2>
			<p class="text-primary font-semibold text-lg mb-5">Welcome to Liffey Founders Club</p>

			<p class="text-base-content/70 leading-relaxed mb-6 max-w-sm mx-auto">
				Your interest has been registered for our
				<strong class="text-base-content">{nextEvent.displayQuarter} {nextEvent.year}</strong> event.
				A confirmation email is on its way to you.
			</p>

			<!-- Event details card -->
			<div class="glass-subtle rounded-xl p-5 max-w-xs mx-auto mb-5">
				<p class="text-xs text-base-content/40 uppercase tracking-widest mb-2">Next Event</p>
				<p class="font-bold text-base-content text-lg mb-1">LFC Pitch Night</p>
				<p class="text-sm text-base-content/60 mb-3">{nextEvent.displayQuarter} {nextEvent.year} · Dublin City Centre</p>
				<div class="flex justify-center gap-3 flex-wrap">
					<span class="badge badge-ghost badge-sm">🎤 Live Pitches</span>
					<span class="badge badge-ghost badge-sm">🤝 Networking</span>
					<span class="badge badge-ghost badge-sm">💡 Investors</span>
				</div>
			</div>

			{#if interest}
				<p class="text-sm text-base-content/50">
					Registered as: <span class="text-primary font-medium">{interest}</span>
				</p>
			{/if}
		</div>
	{:else}
		<form onsubmit={(e) => { e.preventDefault(); submitForm(); }} class="space-y-3">
			<!-- Section 1: Pitched Before -->
			<div class="glass-subtle rounded-2xl p-4 md:p-5" in:fly={{ y: 10, duration: 250 }}>
				<h3 class="text-sm font-semibold text-base-content/90 mb-3 flex items-center gap-2">
					<span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
					Have you pitched before?
				</h3>
				<div class="flex gap-2">
					<button
						type="button"
						class="btn btn-sm flex-1 transition-all duration-200 {pitchedBefore === 'Yes' ? 'btn-primary shadow-md' : 'glass-subtle hover:bg-white/10'}"
						onclick={() => { pitchedBefore = 'Yes'; }}
					>Yes</button>
					<button
						type="button"
						class="btn btn-sm flex-1 transition-all duration-200 {pitchedBefore === 'No' ? 'btn-primary shadow-md' : 'glass-subtle hover:bg-white/10'}"
						onclick={() => { pitchedBefore = 'No'; }}
					>No</button>
				</div>
			</div>

			<!-- Section 2: Interest -->
			{#if showInterest}
				<div
					class="glass-subtle rounded-2xl p-4 md:p-5"
					in:slide={{ duration: 300, easing: quintOut }}
					use:scrollIntoView
				>
					<h3 class="text-sm font-semibold text-base-content/90 mb-3 flex items-center gap-2">
						<span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
						What are you interested in?
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each interests as opt}
							<button
								type="button"
								class="btn btn-sm transition-all duration-200 {interest === opt ? 'btn-primary shadow-md' : 'glass-subtle hover:bg-white/10'}"
								onclick={() => { interest = opt; }}
							>{opt}</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Section 3: Details -->
			{#if showDetails}
				<div
					class="glass-subtle rounded-2xl p-4 md:p-5"
					in:slide={{ duration: 300, easing: quintOut }}
					use:scrollIntoView
				>
					<h3 class="text-sm font-semibold text-base-content/90 mb-3 flex items-center gap-2">
						<span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">3</span>
						Your details
					</h3>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<label class="form-control">
							<div class="label py-1">
								<span class="label-text text-xs text-base-content/70 flex items-center gap-1">
									<User class="w-3 h-3" /> Full name
								</span>
							</div>
							<input
								class="input input-bordered input-sm"
								bind:value={name}
								placeholder="Jane Doe"
								required
								autocomplete="name"
							/>
							{#if showErrors && !nameValid}
								<span class="text-error mt-1 text-xs">Full name is required (min 2 chars).</span>
							{/if}
						</label>
						<label class="form-control">
							<div class="label py-1">
								<span class="label-text text-xs text-base-content/70 flex items-center gap-1">
									<Mail class="w-3 h-3" /> Email
								</span>
							</div>
							<input
								type="email"
								class="input input-bordered input-sm"
								bind:value={email}
								placeholder="you@example.com"
								required
								autocomplete="email"
							/>
							{#if (showErrors || email) && !emailValid}
								<span class="text-error mt-1 text-xs">Enter a valid email address.</span>
							{/if}
						</label>
					</div>
				</div>
			{/if}

			<!-- Section 4: Message (optional) -->
			{#if showMessage}
				<div
					class="glass-subtle rounded-2xl p-4 md:p-5"
					in:slide={{ duration: 300, easing: quintOut }}
					use:scrollIntoView
				>
					<h3 class="text-sm font-semibold text-base-content/90 mb-3 flex items-center gap-2">
						<span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">4</span>
						<MessageSquare class="w-3.5 h-3.5" />
						Message
						<span class="text-base-content/50 text-xs font-normal">(optional)</span>
					</h3>
					<textarea
						class="textarea textarea-bordered w-full min-h-20 text-sm"
						bind:value={message}
						placeholder="Tell us a little about what you're looking for..."
					></textarea>
				</div>
			{/if}

			<!-- Section 5: Consent -->
			{#if showConsent}
				<div
					class="glass-subtle rounded-2xl p-4 md:p-5"
					in:slide={{ duration: 300, easing: quintOut }}
					use:scrollIntoView
				>
					<h3 class="text-sm font-semibold text-base-content/90 mb-3 flex items-center gap-2">
						<span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">5</span>
						<Shield class="w-3.5 h-3.5" />
						Consent
					</h3>
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							class="checkbox checkbox-accent checkbox-sm flex-shrink-0 mt-0.5"
							bind:checked={consent}
						/>
						<div class="min-w-0">
							<span class="text-xs sm:text-sm text-base-content leading-snug block">
								I agree to be contacted about events and updates.
							</span>
							<span class="text-base-content/50 text-xs mt-1 block">
								Unsubscribe anytime. We respect your privacy.
							</span>
						</div>
					</label>
				</div>
			{/if}

			<!-- Error display -->
			{#if formError}
				<div class="alert alert-error glass-subtle rounded-2xl border-0 text-sm" in:slide={{ duration: 200 }}>
					<AlertTriangle class="h-4 w-4 flex-shrink-0" />
					<span>{formError}</span>
				</div>
			{/if}

			<!-- Submit -->
			{#if showConsent}
				<div class="pt-1" in:fade={{ duration: 200 }}>
					<button
						type="submit"
						class="btn btn-primary w-full rounded-full transition-all duration-300 {canSubmit ? 'shadow-lg hover:shadow-xl hover:scale-[1.02]' : 'btn-disabled opacity-60'}"
						disabled={!canSubmit}
					>
						{#if submitted === 'submitting'}
							<span class="loading loading-spinner loading-sm"></span>
							Submitting...
						{:else}
							Register Interest
							<ChevronRight class="w-4 h-4" />
						{/if}
					</button>
					<p class="text-xs text-base-content/40 text-center mt-2">
						Powered by <a href="https://web3forms.com" class="link link-hover" target="_blank" rel="noopener">Web3Forms</a>
					</p>
				</div>
			{/if}
		</form>
	{/if}
</div>
