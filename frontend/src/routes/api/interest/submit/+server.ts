import type { RequestHandler } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { dev } from '$app/environment';

// Control logs via env: ENABLE_API_LOGS=1 forces on; APP_ENV/NODE_ENV='production' disables by default
const ENV_NAME = privateEnv.APP_ENV || privateEnv.NODE_ENV || (dev ? 'development' : 'production');
const LOG_ENABLED = privateEnv.ENABLE_API_LOGS === '1' || ENV_NAME !== 'production';
const log = (...args: any[]) => {
  if (LOG_ENABLED) console.log('[api/interest/submit]', ...args);
};

// Verify reCAPTCHA v2 token with Google
async function verifyRecaptcha(token: string) {
  const secret = privateEnv.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: 'Missing RECAPTCHA_SECRET_KEY' } as const;
  }

  const params = new URLSearchParams({
    secret,
    response: token
  });

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const data = (await res.json()) as {
    success: boolean;
    score?: number;
    action?: string;
    hostname?: string;
    challenge_ts?: string;
    'error-codes'?: string[];
  };

  if (!data.success) {
  return { ok: false, error: 'recaptcha_failed', data } as const;
  }

  return { ok: true, data } as const;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      name,
      email,
      pitchedBefore,
      interest,
      message,
      event_year,
      event_quarter,
      consent,
  recaptchaToken
    } = body || {};

    log('Incoming submission', {
      nameLen: typeof name === 'string' ? name.length : null,
      emailLen: typeof email === 'string' ? email.length : null,
      pitchedBefore,
      interest,
      msgLen: typeof message === 'string' ? message.length : 0,
      event_year,
      event_quarter,
      haveToken: !!recaptchaToken
    });

    // Basic validation first (before contacting reCAPTCHA)
    const errors: Record<string, string> = {};
    const allowedInterests = ['Attending', 'Pitching my business', 'Investing / Partnering'];
    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const nameStr = typeof name === 'string' ? name.trim() : '';
    const emailStr = typeof email === 'string' ? email.trim() : '';

    if (!nameStr || nameStr.length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }
    if (!emailStr || !emailRe.test(emailStr)) {
      errors.email = 'Enter a valid email address.';
    }
    if (pitchedBefore !== 'Yes' && pitchedBefore !== 'No') {
      errors.pitchedBefore = 'Please select if you have pitched before.';
    }
    if (!interest || !allowedInterests.includes(interest)) {
      errors.interest = 'Select a valid interest option.';
    }
    if (typeof consent !== 'boolean' || consent !== true) {
      errors.consent = 'Consent is required.';
    }
    if (message && typeof message === 'string' && message.length > 1500) {
      errors.message = 'Message is too long (max 1500 characters).';
    }
    const currentYear = new Date().getFullYear();
    if (typeof event_year !== 'number' || event_year < currentYear - 1 || event_year > currentYear + 1) {
      errors.event_year = 'Invalid event year.';
    }
    if (typeof event_quarter !== 'string' || !/^Q[1-4]$/.test(event_quarter)) {
      errors.event_quarter = 'Invalid event quarter.';
    }

    if (Object.keys(errors).length > 0) {
  log('Validation failed', errors);
  return new Response(JSON.stringify({ error: 'validation_failed', errors }), { status: 400 });
    }

    if (!recaptchaToken) {
    log('Missing reCAPTCHA token');
    return new Response(JSON.stringify({ error: 'missing_recaptcha_token' }), { status: 400 });
    }

  log('Verifying reCAPTCHA', { tokenLen: (recaptchaToken as string)?.length ?? 0 });
  const recaptcha = await verifyRecaptcha(recaptchaToken);
    if (!recaptcha.ok) {
    log('reCAPTCHA failed', recaptcha);
    return new Response(JSON.stringify({ error: 'recaptcha_verification_failed', detail: recaptcha }), { status: 400 });
    }

    // Prefer WEB3FORMS_ACCESS_KEY; support legacy WEB_ACCESS_KEY as fallback
    const accessKey = privateEnv.WEB3FORMS_ACCESS_KEY || privateEnv.WEB_ACCESS_KEY;
    if (!accessKey) {
  log('Missing Web3Forms access key (expected WEB3FORMS_ACCESS_KEY or WEB_ACCESS_KEY)');
  return new Response(
        JSON.stringify({ error: 'missing_web3forms_key', expected: ['WEB3FORMS_ACCESS_KEY', 'WEB_ACCESS_KEY'] }),
        { status: 500 }
      );
    }

    const payload = {
      access_key: accessKey,
      to: 'info@liffeyfoundersclub.com',
      subject: `New Interest Form Submission from ${name}`,
      from_name: name,
      from_email: email,
      name,
      email,
      pitchedBefore,
      interest,
      message,
      event_year,
      event_quarter,
      consent
    };

  log('Relaying to Web3Forms');
  const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      log('Web3Forms HTTP error', res.status, err?.slice?.(0, 200));
      return new Response(JSON.stringify({ error: 'web3forms_failed', detail: err }), { status: 502 });
    }

    const json = await res.json();
    if (!json.success) {
      log('Web3Forms returned failure', json);
      return new Response(JSON.stringify({ error: 'web3forms_error', detail: json }), { status: 502 });
    }

    log('Submission success');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    log('Server exception', e);
    return new Response(JSON.stringify({ error: 'server_error', detail: String(e) }), { status: 500 });
  }
};
