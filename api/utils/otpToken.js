import crypto from 'crypto';

function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}
export function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

const SECRET = process.env.OTP_SECRET || process.env.JWT_SECRET || 'dev-otp-secret-do-not-use-in-prod';

export function signOtpToken(phone, otp, ttl = 5 * 60 * 1000) {
  const payloadObj = { phone: normalizePhone(phone), otp: String(otp), exp: Date.now() + ttl };
  const payloadB = Buffer.from(JSON.stringify(payloadObj));
  const payloadB64 = base64url(payloadB);

  const sig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest();
  const sigB64 = base64url(sig);

  return `${payloadB64}.${sigB64}`;
}

export function verifyOtpToken(token) {
  if (!token || typeof token !== 'string') return { ok: false, error: 'missing token' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'invalid token format' };
  const [payloadB64, sigB64] = parts;

  try {
    const expectedSig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest();
    const sigBuf = base64urlDecode(sigB64);

    if (expectedSig.length !== sigBuf.length || !crypto.timingSafeEqual(expectedSig, sigBuf)) {
      return { ok: false, error: 'invalid signature' };
    }

    const payloadBuf = base64urlDecode(payloadB64);
    const payloadObj = JSON.parse(payloadBuf.toString());

    if (Date.now() > payloadObj.exp) return { ok: false, error: 'token expired' };

    return { ok: true, payload: payloadObj };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'invalid token' };
  }
}