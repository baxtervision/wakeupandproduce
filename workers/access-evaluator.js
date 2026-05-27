/**
 * WORKER 2: access-evaluator.js
 * Deploy as a Cloudflare Worker at:
 *   https://wakeupandproduce.com/api/access-check
 *
 * Then in Cloudflare Access > your Application > Policies:
 *   Add a rule: External Evaluation
 *   Evaluate URL: https://wakeupandproduce.com/api/access-check
 *   Keys URL: (leave blank — we're doing KV lookup, not JWT signing)
 *
 * Required KV binding (same namespace as stripe-webhook worker):
 *   Variable name: PAID_USERS
 */

export default {
  async fetch(request, env) {

    // Cloudflare Access sends the user's JWT in this header
    const token = request.headers.get('Cf-Access-Jwt-Assertion');

    if (!token) {
      return new Response(JSON.stringify({ allow: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let email;
    try {
      // Decode JWT payload (base64 middle segment)
      // Full JWT verification is optional — Access already validated it upstream
      const payload = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      );
      email = payload.email?.toLowerCase();
    } catch (err) {
      console.error('JWT decode failed:', err.message);
      return new Response(JSON.stringify({ allow: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ allow: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = await env.PAID_USERS.get(email);
    const allow = record !== null;

    console.log(`Access check: ${email} → ${allow ? 'ALLOW' : 'DENY'}`);

    return new Response(JSON.stringify({ allow }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
