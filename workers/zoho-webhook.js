/**
 * WORKER 1: zoho-webhook.js
 * Deploy as a Cloudflare Worker at:
 *   https://wakeupandproduce.com/api/zoho-webhook
 *
 * Required KV binding (Cloudflare dashboard > Worker > Settings > Variables):
 *   Variable name: PAID_USERS
 *
 * Required secret (encrypted environment variable):
 *   ZOHO_WEBHOOK_SECRET — from Zoho Payments > Settings > Webhooks > Signing Secret
 *
 * Zoho Payments events to enable on the webhook endpoint:
 *   payment.captured   (successful one-time payment)
 *   payment.failed     (optional — for logging)
 *
 * Zoho Payments signs each request with HMAC-SHA256 of the raw body using your
 * signing secret, then base64-encodes the result. The signature is sent in the
 * "x-zoho-signature" request header. Verify before trusting the payload.
 *
 * Product:
 *   Grinnell System Tracker one-time access
 *   item_id: 2978138000002946005
 *   amount: 9.00 USD
 *
 * Payload shape (Zoho Payments one-time):
 *   {
 *     "event": "payment.captured",
 *     "payload": {
 *       "payment": {
 *         "id": "pay_xxx",
 *         "amount": 9.00,
 *         "currency": "USD",
 *         "status": "captured",
 *         "customer_email": "coach@school.edu",
 *         "customer_name": "..."
 *       }
 *     }
 *   }
 *
 * If the field names differ from your actual Zoho payload, adjust the
 * extractEmail() helper below — it logs the raw event on first run so
 * you can inspect via Cloudflare Worker logs.
 */

export default {
  async fetch(request, env) {

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.text();
    const signature = request.headers.get('x-zoho-signature');

    if (!signature) {
      return new Response('Missing x-zoho-signature header', { status: 400 });
    }

    try {
      await verifyZohoWebhook(body, signature, env.ZOHO_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // Log raw event on first deployment so you can inspect field names in Worker logs
    console.log('Zoho event received:', JSON.stringify(event));

    const eventType = String(event.event || event.event_type || event.type || '').toLowerCase();

    // PAYMENT CAPTURED/SUCCESS — grant access
    if (isSuccessfulPaymentEvent(eventType, event)) {
      const email = extractEmail(event);

      if (email) {
        const payment = getPaymentObject(event);
        const record = {
          paid_at: new Date().toISOString(),
          payment_id: payment.id || null,
          amount: payment.amount || null,
          item_id: extractItemId(event),
          mode: 'payment',
        };
        await env.PAID_USERS.put(email, JSON.stringify(record));
        console.log(`Access granted: ${email}`);
      } else {
        console.warn('payment.captured received but no email found in payload');
      }
    }

    // PAYMENT FAILED — log only
    if (eventType === 'payment.failed') {
      const email = extractEmail(event);
      console.log(`Payment failed for: ${email || 'unknown'}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

/**
 * Verify Zoho Payments webhook signature.
 * Zoho signs: base64(HMAC-SHA256(rawBody, secret))
 */
async function verifyZohoWebhook(body, signature, secret) {
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
    new TextEncoder().encode(body)
  );

  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  if (expectedSig !== signature) {
    throw new Error('Signature mismatch');
  }
}

/**
 * Pull customer email from Zoho Payments payload.
 * Adjust field paths here if your payload structure differs —
 * check Worker logs after the first real event to confirm.
 */
function extractEmail(event) {
  const payment = getPaymentObject(event);
  const payload = event.payload ?? {};
  const dataObject = event.data?.object ?? {};
  const raw =
    payment.customer_email ||
    payment.email ||
    payment.receipt_email ||
    payment.customer?.email ||
    payment.customer_details?.email ||
    payload.customer?.email ||
    payload.customer_email ||
    payload.email ||
    payload.hostedpage?.customer?.email ||
    payload.hosted_page?.customer?.email ||
    payload.hosted_page_parameters?.email ||
    dataObject.customer_email ||
    dataObject.email ||
    dataObject.customer?.email ||
    dataObject.customer_details?.email ||
    event.customer_email ||
    event.email ||
    '';
  return raw.toLowerCase().trim() || null;
}

function extractItemId(event) {
  const payment = getPaymentObject(event);
  const meta = payment.meta_data || payment.metadata || event.payload?.meta_data || event.data?.object?.metadata || [];
  if (Array.isArray(meta)) {
    const item = meta.find(entry => entry.key === 'item_id');
    if (item) return item.value || null;
  }
  return payment.item_id || event.payload?.hosted_page_parameters?.udf1 || event.data?.object?.item_id || null;
}

function getPaymentObject(event) {
  return event.payload?.payment ||
    event.payload?.payment_session?.payment ||
    event.payload?.payment_session ||
    event.payload?.hostedpage?.payment ||
    event.payload?.hosted_page?.payment ||
    event.data?.object ||
    {};
}

function isSuccessfulPaymentEvent(eventType, event) {
  if ([
    'payment.captured',
    'payment.success',
    'payment.succeeded',
    'payment.paid',
    'checkout.completed',
    'checkout.session.completed',
    'hostedpage.completed',
    'hosted_page.completed',
    'invoice.paid',
  ].includes(eventType)) {
    return true;
  }

  const payment = getPaymentObject(event);
  const status = String(payment.status || event.payload?.status || event.data?.object?.status || '').toLowerCase();
  return ['captured', 'success', 'succeeded', 'paid', 'completed'].includes(status);
}
