/**
 * Zoho checkout/session worker
 * Route: https://wakeupandproduce.com/api/zoho-callback*
 *
 * Required bindings/secrets:
 *   PAID_USERS               KV namespace used by the existing access workers
 *   ZOHO_OAUTH_TOKEN         Zoho Payments OAuth token, never exposed client-side
 *   ZOHO_PAYMENTS_ACCOUNT_ID Zoho Payments account id
 *   ZOHO_PUBLIC_API_KEY      Public widget API key from Zoho Payments Developer Space
 *   COACH_PASSCODE           Optional manual passcode for trusted coaches
 *
 * Product:
 *   item_id: 2978138000002946005
 *   price:   $19 one-time
 */

const ZOHO_API_ORIGIN = 'https://payments.zoho.com';
const PRODUCT_ITEM_ID = '2978138000002946005';
const PRODUCT_AMOUNT = '19.00';
const PRODUCT_CURRENCY = 'USD';

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders(request) });
      }

      if (request.method === 'GET' && url.pathname.endsWith('/session')) {
        return handleSessionCheck(request, env);
      }

      if (request.method === 'POST' && url.pathname.endsWith('/passcode')) {
        return handlePasscode(request, env);
      }

      if (request.method === 'POST' && url.pathname.endsWith('/create-session')) {
        return handleCreatePaymentSession(request, env);
      }

      if (request.method === 'POST' && url.pathname.endsWith('/confirm')) {
        return handleConfirmPayment(request, env);
      }

      return json({ error: 'Not found' }, 404, request);
    } catch (err) {
      console.error('Zoho callback error:', err.message);
      return json({ error: err.message || 'Zoho callback failed' }, 500, request);
    }
  },
};

async function handleSessionCheck(request, env) {
  const email = getAccessEmail(request);
  const pass = request.headers.get('x-coach-passcode') || '';

  if (pass && env.COACH_PASSCODE && safeEqual(pass, env.COACH_PASSCODE)) {
    return json({ unlocked: true, mode: 'passcode' }, 200, request);
  }

  if (!email) {
    return json({ unlocked: false, mode: 'anonymous' }, 200, request);
  }

  const record = await env.PAID_USERS.get(email.toLowerCase());
  return json({ unlocked: Boolean(record), email, mode: record ? 'paid' : 'unpaid' }, 200, request);
}

async function handlePasscode(request, env) {
  const body = await readJson(request);
  const passcode = String(body.passcode || '');

  if (!env.COACH_PASSCODE || !safeEqual(passcode, env.COACH_PASSCODE)) {
    return json({ unlocked: false, error: 'Invalid passcode' }, 401, request);
  }

  return json({ unlocked: true, mode: 'passcode' }, 200, request);
}

async function handleCreatePaymentSession(request, env) {
  requireEnv(env, ['ZOHO_OAUTH_TOKEN', 'ZOHO_PAYMENTS_ACCOUNT_ID', 'ZOHO_PUBLIC_API_KEY']);

  const body = await readJson(request);
  const email = String(body.email || '').toLowerCase().trim();
  const name = String(body.name || 'Coach').trim() || 'Coach';

  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400, request);
  }

  const origin = new URL(request.url).origin;
  const reference = `grinnell-${crypto.randomUUID()}`;
  const payload = {
    amount: PRODUCT_AMOUNT,
    currency: PRODUCT_CURRENCY,
    expires_in: 900,
    description: 'Wake Up and Produce Grinnell System Tracker',
    reference_number: reference,
    meta_data: [
      { key: 'item_id', value: PRODUCT_ITEM_ID },
      { key: 'product', value: 'grinnell_tracker' },
      { key: 'email_hash', value: await sha256(email) },
    ],
    configurations: {
      allowed_payment_methods: ['card'],
      hosted_page_parameters: {
        name,
        email,
        description: 'Grinnell System Tracker - one-time access',
        success_url: `${origin}/grinnell-tracker/?paid=1`,
        failure_url: `${origin}/grinnell-tracker/?paid=0`,
        udf1: PRODUCT_ITEM_ID,
        udf2: 'grinnell_tracker',
      },
    },
    max_retry_count: 3,
  };

  const zoho = await zohoFetch(env, '/api/v1/paymentsessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const session = zoho.payments_session || zoho.payment_session || {};
  const paymentsSessionId = session.payments_session_id;

  if (!paymentsSessionId) {
    console.error('Unexpected Zoho create-session response:', JSON.stringify(zoho));
    return json({ error: 'Zoho did not return a payment session' }, 502, request);
  }

  await env.PAID_USERS.put(`pending:${paymentsSessionId}`, JSON.stringify({
    email,
    name,
    item_id: PRODUCT_ITEM_ID,
    amount: PRODUCT_AMOUNT,
    currency: PRODUCT_CURRENCY,
    reference,
    created_at: new Date().toISOString(),
  }), { expirationTtl: 60 * 60 });

  return json({
    account_id: env.ZOHO_PAYMENTS_ACCOUNT_ID,
    domain: env.ZOHO_PAYMENTS_DOMAIN || 'US',
    api_key: env.ZOHO_PUBLIC_API_KEY,
    amount: PRODUCT_AMOUNT,
    currency_code: PRODUCT_CURRENCY,
    currency_symbol: '$',
    item_id: PRODUCT_ITEM_ID,
    payments_session_id: paymentsSessionId,
    payment_intent_id: paymentsSessionId,
    client_token: session.access_key || null,
    reference_number: reference,
    email,
    name,
  }, 200, request);
}

