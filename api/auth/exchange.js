import { createSign, createVerify } from 'node:crypto';

const AUTH_PROJECT_ID = 'test-for-login-macanism';
const DEFAULT_GAME_PROJECT_ID = 'arlecchino-artifact-simulator';
const ALLOWED_ORIGINS = new Set([
  'https://ninu-ganing-game.vercel.app',
  'http://localhost:5173',
]);

let cachedCerts = null;
let cachedCertsUntil = 0;

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64url');
}

function decodeBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function getGoogleSecureTokenCerts() {
  const now = Date.now();
  if (cachedCerts && now < cachedCertsUntil) return cachedCerts;

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );

  if (!response.ok) {
    throw new Error(`Could not fetch Firebase token certificates: HTTP ${response.status}`);
  }

  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = certs;
  cachedCertsUntil = now + Math.min(Math.max(maxAgeSeconds, 300), 21600) * 1000;

  return cachedCerts;
}

async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== 'string') {
    throw new Error('Missing Firebase ID token.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson(encodedHeader);
  const payload = decodeBase64UrlJson(encodedPayload);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Firebase ID token signature.');
  }

  if (payload.aud !== AUTH_PROJECT_ID) {
    throw new Error('Firebase ID token audience does not match the authentication project.');
  }

  if (payload.iss !== `https://securetoken.google.com/${AUTH_PROJECT_ID}`) {
    throw new Error('Firebase ID token issuer does not match the authentication project.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSeconds ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSeconds + 300 ||
    typeof payload.auth_time !== 'number' ||
    payload.auth_time > nowSeconds + 300
  ) {
    throw new Error('Firebase ID token is expired or not yet valid.');
  }

  if (
    typeof payload.sub !== 'string' ||
    payload.sub.length < 1 ||
    payload.sub.length > 128
  ) {
    throw new Error('Firebase ID token has an invalid UID.');
  }

  if (payload.email_verified !== true) {
    throw new Error('Firebase email is not verified.');
  }

  const certs = await getGoogleSecureTokenCerts();
  const certificate = certs[header.kid];

  if (!certificate) {
    cachedCerts = null;
    cachedCertsUntil = 0;
    throw new Error('Signing certificate is not available for this token.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const signature = Buffer.from(encodedSignature, 'base64url');
  if (!verifier.verify(certificate, signature)) {
    throw new Error('Firebase ID token signature is invalid.');
  }

  return payload;
}

function getGameServiceAccount() {
  if (process.env.GAME_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.GAME_SERVICE_ACCOUNT_JSON);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('GAME_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
    }
    return parsed;
  }

  const clientEmail = process.env.GAME_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GAME_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Missing GAME_SERVICE_ACCOUNT_JSON or GAME_SERVICE_ACCOUNT_EMAIL/GAME_SERVICE_ACCOUNT_PRIVATE_KEY.'
    );
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
    project_id: process.env.GAME_PROJECT_ID || DEFAULT_GAME_PROJECT_ID,
  };
}

function signGameCustomToken(uid, claims) {
  const serviceAccount = getGameServiceAccount();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    uid,
    ...claims,
  };

  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(serviceAccount.private_key).toString('base64url');
  return `${unsignedToken}.${signature}`;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

    const sourceToken = body.idToken;
    const decoded = await verifyFirebaseIdToken(sourceToken);

    const gameProjectId = process.env.GAME_PROJECT_ID || DEFAULT_GAME_PROJECT_ID;
    const customToken = signGameCustomToken(decoded.sub, {
      source_project_id: AUTH_PROJECT_ID,
      source_email_verified: true,
      source_email: typeof decoded.email === 'string' ? decoded.email : '',
      game_project_id: gameProjectId,
    });

    return res.status(200).json({
      customToken,
      uid: decoded.sub,
    });
  } catch (error) {
    console.error('Auth exchange failed:', error);
    return res.status(401).json({
      error: 'AUTH_EXCHANGE_FAILED',
    });
  }
}
