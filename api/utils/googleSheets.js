// googleSheets.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SHEETDB_URL = process.env.SHEETDB_URL;

if (!SHEETDB_URL) {
  console.error('SHEETDB_URL not set in .env');
}

/**
 * Ensure booking object only contains keys that match your sheet headers.
 * Adjust allowedKeys to match the column headers in your Google Sheet.
 */
const allowedKeys = [
  'name', 'phone', 'address', 'carNumber', 'date', 'time',
  'washType', 'paymentMethod', 'id', 'createdAt'
];

function sanitizeBooking(raw) {
  const out = {};
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      out[k] = raw[k];
    } else {
      // ensure empty string for missing keys so SheetDB sees consistent columns
      out[k] = '';
    }
  }
  return out;
}

export async function appendBooking(booking) {
  if (!SHEETDB_URL) {
    console.error('SHEETDB_URL missing, cannot append booking.');
    return { ok: false, error: 'SHEETDB_URL missing' };
  }

  const row = sanitizeBooking(booking);

  try {
    // Primary attempt: recommended SheetDB payload
    const payloadA = { data: [row] };
    let res = await axios.post(SHEETDB_URL, payloadA, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    // If 201/200 -> success
    if (res.status === 201 || res.status === 200) {
      return { ok: true, status: res.status, data: res.data };
    }

    // If 400 or other -> try alternate payloads and capture server message
    const serverBody = res.data || {};
    console.warn('Sheet append attempt A failed', res.status, serverBody);

    // Attempt B: SheetDB also accepts direct object or array sometimes
    const payloadB = row; // single object
    res = await axios.post(SHEETDB_URL, payloadB, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    if (res.status === 201 || res.status === 200) {
      return { ok: true, status: res.status, data: res.data };
    }

    // Attempt C: wrap in top-level array
    const payloadC = [row];
    res = await axios.post(SHEETDB_URL, payloadC, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    if (res.status === 201 || res.status === 200) {
      return { ok: true, status: res.status, data: res.data };
    }

    // All attempts failed — return the last response body for debugging
    console.error('All SheetDB append attempts failed. Last status:', res.status);
    console.error('Last response body:', res.data);

    return {
      ok: false,
      status: res.status,
      error: res.data || 'Unknown error from SheetDB'
    };
  } catch (err) {
    // Network or unexpected error
    console.error('Sheet append error:', err && err.message ? err.message : err);
    if (err.response) {
      console.error('Response data:', err.response.data);
      return { ok: false, error: err.response.data, status: err.response.status };
    }
    return { ok: false, error: err.message || String(err) };
  }
}
