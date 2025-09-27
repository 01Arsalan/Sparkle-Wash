import { signOtpToken, normalizePhone } from './utils/otpToken.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ success: false, message: 'phone required' });

  const normalized = normalizePhone(phone);
  const otp = Math.floor(100000 + Math.random() * 900000);
  const token = signOtpToken(normalized, otp); // signed token includes phone+otp+exp

  // In production: send OTP via SMS and do NOT return it.
  // For dev convenience we return otp and token.
  console.log(`OTP for ${normalized}: ${otp}`);

  return res.status(200).json({ success: true, message: 'OTP generated', otp, token });
}