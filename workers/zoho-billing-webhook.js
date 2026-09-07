/**
 * WORKER: zoho-billing-webhook.js
 * Deploy as a Cloudflare Worker at:
 *   https://wakeupandproduce.com/api/zoho-billing-webhook
 *
 * Required KV binding (same namespace as the other access workers):
 *   Variable name: PAID_USERS
 *
 * Required secret (encrypted environment variable):
 *   ZOHO_BILLING_WEBHOOK_SECRET — a shared secret you generate yourself
 *   (e.g. `openssl rand -hex 32`) and send back as the "x-wup-webhook-secret"
 *   header from a Zoho Billing Workflow Rule > Webhook action. Zoho Billing's
 *   native subscription webhooks don't sign their payloads, so the workflow
 *   webhook + shared-secret-header approach (same one documented for the
 *   Grinnell purchase webhook in SETUP.md) is the way to authenticate these.
 *
 * Optional environment variable:
 *   PRODUCE_PLUS_PLAN_CODE — the Zoho Billing plan code for the "Produce Plus"
 *   community tier. If set, events for any other plan/subscription on the same
 *   Zoho Billing account are ignored. Leave unset if Produce Plus is the only
 *   subscription product you run through Zoho Billing.
 *
 * Effect:
 *   Anyone with an active Produce Plus subscription gets their email written
 *   into the same PAID_USERS KV that gates the Grinnell Tracker — no separate
 *   $9 purchase needed. This mirrors zoho-webhook.js's grant pattern, just
 *   triggered by a subscription event instead of a one-time payment.
 *
 * Setup — Zoho Billing > Automation > Workflow Rules > New Workflow:
 *   Module:  Subscription
 *   When:    Subscription Activated, Subscription Renewed, Subscription Reactivated
 *   Action:  Webhook
 *     URL:          https://wakeupandproduce.com/api/zoho-billing-webhook
 *     Method:       POST
 *     Header key:   x-wup-webhook-secret
 *     Header value: (same value as the ZOHO_BILLING_WEBHOOK_SECRET worker secret)
 *     Body (JSON):
 *       {
 *         "event": "subscription_activation",
 *         "subscription": {
 *           "subscription_id": "${subscription.subscription_id}",
 *           "plan_code": "${subscription.plan.plan_code}",
 *           "email": "${subscription.customer.email}"
 *         }
 *       }
 *
 * Note on cancellations: this worker intentionally does NOT revoke access when
 * a Produce Plus subscription lapses or is cancelled — same "doesn't expire
 * automatically" policy as the $9 Grinnell purchase (see SETUP.md). If you
 * want to claw back access from a lapsed subscriber, do it via the admin panel
 * (/admin/) so you don't accidentally remove access someone earned a different
 * way (direct purchase, manual comp).
 */

const GRANT_EVENTS = new Set([
  'subscription_activation',
  'subscription_activated',
  'subscription_renewal',
  'subscription_renewed',
  'subscription_reactivation',
  'subscription_reactivated',
]);

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.text();
    try {
      verifySharedSecret(request, env.ZOHO_BILLING_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Zoho Billing webhook verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // Log raw event on first deployment so you can confirm field names in Worker logs
    console.log('Zoho Billing event received:', JSON.stringify(event));

    const eventType = String(event.event || event.event_type || '').toLowerCase();
    const sub = event.subscription || event.data?.subscription || {};
    const email = String(sub.email || sub.customer?.email || event.email || '').toLowerCase().trim();
    const planCode = String(sub.plan_code || sub.plan?.plan_code || '').toLowerCase();

    if (!email) {
      console.warn('Zoho Billing webhook received with no subscriber email — check the workflow body template');
      return ok();
    }

    if (env.PRODUCE_PLUS_PLAN_CODE && planCode && planCode !== env.PRODUCE_PLUS_PLAN_CODE.toLowerCase()) {
      console.log(`Ignoring Zoho Billing event for unrelated plan: ${planCode}`);
      return ok();
    }

    if (!GRANT_EVENTS.has(eventType)) {
      console.log(`Ignoring Zoho Billing event type: ${eventType}`);
      return ok();
    }

    const record = {
      granted_at: new Date().toISOString(),
      mode: 'community_plus',
      subscription_id: sub.subscription_id || sub.id || null,
      plan_code: sub.plan_code || sub.plan?.plan_code || null,
      note: 'Produce Plus subscriber — auto-granted',
    };

    // Store under the plain email key (checked by access-evaluator / Grinnell paywall)
    // and under a plus: prefix (so the admin panel can list/manage these grants)
    await env.PAID_USERS.put(email, JSON.stringify(record));
    await env.PAID_USERS.put(`plus:${email}`, JSON.stringify(record));
    console.log(`Grinnell access granted via Produce Plus: ${email}`);

    return ok();
  },
};

function ok() {
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function verifySharedSecret(request, secret) {
  if (!secret) throw new Error('Missing ZOHO_BILLING_WEBHOOK_SECRET');

  const provided = request.headers.get('x-wup-webhook-secret') ||
    request.headers.get('x-zoho-webhook-secret');

  if (!provided || !safeEqual(provided, secret)) {
    throw new Error('Missing or invalid shared secret header');
  }
}

function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
