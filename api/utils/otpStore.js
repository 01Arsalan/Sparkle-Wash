import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

export const otpStore = new Map(); // key: normalizedPhone, value: { otp, expiresAt }

// Resolve a stable file location relative to this module (project root)
// so different serverless function processes use the same file in dev.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..'); // adjust if repo layout differs
const OTP_FILE = path.join(PROJECT_ROOT, 'otp-store.json');

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function persistStore() {
  try {
    if (process.env.NODE_ENV === 'development') {
      const obj = {};
      for (const [k, v] of otpStore.entries()) obj[k] = v;
      fs.writeJSONSync(OTP_FILE, obj, { spaces: 2 });
      console.log(`[OTP] persisted to ${OTP_FILE}`);
    }
  } catch (err) {
    console.warn('Failed to persist OTP store:', err && err.message ? err.message : err);
  }
}

function loadPersistedStore() {
  try {
    if (process.env.NODE_ENV === 'development' && fs.existsSync(OTP_FILE)) {
      const obj = fs.readJSONSync(OTP_FILE);
      for (const k of Object.keys(obj || {})) otpStore.set(k, obj[k]);
      console.log(`[OTP] loaded from ${OTP_FILE}`);
    }
  } catch (err) {
    console.warn('Failed to load persisted OTP store:', err && err.message ? err.message : err);
  }
}

loadPersistedStore();

export function saveOtp(phone, otp, ttl = 5 * 60 * 1000) {
  const key = normalizePhone(phone);
  const expiresAt = Date.now() + ttl;
  otpStore.set(key, { otp, expiresAt });
  persistStore();
  console.log(`[OTP] saved for ${key} (dev only)`);
}

export function verifyOtp(phone, otp) {
  const key = normalizePhone(phone);
  let rec = otpStore.get(key);

  if (!rec && process.env.NODE_ENV === 'development') {
    loadPersistedStore();
    rec = otpStore.get(key);
  }

  if (!rec) {
    console.log(`[OTP] no record for ${key}`);
    return false;
  }

  if (Date.now() > rec.expiresAt) {
    otpStore.delete(key);
    persistStore();
    console.log(`[OTP] expired for ${key}`);
    return false;
  }

  if (String(rec.otp) === String(otp)) {
    otpStore.delete(key);
    persistStore();
    console.log(`[OTP] verified for ${key}`);
    return true;
  }

  console.log(`[OTP] mismatch for ${key} (got ${otp}, expected ${rec.otp})`);
  return false;
}