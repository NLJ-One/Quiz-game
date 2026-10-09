import crypto from 'node:crypto';

const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 5;

function safeStringEqual(left, right) {
  const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
  const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

export function createHostToken(secret, now = Date.now()) {
  if (!secret) throw new Error('SESSION_SECRET est requis pour signer un jeton hôte.');
  const payload = Buffer.from(JSON.stringify({
    role: 'host',
    exp: Math.floor(now / 1000) + TOKEN_LIFETIME_SECONDS
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyHostToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return false;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.role === 'host'
      && Number.isInteger(claims.exp)
      && claims.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function createLoginRateLimiter({ limit = LOGIN_ATTEMPT_LIMIT, windowMs = LOGIN_WINDOW_MS } = {}) {
  const attemptsByIp = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const window = attemptsByIp.get(ip);
    const current = !window || now - window.startedAt >= windowMs
      ? { startedAt: now, count: 0 }
      : window;

    if (!window && attemptsByIp.size >= 2048) {
      for (const [knownIp, knownWindow] of attemptsByIp) {
        if (now - knownWindow.startedAt >= windowMs) attemptsByIp.delete(knownIp);
      }
      if (attemptsByIp.size >= 2048) {
        attemptsByIp.delete(attemptsByIp.keys().next().value);
      }
    }

    if (current.count >= limit) {
      return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans une minute.' });
    }

    current.count += 1;
    attemptsByIp.set(ip, current);
    return next();
  };
}

export function createLoginHandler({ hostPassword, sessionSecret }) {
  return (req, res) => {
    if (!hostPassword || !sessionSecret) {
      return res.status(503).json({ error: 'L’authentification host n’est pas configurée sur le serveur.' });
    }

    const password = req.body?.password;
    if (typeof password !== 'string' || !safeStringEqual(password, hostPassword)) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    return res.json({ token: createHostToken(sessionSecret) });
  };
}

export function requireHost(secret) {
  return (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match || !verifyHostToken(match[1], secret)) {
      return res.status(401).json({ error: 'Authentification hôte requise.' });
    }

    req.hostToken = match[1];
    return next();
  };
}
