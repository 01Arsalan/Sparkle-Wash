// routes/booking.js
const express = require('express');
const router = express.Router();
const { verifyOtp } = require('../otpStore'); // or DB logic
const Booking = require('../models/Booking'); // Mongoose model

router.post('/', async (req, res) => {
  const { name, phone, otp, address, carNumber, date, time, washType, paymentMethod } = req.body;

  if (!verifyOtp(phone, otp)) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  try {
    const booking = await Booking.create({ name, phone, address, carNumber, date, time, washType, paymentMethod });
    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

module.exports = router;
