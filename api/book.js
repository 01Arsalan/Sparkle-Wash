import fs from 'fs-extra';
import { verifyOtpToken, normalizePhone } from './utils/otpToken.js';
import { appendBooking } from './utils/googleSheets.js';

const BOOKINGS_FILE = 'bookings.json';

let bookings = [];
try {
  if (fs.existsSync(BOOKINGS_FILE)) bookings = fs.readJSONSync(BOOKINGS_FILE);
} catch (e) {
  console.warn('Failed reading bookings.json (continuing):', e && e.message ? e.message : e);
}

export default async function handler(req, res) {
  try {
    console.log('[BOOK] incoming', { method: req.method, url: req.url, body: req.body });

    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    const { phone, otp, token, name, carNumber, date, time, washType, paymentMethod, address } = req.body || {};

    if (!phone || !otp || !token) {
      return res.status(400).json({ success: false, message: 'phone, otp and token are required' });
    }

    // verify token signature & expiry, then match payload to supplied phone+otp
    const verification = verifyOtpToken(token);
    if (!verification.ok) {
      return res.status(400).json({ success: false, message: 'Invalid token', error: verification.error });
    }
    const payload = verification.payload;
    if (normalizePhone(phone) !== payload.phone) {
      return res.status(400).json({ success: false, message: 'Phone mismatch' });
    }
    if (String(otp) !== String(payload.otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (!name || !carNumber || !date || !time) {
      return res.status(400).json({ success: false, message: 'Missing booking fields' });
    }

    if (bookings.some(b => b.date === date && b.carNumber === carNumber)) {
      return res.status(409).json({ success: false, message: 'Car already booked for this date' });
    }

    const booking = {
      id: Date.now(),
      name, phone, carNumber, date, time, washType, paymentMethod, address,
      createdAt: new Date().toISOString()
    };

    try {
      if (typeof appendBooking === 'function') {
        const result = await appendBooking(booking);
        if (result && result.ok === false) console.warn('appendBooking returned error object:', result);
      }
    } catch (sheetErr) {
      console.warn('appendBooking threw:', sheetErr && sheetErr.message ? sheetErr.message : sheetErr);
    }

    bookings.push(booking);
    try { fs.writeJSONSync(BOOKINGS_FILE, bookings, { spaces: 2 }); } catch (e) { console.warn('Failed writing bookings backup:', e && e.message ? e.message : e); }

    return res.status(200).json({ success: true, message: 'Booking confirmed', booking });
  } catch (err) {
    console.error('BOOK handler error:', err && err.stack ? err.stack : err);
    const payload = { success: false, message: 'Internal server error' };
    if (process.env.NODE_ENV === 'development') payload.error = err && (err.message || err.stack) ? (err.message || err.stack) : String(err);
    return res.status(500).json(payload);
  }
}