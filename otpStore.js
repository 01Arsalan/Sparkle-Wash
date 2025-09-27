// otpStore.js
const otpStore = new Map(); // key: phone, value: { otp, expiresAt }

function saveOtp(phone, otp, ttl = 5 * 60 * 1000) { // 5 min TTL
  const expiresAt = Date.now() + ttl;
  otpStore.set(phone, { otp, expiresAt });
}

function verifyOtp(phone, otp) {
  const record = otpStore.get(phone);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  if (String(record.otp) === String(otp)) {
    otpStore.delete(phone);
    return true;
  }
  return false;
}

module.exports = { saveOtp, verifyOtp };
