// Endpoint disabled: static deployment uses PHP at /api/interest/submit/index.php
// Keeping stub to avoid accidental dynamic usage. Returns 410 Gone.
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = () => new Response(JSON.stringify({ error: 'endpoint_disabled_use_php' }), { status: 410 });
