/**
 * Producer Community invite request worker
 * Route: https://wakeupandproduce.com/api/community-request*
 *
 * Required KV binding:
 *   COMMUNITY_INVITES
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (request.method === 'GET') {
      return listRequests(request, env);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, request);
    }

    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const name = normalizeText(body.name, 100);
    const role = normalizeText(body.role, 80);
    const note = normalizeText(body.note, 500);

    if (!email) {
      return json({ error: 'Valid email required' }, 400, request);
    }

    const now = new Date().toISOString();
    const key = `request:${email}`;
    const record = {
      email,
      name,
      role,
      note,
      requested_at: now,
      source: 'producer_community_page',
      status: 'pending_invite',
    };

    await env.COMMUNITY_INVITES.put(key, JSON.stringify(record));
    await env.COMMUNITY_INVITES.put(`requested_at:${now}:${email}`, key);

    return json({ success: true, email }, 200, request);
  },
};

async function listRequests(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: 'Unauthorized' }, 401, request);
  }

  const keys = await env.COMMUNITY_INVITES.list({ prefix: 'request:' });
  const requests = [];
  for (const key of keys.keys) {
    const record = await env.COMMUNITY_INVITES.get(key.name, 'json');
    if (record) requests.push(record);
  }

  requests.sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
  return json({ requests }, 200, request);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization',
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
