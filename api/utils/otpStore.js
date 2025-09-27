// Simple in-memory OTP store (dev only). ESM module shared by api functions.
export const otpStore = new Map(); // phone -> { otp, expiresAt }

export function saveOtp(phone, otp, ttl = 5 * 60 * 1000) {
  const expiresAt = Date.now() + ttl;
  otpStore.set(phone, { otp, expiresAt });
}

export function verifyOtp(phone, otp) {
  const rec = otpStore.get(phone);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) { otpStore.delete(phone); return false; }
  if (String(rec.otp) === String(otp)) { otpStore.delete(phone); return true; }
  return false;
}