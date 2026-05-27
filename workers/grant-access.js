/**
 * WORKER 3: grant-access.js
 * Deploy as a Cloudflare Worker at:
 *   https://wakeupandproduce.com/api/grant-access
 *
 * Required KV binding (same namespace as the Zoho checkout/webhook workers):
 *   Variable name: PAID_USERS
 *
 * Required environment variable (encrypted secret):
 *   ADMIN_TOKEN  — generate with: openssl rand -hex 32
 *
 * Endpoints:
 *   POST   /api/grant-access        — grant access to an email
 *   DELETE /api/grant-access        — revoke access from an email
 *   GET    /api/grant-access?list=1 — list all manually-granted accounts
 */

export default {
  async fetch(request, env) {

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token || token !== env.ADMIN_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);

    // LIST — GET /api/grant-access?list=1
    if (request.method === 'GET' && url.searchParams.get('list') === '1') {
      const keys = await env.PAID_USERS.list({ prefix: 'free:' });
      const entries = keys.keys.map(k => ({
        email: k.name.replace('free:', ''),
        ...k.metadata,
      }));
      return json({ free_access: entries });
    }

    // GRANT — POST /api/grant-access
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const email = body.email?.toLowerCase().trim();
      const note = body.note || '';

      if (!email || !email.includes('@')) {
        return json({ error: 'Valid email required' }, 400);
      }

      const record = {
        granted_at: new Date().toISOString(),
        mode: 'free',
        note,
      };

      // Store under email key (checked by access-evaluator) and free: prefix (for listing)
      await env.PAID_USERS.put(email, JSON.stringify(record));
      await env.PAID_USERS.put(`free:${email}`, JSON.stringify(record));

      return json({ success: true, email, note });
    }

    // REVOKE — DELETE /api/grant-access
    if (request.method === 'DELETE') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const email = body.email?.toLowerCase().trim();
      if (!email) return json({ error: 'Email required' }, 400);

      await env.PAID_USERS.delete(email);
      await env.PAID_USERS.delete(`free:${email}`);

      return json({ success: true, revoked: email });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
