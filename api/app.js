// api/app.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

dotenv.config();

const app = express();

// log every incoming request (debug)
app.use((req, res, next) => {
  console.log('[REQ]', new Date().toISOString(), req.method, req.url);
  next();
});

// CORS - allow front-end origin (set FRONTEND_ORIGIN in Vercel envs) or '*' for testing
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(bodyParser.json());

// Serve static files only for local dev if you want (optional)
// app.use(express.static(path.join(process.cwd(), 'public')));

// In-memory OTP store (ephemeral)
const otpStore = new Map();
function saveOtp(phone, otp, ttl = 5 * 60 * 1000) {
  otpStore.set(phone, { otp, expiresAt: Date.now() + ttl });
}
function verifyOtp(phone, otp) {
  const rec = otpStore.get(phone);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) { otpStore.delete(phone); return false; }
  if (String(rec.otp) === String(otp)) { otpStore.delete(phone); return true; }
  return false;
}

// Local backup file (note: ephemeral on serverless; retain for local dev)
const BOOKINGS_FILE = path.join(process.cwd(), 'bookings.json');
let bookings = [];
try {
  if (fs.existsSync(BOOKINGS_FILE)) bookings = fs.readJSONSync(BOOKINGS_FILE);
} catch (e) {
  // ignore on serverless environment
  console.warn('Could not load bookings.json:', e.message);
}

// Health
app.get('/health', (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

// Request OTP: POST /otp  { phone }
app.post('/otp', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });
  const otp = Math.floor(100000 + Math.random() * 900000);
  saveOtp(phone, otp);
  console.log(`OTP for ${phone}: ${otp}`);
  // Return OTP in body for dev/testing only. Remove in production.
  return res.json({ success: true, message: 'OTP generated', otp });
});

// Verify OTP (optional)
app.post('/otp/verify', (req, res) => {
  const { phone, otp } = req.body || {};
  if (!phone || !otp) return res.status(400).json({ success: false, message: 'phone & otp required' });
  const ok = verifyOtp(phone, otp);
  return res.json({ success: ok, message: ok ? 'OTP valid' : 'Invalid/expired' });
});

// Book endpoint: POST /book { phone, otp, name, carNumber, date, time, washType, paymentMethod, address }
app.post('/book', async (req, res) => {
  try {
    const { phone, otp, name, carNumber, date, time, washType, paymentMethod, address } = req.body || {};

    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    if (!verifyOtp(phone, otp)) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    if (!name || !carNumber || !date || !time) return res.status(400).json({ success: false, message: 'Missing booking fields' });

    // duplicate check
    if (bookings.some(b => b.date === date && b.carNumber === carNumber)) {
      return res.status(409).json({ success: false, message: 'Car already booked for this date' });
    }

    const booking = {
      id: Date.now(),
      name, phone, carNumber, date, time, washType, paymentMethod, address,
      createdAt: new Date().toISOString()
    };

    // Append to Google Sheets (your util)
    try {
      const sheetResult = await appendBooking(booking);
      // If appendBooking uses SheetDB style, it may return { ok: true } or similar.
      if (!sheetResult || (typeof sheetResult === 'object' && sheetResult.ok === false)) {
        console.warn('appendBooking returned non-ok:', sheetResult);
        // optionally continue and still save locally
      }
    } catch (err) {
      console.error('appendBooking error:', err);
      // don't fail whole flow for dev — but you can return 500 if you prefer
      // return res.status(500).json({ success: false, message: 'Failed saving to sheet', detail: err.message });
    }

    // local backup (best-effort; won't persist across serverless invocations)
    bookings.push(booking);
    try { fs.writeJSONSync(BOOKINGS_FILE, bookings, { spaces: 2 }); } catch (e) {/* ignore */}

    return res.json({ success: true, message: 'Booking confirmed', booking });
  } catch (err) {
    console.error('Book route error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get bookings (dev only)
app.get('/bookings', (req, res) => res.json({ success: true, bookings }));

// after all routes are registered, print route list (debug)
setImmediate(() => {
  try {
    console.log('--- Registered express routes ---');
    if (app && app._router && app._router.stack) {
      app._router.stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods || {}).join(',').toUpperCase();
          console.log(methods.padEnd(8), layer.route.path);
        }
      });
    } else {
      console.log('No router stack found');
    }
    console.log('---------------------------------');
  } catch (e) {
    console.error('Route list error:', e);
  }
});

export default app;
