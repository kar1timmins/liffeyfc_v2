import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// Development: relay to NestJS backend
// Production: uses PHP at /api/interest/submit/index.php
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		
		// In development, forward to NestJS backend
		// In production, this route won't exist (static deployment)
		const backendUrl = 'http://backend:3000'; // Use docker service name
		
		const response = await fetch(`${backendUrl}/contact/interest`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorData;
			try {
				errorData = JSON.parse(errorText);
			} catch {
				errorData = { error: errorText };
			}
			return json(errorData, { status: response.status });
		}

		const result = await response.json();
		return json(result, { status: response.status });
	} catch (error) {
		console.error('Relay error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
