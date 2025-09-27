import { saveOtp } from './utils/otpStore.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ success: false, message: 'phone required' });

  const otp = Math.floor(100000 + Math.random() * 900000);
  saveOtp(phone, otp);
  console.log(`OTP for ${phone}: ${otp}`);

  // Return OTP in response for dev; remove in production
  return res.status(200).json({ success: true, message: 'OTP generated', otp });
}