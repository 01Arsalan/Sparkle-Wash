// routes/otp.js
const express = require('express');
const router = express.Router();
const { saveOtp } = require('../otpStore'); // or DB logic

router.post('/request', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
  saveOtp(phone, otp);

  // send SMS via provider here
  console.log(`OTP for ${phone}: ${otp}`); // Replace with actual SMS service

  res.json({ success: true, message: "OTP sent" });
});

module.exports = router;
