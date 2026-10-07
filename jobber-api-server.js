'use strict';

const express = require('express');
const crypto = require('crypto');
const { createClient } = require('redis');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.PORT || 10000);
const RAW_JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID || '';
const RAW_JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET || '';
const RAW_JOBBER_REDIRECT_URI = process.env.JOBBER_REDIRECT_URI || '';
const JOBBER_CLIENT_ID = RAW_JOBBER_CLIENT_ID.trim();
const JOBBER_CLIENT_SECRET = RAW_JOBBER_CLIENT_SECRET.trim();
const JOBBER_REDIRECT_URI = RAW_JOBBER_REDIRECT_URI.trim();
const JOBBER_GRAPHQL_VERSION = process.env.JOBBER_GRAPHQL_VERSION || '2026-09-25';
const TITUS_PAIRING_PIN = process.env.TITUS_PAIRING_PIN || '';
const MAX_CLIENT_SCAN = Math.max(100, Math.min(5000, Number(process.env.MAX_CLIENT_SCAN || 1000)));
const TOKEN_KEY = 'titus:jobber:connection';
const DEVICE_TTL_SECONDS = 60 * 60 * 24 * 180;
const DEFAULT_ORIGINS = ['https://titus.revivepaverrestoration.com', 'https://revive-titus.onrender.com'];
const ALLOWED_ORIGINS = new Set(
  (process.env.APP_ORIGINS || DEFAULT_ORIGINS.join(','))
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

let redis = null;
let redisError = null;

function jsonError(res, status, code, message, extra = {}) {
  return res.status(status).json({ ok: false, code, message, ...extra });
}

function originAllowed(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return originAllowed(origin) ? res.sendStatus(204) : res.sendStatus(403);
  if (!originAllowed(origin)) return jsonError(res, 403, 'ORIGIN_NOT_ALLOWED', 'This request did not come from an approved TITUS app origin.');
  next();
});

function requiredConfig() {
  const missing = [];
  if (!process.env.REDIS_URL) missing.push('REDIS_URL');
  if (!JOBBER_CLIENT_ID) missing.push('JOBBER_CLIENT_ID');
  if (!JOBBER_CLIENT_SECRET) missing.push('JOBBER_CLIENT_SECRET');
  if (!JOBBER_REDIRECT_URI) missing.push('JOBBER_REDIRECT_URI');
  if (!TITUS_PAIRING_PIN) missing.push('TITUS_PAIRING_PIN');
  return missing;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function secureEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatAddress(address = {}) {
  return [address.street1, address.street2, address.city, address.province, address.postalCode]
    .filter(Boolean)
    .join(', ');
}

function safeReturnTo(value) {
  try {
    const url = new URL(value || 'https://titus.revivepaverrestoration.com');
    if (!ALLOWED_ORIGINS.has(url.origin)) return 'https://titus.revivepaverrestoration.com';
    return `${url.origin}${url.pathname || '/'}${url.search || ''}`;
  } catch (_) {
    return 'https://titus.revivepaverrestoration.com';
  }
}

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    redisError = new Error('REDIS_URL is not configured.');
    return;
  }
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', err => { redisError = err; console.error('Redis error:', err.message); });
  await redis.connect();
  redisError = null;
}

