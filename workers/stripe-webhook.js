/**
 * WORKER 1: stripe-webhook.js
 * Deploy as a Cloudflare Worker at:
 *   https://wakeupandproduce.com/api/stripe-webhook
 *
 * Required KV binding (Cloudflare dashboard > Worker > Settings > Variables):
 *   Variable name: PAID_USERS
 *
 * Required secret (encrypted environment variable):
 *   STRIPE_WEBHOOK_SECRET  — from Stripe Dashboard > Webhooks > signing secret
 *
 * Stripe events to enable on the webhook endpoint:
 *   checkout.session.completed
 *   customer.subscription.deleted
 *   invoice.payment_failed
 */

export default {
  async fetch(request, env) {

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    let event;
    try {
      event = await verifyStripeWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // ONE-TIME PURCHASE or SUBSCRIPTION START
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_details?.email?.toLowerCase();

      if (email) {
        const record = {
          paid_at: new Date().toISOString(),
          session_id: session.id,
          mode: session.mode, // 'payment' (one-time) or 'subscription'
          customer_id: session.customer || null,
        };
        await env.PAID_USERS.put(email, JSON.stringify(record));

        // Also index by customer ID so subscription cancellation can find the email
        if (session.customer) {
          await env.PAID_USERS.put(`customer:${session.customer}`, JSON.stringify({ email }));
        }

        console.log(`Access granted: ${email}`);
      }
    }

    // SUBSCRIPTION CANCELLED or EXPIRED
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const emailRecord = await env.PAID_USERS.get(`customer:${customerId}`);
      if (emailRecord) {
        const { email } = JSON.parse(emailRecord);
        await env.PAID_USERS.delete(email);
        await env.PAID_USERS.delete(`customer:${customerId}`);
        console.log(`Access revoked: ${email}`);
      }
    }

    // PAYMENT FAILED — log only; Stripe retries and fires subscription.deleted if unresolved
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      console.log(`Payment failed for customer: ${invoice.customer}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function verifyStripeWebhook(body, signature, secret) {
  const parts = Object.fromEntries(
    signature.split(',').map(part => {
      const [key, ...rest] = part.split('=');
      return [key, rest.join('=')];
    })
  );

  const timestamp = parts['t'];
  const receivedSig = parts['v1'];

  if (!timestamp || !receivedSig) {
    throw new Error('Invalid signature format');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new Error('Timestamp too old — possible replay attack');
  }

  const signedPayload = `${timestamp}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload)
  );

  const expectedSig = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSig !== receivedSig) {
    throw new Error('Signature mismatch');
  }

  return JSON.parse(body);
}
