async function externalEvaluation(env, claims) {
  const email = claims.identity && claims.identity.email
    ? claims.identity.email.toLowerCase()
    : "";

  if (!email) return false;

  return (await env.PAID_USERS.get(email)) !== null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/keys")) {
      return handleKeysRequest(env);
    }

    return handleExternalEvaluationRequest(env, request);
  },
};

const KV_SIGNING_KEY = "external_auth_keys";

const base64url = {
  stringify(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  },
  parse(value) {
    value = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    return new Uint8Array(Array.prototype.map.call(atob(value), (char) => char.charCodeAt(0)));
  },
};

function asciiToUint8Array(str) {
  const chars = [];
  for (let i = 0; i < str.length; i++) chars.push(str.charCodeAt(i));
  return new Uint8Array(chars);
}

async function generateKID(publicKey) {
  const msgUint8 = new TextEncoder().encode(publicKey);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 64);
}

async function fetchAccessPublicKey(env, kid) {
  const resp = await fetch(`https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`);
  const keys = await resp.json();
  const jwk = keys.keys.find((key) => key.kid === kid);

  if (!jwk) throw new Error("Access signing key not found");

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function generateKeys(env) {
  const keypair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const publicKey = await crypto.subtle.exportKey("jwk", keypair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keypair.privateKey);
  const kid = await generateKID(JSON.stringify(publicKey));

  await env.KV.put(KV_SIGNING_KEY, JSON.stringify({ public: publicKey, private: privateKey, kid }));

  return { publicKey, kid };
}

async function loadSigningKey(env) {
  const keyset = await env.KV.get(KV_SIGNING_KEY, "json");
  if (!keyset) throw new Error("Signing key missing. Visit /keys first.");

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    keyset.private,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return { kid: keyset.kid, privateKey };
}

async function loadPublicKey(env) {
  const key = await env.KV.get(KV_SIGNING_KEY, "json");
  if (key) return { kid: key.kid, ...key.public };

  const { publicKey, kid } = await generateKeys(env);
  return { kid, ...publicKey };
}

async function signJWT(env, payload) {
  const { kid, privateKey } = await loadSigningKey(env);
  const header = { alg: "RS256", kid };
  const encodedHeader = base64url.stringify(asciiToUint8Array(JSON.stringify(header)));
  const encodedPayload = base64url.stringify(asciiToUint8Array(JSON.stringify(payload)));
  const encoded = `${encodedHeader}.${encodedPayload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, asciiToUint8Array(encoded)),
  );

  return `${encoded}.${base64url.stringify(signature)}`;
}

function parseJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token must have 3 parts");

  const decoder = new TextDecoder("utf-8");
  return {
    to_be_validated: `${parts[0]}.${parts[1]}`,
    header: JSON.parse(decoder.decode(base64url.parse(parts[0]))),
    payload: JSON.parse(decoder.decode(base64url.parse(parts[1]))),
    signature: parts[2],
  };
}

async function verifyToken(env, token) {
  const jwt = parseJWT(token);
  const key = await fetchAccessPublicKey(env, jwt.header.kid);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64url.parse(jwt.signature),
    asciiToUint8Array(jwt.to_be_validated),
  );

  if (!verified) throw new Error("Token verification failed");
  if (jwt.payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");

  return jwt.payload;
}

async function handleKeysRequest(env) {
  const keys = await loadPublicKey(env);
  return new Response(JSON.stringify({ keys: [keys] }), {
    headers: { "content-type": "application/json" },
  });
}

async function handleExternalEvaluationRequest(env, request) {
  const now = Math.round(Date.now() / 1000);
  const result = { success: false, iat: now, exp: now + 60 };

  try {
    const body = await request.json();
    const claims = await verifyToken(env, body.token);
    result.nonce = claims.nonce;
    result.success = await externalEvaluation(env, claims);

    return new Response(JSON.stringify({ token: await signJWT(env, result) }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
}
