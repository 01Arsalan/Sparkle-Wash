import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendBooking } from './googleSheets.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middlewares
app.use(cors({
  origin: 'https://sparkle-wash.vercel.app', // your frontend domain
  methods: ['GET', 'POST']
}));

app.use(bodyParser.json());

// Serve static files from public folder
app.use(express.static(PUBLIC_DIR));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const API_BASE = 'https://sparkle-wash-server.vercel.app';
// Load existing bookings (local backup)
let bookings = [];
const BOOKING_FILE = `/bookings.json`;
if (fs.existsSync(BOOKING_FILE)) {
  bookings = fs.readJSONSync(BOOKING_FILE);
}

// OTP store (in-memory)
const otpStore = new Map(); // key: phone, value: { otp, expiresAt }

// Helper functions
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
    otpStore.delete(phone); // consume OTP
    return true;
  }
  return false;
}

// ------------------- ROUTES -------------------

// Request OTP
app.post(`/otp/request`, (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
  saveOtp(phone, otp);

  console.log(`OTP for ${phone}: ${otp}`); // For dev/testing only

  // Return OTP in response for frontend (dev only)
  return res.json({ success: true, message: 'OTP sent', otp });
});

// Book endpoint with OTP verification
app.post(`/book`, async (req, res) => {
  const { phone, otp, carNumber, date, time, name, washType, paymentMethod, address } = req.body;

  console.log('OTP store:', otpStore.get(phone)); // debug
  console.log('Received OTP:', otp);

  if (!phone || !otp || !verifyOtp(phone, otp)) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  if (!carNumber || !date || !time || !name) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Prevent duplicate booking for same car & date
  if (bookings.some(b => b.date === date && b.carNumber === carNumber)) {
    return res.status(409).json({ success: false, message: 'Car already booked for this date' });
  }

  const booking = {
    id: Date.now(),
    name,
    phone,
    carNumber,
    date,
    time,
    washType,
    paymentMethod,
    address,
    createdAt: new Date().toISOString()
  };

  // Append to Google Sheets
  const sheetResult = await appendBooking(booking);
  if (!sheetResult.ok) {
    console.error('Sheet append failed:', sheetResult);
    return res.status(500).json({ success: false, message: 'Failed to save booking', detail: sheetResult });
  }

  // Save locally
  bookings.push(booking);
  fs.writeJSONSync('./bookings.json', bookings, { spaces: 2 });

  return res.json({ success: true, message: 'Booking confirmed', booking });
});

// Get all bookings
app.get(`/bookings`, (req, res) => {
  res.json({ success: true, bookings });
});

// Start server
app.listen(PORT, () => {
  console.log(`SparkleWash server running on port ${PORT}`);
});