async function handleConfirmPayment(request, env) {
  requireEnv(env, ['ZOHO_OAUTH_TOKEN', 'ZOHO_PAYMENTS_ACCOUNT_ID']);

  const body = await readJson(request);
  const paymentId = String(body.payment_id || '').trim();
  const paymentsSessionId = String(body.payments_session_id || body.payment_intent_id || '').trim();

  if (!paymentId && !paymentsSessionId) {
    return json({ error: 'payment_id or payments_session_id required' }, 400, request);
  }

  let payment = null;
  if (paymentId) {
    const zoho = await zohoFetch(env, `/api/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
    });
    payment = zoho.payment || null;
  }

  if (!payment && paymentsSessionId) {
    const list = await zohoFetch(env, `/api/v1/payments?payments_session_id=${encodeURIComponent(paymentsSessionId)}`, {
      method: 'GET',
    });
    payment = Array.isArray(list.payments) ? list.payments[0] : null;
  }

  const status = String(payment?.status || '').toLowerCase();
  const captured = ['succeeded', 'success', 'captured', 'paid'].includes(status) ||
    Number(payment?.amount_captured || 0) >= Number(PRODUCT_AMOUNT);

  if (!payment || !captured) {
    return json({ unlocked: false, error: 'Payment not confirmed yet' }, 402, request);
  }

  const pending = paymentsSessionId
    ? await env.PAID_USERS.get(`pending:${paymentsSessionId}`, 'json')
    : null;
  const email = String(
    pending?.email ||
    payment.receipt_email ||
    payment.customer_email ||
    payment.customer?.email ||
    ''
  ).toLowerCase().trim();

  if (!email) {
    return json({ unlocked: false, error: 'Payment confirmed, but no email was found' }, 409, request);
  }

  await env.PAID_USERS.put(email, JSON.stringify({
    paid_at: new Date().toISOString(),
    payment_id: payment.payment_id || paymentId,
    payments_session_id: paymentsSessionId || payment.payments_session_id || null,
    amount: payment.amount || PRODUCT_AMOUNT,
    currency: payment.currency || PRODUCT_CURRENCY,
    item_id: PRODUCT_ITEM_ID,
    mode: 'payment',
  }));

  return json({ unlocked: true, email }, 200, request);
}

async function zohoFetch(env, path, init) {
  const url = new URL(path, ZOHO_API_ORIGIN);
  url.searchParams.set('account_id', env.ZOHO_PAYMENTS_ACCOUNT_ID);

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${env.ZOHO_OAUTH_TOKEN}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.code && data.code !== 0)) {
    console.error('Zoho API error:', response.status, JSON.stringify(data));
    throw new Error(data.message || `Zoho API request failed: ${response.status}`);
  }

  return data;
}

function getAccessEmail(request) {
  const direct = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (direct) return direct.toLowerCase().trim();

  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return null;

  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.email || '').toLowerCase().trim() || null;
  } catch {
    return null;
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function sha256(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function requireEnv(env, keys) {
  const missing = keys.filter(key => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-coach-passcode',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function json(data, status = 200, request = new Request('https://wakeupandproduce.com')) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(request),
    },
  });
}
