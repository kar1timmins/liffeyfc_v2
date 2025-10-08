<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { CheckCircle2, Calendar, Mail, Users, ExternalLink } from 'lucide-svelte';

	let name = '';
	let email = '';
	let interest = '';
	let eventQuarter = 'Q1';
	let eventYear = '2025';

	onMount(() => {
		// Get URL parameters
		const urlParams = new URLSearchParams(window.location.search);
		name = urlParams.get('name') || 'New Member';
		email = urlParams.get('email') || '';
		interest = urlParams.get('interest') || '';
		eventQuarter = urlParams.get('eventQuarter') || 'Q1';
		eventYear = urlParams.get('eventYear') || '2025';
	});
</script>

<svelte:head>
	<title>Welcome to Liffey Founders Club!</title>
	<meta name="description" content="Welcome to Dublin's premier startup community. Your registration is confirmed!" />
	<link rel="canonical" href="https://liffeyfoundersclub.com/welcome" />
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20">
	<div class="container mx-auto px-4 py-16">
		<div class="max-w-2xl mx-auto">
			<!-- Success Header -->
			<div class="text-center mb-8">
				<div class="inline-flex items-center justify-center w-20 h-20 bg-success/20 rounded-full mb-6">
					<CheckCircle2 class="w-10 h-10 text-success" />
				</div>
				<h1 class="text-4xl md:text-5xl font-bold text-base-content mb-4">
					🚀 Welcome to Liffey Founders Club!
				</h1>
				<p class="text-xl text-base-content/80">
					Hello <strong>{name}</strong>, your registration is confirmed!
				</p>
			</div>

			<!-- Welcome Content -->
			<div class="bg-base-100 rounded-2xl shadow-xl p-8 mb-8">
				<div class="space-y-6">
					<!-- Registration Confirmation -->
					<div class="bg-success/10 rounded-lg p-6">
						<h2 class="text-2xl font-bold text-success mb-3 flex items-center gap-3">
							<Calendar class="w-6 h-6" />
							Registration Confirmed
						</h2>
						<p class="text-base-content mb-3">
							Thank you for registering your interest with Liffey Founders Club! We're excited to have you join Dublin's premier startup community.
						</p>
						<div class="bg-base-200 rounded p-4">
							<p><strong>Event:</strong> {eventQuarter} {eventYear}</p>
							<p><strong>Interest:</strong> {interest || 'General attendance'}</p>
							{#if email}
								<p><strong>Email:</strong> {email}</p>
							{/if}
						</div>
					</div>

					<!-- What's Next -->
					<div class="bg-primary/10 rounded-lg p-6">
						<h3 class="text-xl font-bold text-primary mb-3 flex items-center gap-3">
							🎯 What's Next
						</h3>
						<p class="text-base-content mb-4">
							Your registration for our <strong>{eventQuarter} {eventYear}</strong> event has been received. We'll be in touch soon with event details and networking opportunities.
						</p>
					</div>

					<!-- What to Expect -->
					<div class="bg-secondary/10 rounded-lg p-6">
						<h3 class="text-xl font-bold text-secondary mb-3 flex items-center gap-3">
							🌟 What to Expect
						</h3>
						<ul class="space-y-2 text-base-content">
							<li class="flex items-start gap-2">
								<CheckCircle2 class="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
								Quarterly networking events with fellow entrepreneurs
							</li>
							<li class="flex items-start gap-2">
								<CheckCircle2 class="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
								Opportunities to practice and refine your pitch
							</li>
							<li class="flex items-start gap-2">
								<CheckCircle2 class="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
								Access to investors and industry mentors
							</li>
							<li class="flex items-start gap-2">
								<CheckCircle2 class="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
								Supportive community of Dublin-based founders
							</li>
							<li class="flex items-start gap-2">
								<CheckCircle2 class="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
								Regular updates on startup ecosystem events
							</li>
						</ul>
					</div>

					<!-- Stay Connected -->
					<div class="bg-accent/10 rounded-lg p-6">
						<h3 class="text-xl font-bold text-accent mb-3 flex items-center gap-3">
							<Mail class="w-6 h-6" />
							Stay Connected
						</h3>
						<p class="text-base-content mb-4">
							Follow us for the latest updates and community news. We'll send you event details and agenda closer to the date.
						</p>
						<p class="text-base-content">
							<strong>Questions?</strong> Email us at 
							<a href="mailto:info@liffeyfoundersclub.com" class="link link-primary">
								info@liffeyfoundersclub.com
							</a> - we're here to help!
						</p>
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				<a href="/" class="btn btn-primary btn-lg">
					<Users class="w-5 h-5" />
					Back to Home
				</a>
				<a href="/pitch" class="btn btn-outline btn-lg">
					<ExternalLink class="w-5 h-5" />
					Explore Pitches
				</a>
			</div>

			<!-- Footer Note -->
			<div class="text-center mt-8 text-base-content/60">
				<p class="text-sm">
					This welcome page was shown because you successfully registered for Liffey Founders Club.
				</p>
				<p class="text-sm mt-2">
					Event: {eventQuarter} {eventYear} | Location: Dublin, Ireland
				</p>
			</div>
		</div>
	</div>
</div>