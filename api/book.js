import { verifyOtp } from './utils/otpStore.js';
import { appendBooking } from './utils/googleSheets.js'; // ensure this file exports appendBooking

const BOOKINGS_FILE = 'bookings.json';
import fs from 'fs-extra';

let bookings = [];
try { if (fs.existsSync(BOOKINGS_FILE)) bookings = fs.readJSONSync(BOOKINGS_FILE); } catch (e) { /* ignore */ }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { phone, otp, name, carNumber, date, time, washType, paymentMethod, address } = req.body || {};

  if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required' });
  if (!verifyOtp(phone, otp)) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  if (!name || !carNumber || !date || !time) return res.status(400).json({ success: false, message: 'Missing booking fields' });

  if (bookings.some(b => b.date === date && b.carNumber === carNumber)) {
    return res.status(409).json({ success: false, message: 'Car already booked for this date' });
  }

  const booking = { id: Date.now(), name, phone, carNumber, date, time, washType, paymentMethod, address, createdAt: new Date().toISOString() };

  // Try append to sheet (best-effort in dev)
  try {
    if (typeof appendBooking === 'function') {
      const result = await appendBooking(booking);
      if (result && result.ok === false) console.warn('appendBooking error:', result);
    }
  } catch (err) {
    console.warn('appendBooking threw:', err && err.message ? err.message : err);
  }

  bookings.push(booking);
  try { fs.writeJSONSync(BOOKINGS_FILE, bookings, { spaces: 2 }); } catch (e) { /* ignore */ }

  return res.status(200).json({ success: true, message: 'Booking confirmed', booking });
}