async function redisGetJson(key) {
  if (!redis || !redis.isReady) throw redisError || new Error('Secure token store is unavailable.');
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function redisSetJson(key, value, options) {
  if (!redis || !redis.isReady) throw redisError || new Error('Secure token store is unavailable.');
  return redis.set(key, JSON.stringify(value), options);
}

async function requireDevice(req, res, next) {
  try {
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return jsonError(res, 401, 'PAIR_REQUIRED', 'This iPad is not paired with the TITUS Jobber bridge.');
    const exists = await redis.get(`titus:device:${sha256(token)}`);
    if (!exists) return jsonError(res, 401, 'PAIR_REQUIRED', 'This TITUS device pairing is missing or expired.');
    req.deviceToken = token;
    next();
  } catch (err) {
    return jsonError(res, 503, 'TOKEN_STORE_UNAVAILABLE', err.message);
  }
}

app.get('/health', async (req, res) => {
  const missing = requiredConfig();
  const storeReady = Boolean(redis && redis.isReady);
  res.status(missing.length || !storeReady ? 503 : 200).json({
    ok: missing.length === 0 && storeReady,
    service: 'Revive TITUS Jobber Bridge',
    redis: storeReady ? 'ready' : 'unavailable',
    missingConfig: missing,
    graphqlVersion: JOBBER_GRAPHQL_VERSION
  });
});

app.post('/api/pair', async (req, res) => {
  try {
    if (!TITUS_PAIRING_PIN) {
      console.warn('Pairing rejected: TITUS_PAIRING_PIN is not configured.');
      return jsonError(res, 503, 'PAIRING_NOT_CONFIGURED', 'TITUS device pairing is not configured yet.');
    }
    const attemptKey = `titus:pair-attempt:${sha256(req.ip || 'unknown')}`;
    const attempts = Number(await redis.get(attemptKey) || 0);
    if (attempts >= 6) {
      console.warn('Pairing locked for IP hash', sha256(req.ip || 'unknown').slice(0, 10));
      return jsonError(res, 429, 'PAIRING_LOCKED', 'Too many setup PIN attempts. Wait 10 minutes and try again.');
    }
    if (!secureEqual(req.body?.pin || '', TITUS_PAIRING_PIN)) {
      const next = await redis.incr(attemptKey);
      if (next === 1) await redis.expire(attemptKey, 600);
      console.warn('Pairing failed: bad PIN for IP hash', sha256(req.ip || 'unknown').slice(0, 10));
      return jsonError(res, 403, 'BAD_PIN', 'That TITUS setup PIN is not correct.');
    }
    await redis.del(attemptKey).catch(() => {});
    const token = b64url(crypto.randomBytes(32));
    const tokenHash = sha256(token);
    await redis.set(`titus:device:${tokenHash}`, '1', { EX: DEVICE_TTL_SECONDS });
    console.log('Pairing succeeded for device', tokenHash.slice(0, 10));
    res.json({ ok: true, deviceToken: token, expiresInDays: 180 });
  } catch (err) {
    jsonError(res, 503, 'PAIR_FAILED', err.message);
  }
});

async function directGraphql(accessToken, query, variables = {}) {
  const response = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-JOBBER-GRAPHQL-VERSION': JOBBER_GRAPHQL_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (_) { body = { errors: [{ message: text || `HTTP ${response.status}` }] }; }
  return { response, body };
}

async function exchangeToken(params) {
  const response = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch (_) {}
  if (!response.ok || !body.access_token) {
    const detail = String(body.error_description || body.error || raw || `HTTP ${response.status}`).trim().slice(0, 300);
    console.error('Jobber token exchange rejected', {
      status: response.status,
      detail,
      grantType: params.grant_type || '',
      clientIdLength: JOBBER_CLIENT_ID.length,
      clientSecretLength: JOBBER_CLIENT_SECRET.length,
      trimmedClientIdWhitespace: RAW_JOBBER_CLIENT_ID !== JOBBER_CLIENT_ID,
      trimmedClientSecretWhitespace: RAW_JOBBER_CLIENT_SECRET !== JOBBER_CLIENT_SECRET,
      redirectUri: JOBBER_REDIRECT_URI,
      hasCodeVerifier: Boolean(params.code_verifier)
    });
    throw new Error(`Jobber token exchange failed (${response.status}): ${detail}`);
  }
  return body;
}

async function saveTokens(tokens, account) {
  const existing = await redisGetJson(TOKEN_KEY).catch(() => null);
  const refreshToken = tokens.refresh_token || existing?.refreshToken;
  if (!refreshToken) throw new Error('Jobber did not return a refresh token.');
  const payload = {
    accessToken: tokens.access_token,
    refreshToken,
    tokenType: tokens.token_type || 'Bearer',
    expiresAt: Date.now() + (Number(tokens.expires_in || 3600) * 1000),
    account: account || existing?.account || null,
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await redisSetJson(TOKEN_KEY, payload);
  return payload;
}

async function refreshConnection(force = false) {
  let current = await redisGetJson(TOKEN_KEY);
  if (!current?.refreshToken) throw new Error('Jobber is not connected.');
  if (!force && current.accessToken && current.expiresAt > Date.now() + 120000) return current;

  const lockId = b64url(crypto.randomBytes(12));
  const gotLock = await redis.set('titus:jobber:refresh-lock', lockId, { NX: true, EX: 15 });
  if (!gotLock) {
    await new Promise(resolve => setTimeout(resolve, 800));
    current = await redisGetJson(TOKEN_KEY);
    if (current?.accessToken && current.expiresAt > Date.now() + 60000) return current;
  }

  try {
    const latest = await redisGetJson(TOKEN_KEY);
    if (!force && latest?.accessToken && latest.expiresAt > Date.now() + 120000) return latest;
    const tokens = await exchangeToken({
      client_id: JOBBER_CLIENT_ID,
      client_secret: JOBBER_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: latest.refreshToken
    });
    return saveTokens(tokens, latest.account);
  } finally {
    if (gotLock) {
      const owner = await redis.get('titus:jobber:refresh-lock').catch(() => null);
      if (owner === lockId) await redis.del('titus:jobber:refresh-lock').catch(() => {});
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function throttleWaitMs(body) {
  const cost = body?.extensions?.cost || {};
  const status = cost.throttleStatus || {};
  const requested = Number(cost.requestedQueryCost || 0);
  const available = Number(status.currentlyAvailable || 0);
  const maximum = Number(status.maximumAvailable || 0);
  const restoreRate = Number(status.restoreRate || 0);
  if (maximum > 0 && requested > maximum) return null;
  if (restoreRate > 0 && requested > available) {
    return Math.min(10000, Math.max(500, Math.ceil(((requested - available) / restoreRate) * 1000) + 250));
  }
  return 750;
}

async function jobberGraphql(query, variables = {}) {
  let connection = await refreshConnection(false);
  let authRetried = false;

  for (let throttleAttempt = 0; throttleAttempt < 4; throttleAttempt += 1) {
    let result = await directGraphql(connection.accessToken, query, variables);
    if (result.response.status === 401 && !authRetried) {
      authRetried = true;
      connection = await refreshConnection(true);
      result = await directGraphql(connection.accessToken, query, variables);
    }
    if (!result.response.ok) throw new Error(result.body?.errors?.[0]?.message || `Jobber API returned HTTP ${result.response.status}`);

    const throttled = (result.body.errors || []).find(error =>
      error?.extensions?.code === 'THROTTLED' || String(error?.message || '').toLowerCase() === 'throttled'
    );
    if (throttled) {
      const waitMs = throttleWaitMs(result.body);
      const cost = result.body?.extensions?.cost || {};
      const status = cost.throttleStatus || {};
      if (waitMs == null) {
        throw new Error(`Jobber rejected an over-sized query (requested cost ${cost.requestedQueryCost || 'unknown'}, maximum ${status.maximumAvailable || 'unknown'}).`);
      }
      if (throttleAttempt >= 3) {
        const err = new Error('Jobber is temporarily rate limiting this lookup. Wait a few seconds and try again.');
        err.graphqlErrors = result.body.errors;
        throw err;
      }
      console.warn('Jobber GraphQL throttled; retrying', {
        attempt: throttleAttempt + 1,
        waitMs,
        requestedQueryCost: cost.requestedQueryCost || null,
        currentlyAvailable: status.currentlyAvailable || null,
        maximumAvailable: status.maximumAvailable || null,
        restoreRate: status.restoreRate || null
      });
      await sleep(waitMs);
      continue;
    }

    if (result.body.errors?.length) {
      const err = new Error(result.body.errors.map(e => e.message).join(' | '));
      err.graphqlErrors = result.body.errors;
      throw err;
    }
    return result.body.data;
  }

  throw new Error('Jobber lookup could not complete.');
}

app.get('/api/jobber/status', requireDevice, async (req, res) => {
  try {
    const connection = await redisGetJson(TOKEN_KEY);
    if (!connection?.refreshToken) return res.json({ ok: true, connected: false });
    try {
      const active = await refreshConnection(false);
      return res.json({ ok: true, connected: true, account: active.account || null });
    } catch (err) {
      return res.json({ ok: true, connected: false, reconnectRequired: true, message: err.message });
    }
  } catch (err) {
    jsonError(res, 503, 'STATUS_FAILED', err.message);
  }
});

app.post('/api/jobber/connect-url', requireDevice, async (req, res) => {
  try {
    const missing = requiredConfig().filter(key => ['JOBBER_CLIENT_ID','JOBBER_CLIENT_SECRET','JOBBER_REDIRECT_URI'].includes(key));
    if (missing.length) return jsonError(res, 503, 'JOBBER_APP_NOT_CONFIGURED', `Jobber app setup is not finished yet: ${missing.join(', ')}`);
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(24));
    const returnTo = safeReturnTo(req.body?.returnTo);
    await redisSetJson(`titus:oauth:${state}`, { verifier, returnTo }, { EX: 600 });

    const url = new URL('https://api.getjobber.com/api/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', JOBBER_CLIENT_ID);
    url.searchParams.set('redirect_uri', JOBBER_REDIRECT_URI);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    res.json({ ok: true, url: url.toString() });
  } catch (err) {
    jsonError(res, 500, 'CONNECT_URL_FAILED', err.message);
  }
});

app.get('/api/jobber/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  let returnTo = 'https://titus.revivepaverrestoration.com';
  try {
    if (!code || !state) throw new Error('Missing Jobber authorization code or state.');
    const flow = await redisGetJson(`titus:oauth:${state}`);
    if (!flow?.verifier) throw new Error('This Jobber authorization link expired or was already used.');
    returnTo = safeReturnTo(flow.returnTo);
    await redis.del(`titus:oauth:${state}`);

    const tokens = await exchangeToken({
      client_id: JOBBER_CLIENT_ID,
      client_secret: JOBBER_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: JOBBER_REDIRECT_URI,
      code_verifier: flow.verifier
    });

    const accountResult = await directGraphql(tokens.access_token, 'query TITUSAccount { account { id name } }');
    if (!accountResult.response.ok || accountResult.body.errors?.length) {
      throw new Error(accountResult.body.errors?.[0]?.message || 'Could not verify the connected Jobber account.');
    }
    await saveTokens(tokens, accountResult.body.data.account);
    console.log('Jobber OAuth connected', {
      accountId: accountResult.body.data.account?.id || null,
      accountName: accountResult.body.data.account?.name || null,
      hasRefreshToken: Boolean(tokens.refresh_token),
      accessTokenExpiresIn: Number(tokens.expires_in || 0)
    });
    const redirect = new URL(returnTo);
    redirect.searchParams.set('jobber', 'connected');
    res.redirect(302, redirect.toString());
  } catch (err) {
    console.error('OAuth callback failed:', err);
    const redirect = new URL(returnTo);
    redirect.searchParams.set('jobber', 'error');
    redirect.searchParams.set('message', String(err.message || 'Jobber connection failed. Please try again.').slice(0, 240));
    res.redirect(302, redirect.toString());
  }
});

async function fetchClientBasicsForMatch() {
  const nodes = [];
  let after = null;
  while (nodes.length < MAX_CLIENT_SCAN) {
    const remaining = MAX_CLIENT_SCAN - nodes.length;
    const pageSize = Math.min(100, remaining);
    const data = await jobberGraphql(`
      query TITUSClientBasics($after: String, $first: Int!) {
        clients(first: $first, after: $after) {
          nodes {
            id name firstName lastName companyName email phone isArchived jobberWebUri
          }
          pageInfo { hasNextPage endCursor }
        }
      }`, { after, first: pageSize });
    const page = data.clients;
    nodes.push(...(page?.nodes || []));
    if (!page?.pageInfo?.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }
  return nodes.slice(0, MAX_CLIENT_SCAN);
}

async function fetchClientWithProperties(clientId) {
  const data = await jobberGraphql(`
    query TITUSClientDetails($id: EncodedId!) {
      client(id: $id) {
        id name firstName lastName companyName email phone isArchived jobberWebUri
        clientProperties(first: 20) {
          nodes {
            id name jobberWebUri
            address { street1 street2 city province postalCode country }
          }
        }
      }
    }`, { id: clientId });
  return data.client;
}

function scoreClient(client, wanted) {
  let score = 0;
  const reasons = [];
  const email = normalizeEmail(client.email);
  const phone = normalizePhone(client.phone);
  const name = normalizeName(client.name || `${client.firstName || ''} ${client.lastName || ''}`);
  const wantedEmail = normalizeEmail(wanted.email);
  const wantedPhone = normalizePhone(wanted.phone);
  const wantedName = normalizeName(wanted.name);
  const wantedAddress = normalizeText(wanted.address);

  if (wantedEmail && email && wantedEmail === email) { score += 140; reasons.push('email'); }
  if (wantedPhone && phone && wantedPhone === phone) { score += 140; reasons.push('phone'); }
  if (wantedName && name && wantedName === name) { score += 60; reasons.push('name'); }
  else if (wantedName && name && (name.includes(wantedName) || wantedName.includes(name))) { score += 20; reasons.push('name partial'); }

  let bestPropertyScore = 0;
  for (const property of client.clientProperties?.nodes || []) {
    const full = normalizeText(formatAddress(property.address));
    const street = normalizeText(property.address?.street1);
    if (wantedAddress && full && (wantedAddress === full || wantedAddress.includes(full) || full.includes(wantedAddress))) bestPropertyScore = Math.max(bestPropertyScore, 110);
    else if (wantedAddress && street && (wantedAddress.includes(street) || street.includes(wantedAddress))) bestPropertyScore = Math.max(bestPropertyScore, 95);
  }
  if (bestPropertyScore) { score += bestPropertyScore; reasons.push('address'); }
  if (client.isArchived) score -= 80;
  return { score, reasons };
}

function publicProperty(property) {
  return {
    id: property.id,
    name: property.name || null,
    jobberWebUri: property.jobberWebUri,
    address: property.address || {},
    formattedAddress: formatAddress(property.address)
  };
}

function publicClient(client, scoreInfo) {
  return {
    id: client.id,
    name: client.name,
    email: client.email || null,
    phone: client.phone || null,
    archived: Boolean(client.isArchived),
    jobberWebUri: client.jobberWebUri,
    score: scoreInfo?.score || 0,
    matchedOn: scoreInfo?.reasons || [],
    properties: (client.clientProperties?.nodes || []).map(publicProperty)
  };
}

function pickProperty(properties, projectAddress) {
  if (!properties.length) return { status: 'none' };
  if (properties.length === 1) return { status: 'one', property: properties[0] };
  const wanted = normalizeText(projectAddress);
  if (wanted) {
    const scored = properties.map(property => {
      const full = normalizeText(formatAddress(property.address));
      const street = normalizeText(property.address?.street1);
      let score = 0;
      if (full && (wanted === full || wanted.includes(full) || full.includes(wanted))) score = 110;
      else if (street && (wanted.includes(street) || street.includes(wanted))) score = 95;
      return { property, score };
    }).sort((a,b) => b.score - a.score);
    if (scored[0]?.score >= 95 && scored[0].score > (scored[1]?.score || 0)) return { status: 'one', property: scored[0].property };
  }
  return { status: 'many', properties };
}

app.post('/api/jobber/match', requireDevice, async (req, res) => {
  try {
    const wanted = {
      name: req.body?.name || '',
      email: req.body?.email || '',
      phone: req.body?.phone || '',
      address: req.body?.address || ''
    };
    if (!wanted.name && !wanted.email && !wanted.phone && !wanted.address) {
      return jsonError(res, 400, 'MATCH_INPUT_REQUIRED', 'Enter at least a customer name, email, phone, or project address in TITUS first.');
    }
    const clients = await fetchClientBasicsForMatch();
    const identityRanked = clients
      .map(client => ({ client, ...scoreClient(client, wanted) }))
      .filter(row => row.score > 0)
      .sort((a,b) => b.score - a.score);

    if (!identityRanked.length) return res.json({ ok: true, status: 'not_found', scanned: clients.length });

    const candidates = [];
    for (const row of identityRanked.slice(0, 8)) {
      const detailed = await fetchClientWithProperties(row.client.id);
      if (!detailed) continue;
      candidates.push({ client: detailed, ...scoreClient(detailed, wanted) });
    }
    const ranked = candidates
      .filter(row => row.score > 0)
      .sort((a,b) => b.score - a.score);

    if (!ranked.length) return res.json({ ok: true, status: 'not_found', scanned: clients.length });
    const top = ranked[0];
    const second = ranked[1];
    const strongUnique = top.score >= 100 && top.score >= ((second?.score || 0) + 20);

    if (!strongUnique) {
      return res.json({
        ok: true,
        status: 'choose_client',
        matches: ranked.slice(0, 8).map(row => publicClient(row.client, row))
      });
    }

    const client = publicClient(top.client, top);
    const propertyPick = pickProperty(client.properties, wanted.address);
    if (propertyPick.status === 'none') {
      const alternatives = ranked
        .slice(1, 8)
        .map(row => publicClient(row.client, row))
        .filter(candidate => candidate.properties?.length);
      if (alternatives.length) {
        return res.json({
          ok: true,
          status: 'choose_client',
          reason: 'top_match_has_no_property',
          matches: [client, ...alternatives].slice(0, 8)
        });
      }
      return res.json({ ok: true, status: 'no_property', client });
    }
    if (propertyPick.status === 'many') return res.json({ ok: true, status: 'choose_property', client, properties: propertyPick.properties });
    return res.json({ ok: true, status: 'matched', client, property: propertyPick.property });
  } catch (err) {
    console.error('Match failed:', err);
    jsonError(res, 502, 'MATCH_FAILED', err.message);
  }
});

async function introspectNamedType(name) {
  const data = await jobberGraphql(`
    query TITUSType($name: String!) {
      __type(name: $name) {
        kind name
        inputFields {
          name defaultValue
          type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
        }
        fields(includeDeprecated: true) {
          name
          args { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } }
          type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
        }
      }
    }`, { name });
  return data.__type;
}

function unwrapTypeName(type) {
  let t = type;
  while (t && !t.name) t = t.ofType;
  return t?.name || null;
}

function isRequired(field) {
  return field?.type?.kind === 'NON_NULL' && field.defaultValue == null;
}

let quoteSchemaCache = null;
async function quoteSchema() {
  if (quoteSchemaCache) return quoteSchemaCache;
  const mutation = await introspectNamedType('Mutation');
  const quoteCreate = mutation?.fields?.find(f => f.name === 'quoteCreate');
  if (!quoteCreate) throw new Error('The connected Jobber API version does not expose quoteCreate. Check the Quotes write scope.');
  const arg = quoteCreate.args.find(a => a.name === 'input') || quoteCreate.args.find(a => a.name === 'attributes') || quoteCreate.args[0];
  if (!arg) throw new Error('Could not determine the quoteCreate input argument.');
  const quoteInputName = unwrapTypeName(arg.type);
  const quoteInput = await introspectNamedType(quoteInputName);
  const lineItemsField = quoteInput?.inputFields?.find(f => f.name === 'lineItems');
  if (!lineItemsField) throw new Error(`Jobber ${quoteInputName} does not expose lineItems.`);
  const lineItemInputName = unwrapTypeName(lineItemsField.type);
  const lineItemInput = await introspectNamedType(lineItemInputName);
  quoteSchemaCache = { argName: arg.name, quoteInputName, quoteInput, lineItemInputName, lineItemInput };
  return quoteSchemaCache;
}

// Live Jobber Products & Services mapping used by TITUS quote lines.
// The IDs come from Revive's active Jobber catalog. We fetch the CURRENT
// Jobber description at quote creation so edits in Jobber automatically flow
// into future TITUS-created drafts without duplicating copy in the PWA.
const JOBBER_SERVICE_IDS = Object.freeze({
  'Fence Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvMjY4OTUwNzM=',
  'Curb Cleaning & Sealing – Landscape/Flower Bed Edging': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvMzQwODgwMjQ=',
  'Complete Paver Restoration & Sealing': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzIzOTc=',
  'Lanai & Pool Deck Paver Restoration & Sealing': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzIzOTg=',
  'Paver Cleaning Only': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzIzOTk=',
  'Paver Joint Re-Sanding': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDA=',
  'Paver Repair & Re-Leveling': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDE=',
  'Paver Sealer Stripping & Surface Restoration': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDI=',
  'Natural Stone Restoration & Nano Enhancement Treatment': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDM=',
  'Shellock Paver Cleaning & Sealing': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDQ=',
  'Color Revival': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDU=',
  'Joint Tone Enhancement / Premium Dyed Sand': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDY=',
  'Accent Border Pop': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDc=',
  'Designer Accent Finish': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDg=',
  'Full Metallic Veil / Metal Flake Finish': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MDk=',
  'Diamond Dust Anti-Slip Treatment': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTA=',
  'Professional Concrete Cleaning & Protective Sealing': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTE=',
  'Driveway Pressure Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTI=',
  'Sidewalk & Street Curb Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTM=',
  'Front Porch & Entry Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTQ=',
  'Lanai, Patio & Pool Deck Floor Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTU=',
  'Pool Cage & Screen Enclosure Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTY=',
  'House Soft Wash': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTc=',
  'Roof Soft Wash': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTg=',
  'Gutter Interior Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MTk=',
  'Exterior Gutter Brightening': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjA=',
  'Fence Staining & Protection': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjE=',
  'Landscape Curb & Flower Bed Edging Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjI=',
  'Revive Entry Refresh Package': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjM=',
  'Revive Curb Appeal Package': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjQ=',
  'Revive Outdoor Living Refresh Package': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjU=',
  'Revive Whole Property Package': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MjY=',
  'Revive Roof & House Refresh Package': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0Mjc=',
  'Revive Complete Home Care Package': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0Mjg=',
  'Rust Treatment': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0Mjk=',
  'Efflorescence Treatment': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzA=',
  'Oil & Grease Stain Treatment': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzE=',
  'Professional French Drain Cleanout': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzI=',
  'Recurring Revive Program': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzM=',
  'Commercial Exterior Pressure Washing': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzQ=',
  'Commercial Parking Garage Cleaning': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzU=',
  'One-Time Pool Clean & Chemical Balance': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0MzY=',
  'Custom Scope / Additional Work': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzI0Mzc=',
  'Front Driveway Paver Restoration & Sealing': 'Z2lkOi8vSm9iYmVyL1Byb2R1Y3RPclNlcnZpY2UvNTM5MzYzOTI='
});

// TITUS uses a few shorter field labels than the saved Jobber catalog names.
const TITUS_JOBBER_SERVICE_ALIASES = Object.freeze({
  'Joint Tone Enhancement': 'Joint Tone Enhancement / Premium Dyed Sand'
});

const catalogItemCache = new Map();

function mappedJobberServiceName(titusName) {
  return TITUS_JOBBER_SERVICE_ALIASES[titusName] || titusName;
}

function jobberServiceIdForLine(titusName) {
  return JOBBER_SERVICE_IDS[mappedJobberServiceName(titusName)] || '';
}

function graphQlString(value) {
  return JSON.stringify(String(value || ''));
}

async function catalogItemsForLines(lines = []) {
  const requested = [];
  const seen = new Set();
  for (const line of lines) {
    const titusName = String(line?.name || '');
    const serviceName = mappedJobberServiceName(titusName);
    const id = jobberServiceIdForLine(titusName);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cached = catalogItemCache.get(id);
    if (cached) continue;
    requested.push({ id, serviceName });
  }

  if (requested.length) {
    try {
      const fields = requested.map((entry, index) =>
        `i${index}: productOrService(id: ${graphQlString(entry.id)}) { id name description taxable }`
      ).join('\n');
      const data = await jobberGraphql(`query TITUSCatalogItems {\n${fields}\n}`);
      requested.forEach((entry, index) => {
        const item = data?.[`i${index}`];
        if (item?.id) catalogItemCache.set(entry.id, item);
      });
    } catch (err) {
      console.warn('Jobber service description lookup skipped:', err.message);
    }
  }

  const byTitusName = new Map();
  for (const line of lines) {
    const titusName = String(line?.name || '');
    const id = jobberServiceIdForLine(titusName);
    const item = id ? catalogItemCache.get(id) : null;
    if (item) byTitusName.set(normalizeName(titusName), item);
  }
  return byTitusName;
}

function appendProjectDetail(description, detail) {
  const cleanDetail = String(detail || '').trim();
  const generic = new Set([
    'flat project price',
    'saved jobber service',
    'revive saved package'
  ]);
  if (!cleanDetail || generic.has(cleanDetail.toLowerCase())) return description || '';
  const detailLine = `Project details: ${cleanDetail}`;
  return description ? `${description}\n\n${detailLine}` : detailLine;
}

function requiredUnknownFields(fields, supportedNames) {
  return (fields || []).filter(field => isRequired(field) && !supportedNames.has(field.name)).map(field => field.name);
}

async function createJobberQuote({ clientId, propertyId, title, lines, expectedTotal }) {
  const schema = await quoteSchema();
  const quoteFields = new Set((schema.quoteInput.inputFields || []).map(f => f.name));
  const lineFields = new Set((schema.lineItemInput.inputFields || []).map(f => f.name));

  const quoteSupported = new Set(['clientId','propertyId','title','message','lineItems','contractDisclaimer']);
  const lineSupported = new Set(['name','description','quantity','unitPrice','taxable','productOrServiceId','saveToProductsAndServices','optional','textOnly','category']);
  const quoteUnknown = requiredUnknownFields(schema.quoteInput.inputFields, quoteSupported);
  const lineUnknown = requiredUnknownFields(schema.lineItemInput.inputFields, lineSupported);
  if (quoteUnknown.length || lineUnknown.length) {
    throw new Error(`Jobber's current quote schema has required fields TITUS has not mapped yet: ${[...quoteUnknown, ...lineUnknown].join(', ')}`);
  }

  const catalogByTitusName = await catalogItemsForLines(lines);
  const mappedLines = lines.map(line => {
    const item = catalogByTitusName.get(normalizeName(line.name));
    const payload = {};
    if (lineFields.has('name')) payload.name = item?.name || line.name;
    if (lineFields.has('description')) payload.description = appendProjectDetail(item?.description || '', line.detail);
    if (lineFields.has('quantity')) payload.quantity = 1;
    if (lineFields.has('unitPrice')) payload.unitPrice = Number(line.amount.toFixed(2));
    if (lineFields.has('taxable')) payload.taxable = item?.taxable ?? true;
    if (lineFields.has('productOrServiceId') && item?.id) payload.productOrServiceId = item.id;
    if (lineFields.has('saveToProductsAndServices')) payload.saveToProductsAndServices = false;
    if (lineFields.has('optional')) payload.optional = false;
    if (lineFields.has('textOnly')) payload.textOnly = false;
    if (lineFields.has('category')) payload.category = 'SERVICE';
    return payload;
  });

  const describedCount = mappedLines.filter(line => String(line.description || '').trim() && !String(line.description || '').startsWith('Project details:')).length;
  const linkedCount = mappedLines.filter(line => line.productOrServiceId).length;
  console.info(`Jobber quote catalog enrichment: ${describedCount}/${mappedLines.length} descriptions, ${linkedCount}/${mappedLines.length} linked services`);

  const input = {};
  if (quoteFields.has('clientId')) input.clientId = clientId;
  if (quoteFields.has('propertyId')) input.propertyId = propertyId;
  if (quoteFields.has('title')) input.title = title;
  if (quoteFields.has('lineItems')) input.lineItems = mappedLines;
  if (quoteFields.has('message')) input.message = 'Thank you for the opportunity to restore and care for your property. Please review the scope and pricing below.';

  const mutation = `
    mutation TITUSCreateQuote($payload: ${schema.quoteInputName}!) {
      quoteCreate(${schema.argName}: $payload) {
        quote {
          id quoteNumber title jobberWebUri eligibleForFinancing
          amounts { subtotal taxAmount discountAmount total }
        }
        userErrors { message path }
      }
    }`;
  const data = await jobberGraphql(mutation, { payload: input });
  const result = data.quoteCreate;
  if (result?.userErrors?.length) throw new Error(result.userErrors.map(e => e.message).join(' | '));
  if (!result?.quote?.id) throw new Error('Jobber did not return the new draft quote.');
  const total = Number(result.quote.amounts?.total);
  const mismatch = Number.isFinite(total) && Math.abs(total - Number(expectedTotal || 0)) > 0.01;
  return { ...result.quote, totalMismatch: mismatch, expectedTotal: Number(expectedTotal || 0) };
}

app.post('/api/jobber/quote', requireDevice, async (req, res) => {
  try {
    const clientId = String(req.body?.clientId || '');
    const propertyId = String(req.body?.propertyId || '');
    const title = String(req.body?.title || 'Revive Project Quote').slice(0, 160);
    const expectedTotal = Number(req.body?.expectedTotal || 0);
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    if (!clientId || !propertyId) return jsonError(res, 400, 'CLIENT_PROPERTY_REQUIRED', 'Select the Jobber client and service property first.');
    if (!lines.length || !Number.isFinite(expectedTotal) || expectedTotal <= 0) return jsonError(res, 400, 'QUOTE_SCOPE_REQUIRED', 'Build a priced project in TITUS before creating the Jobber quote.');
    if (lines.some(line => !line?.name || !Number.isFinite(Number(line.amount)) || Number(line.amount) < 0)) {
      return jsonError(res, 400, 'BAD_LINE_ITEM', 'One or more TITUS quote lines are invalid.');
    }

    const fingerprint = sha256(JSON.stringify({ clientId, propertyId, title, expectedTotal, lines }));
    const idemKey = `titus:quote:${fingerprint}`;
    const existing = await redisGetJson(idemKey);
    if (existing?.id) return res.json({ ok: true, duplicatePrevented: true, quote: existing });

    const quote = await createJobberQuote({ clientId, propertyId, title, lines, expectedTotal });
    await redisSetJson(idemKey, quote, { EX: 60 * 60 * 24 });
    res.json({ ok: true, duplicatePrevented: false, quote });
  } catch (err) {
    console.error('Quote create failed:', err);
    jsonError(res, 502, 'QUOTE_CREATE_FAILED', err.message, { graphqlErrors: err.graphqlErrors || undefined });
  }
});

app.use((req, res) => jsonError(res, 404, 'NOT_FOUND', 'Route not found.'));

(async () => {
  try { await connectRedis(); } catch (err) { redisError = err; console.error('Redis startup error:', err.message); }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Revive TITUS Jobber Bridge listening on ${PORT}`);
    const missing = requiredConfig();
    if (missing.length) console.warn(`Missing config: ${missing.join(', ')}`);
  });
})();
