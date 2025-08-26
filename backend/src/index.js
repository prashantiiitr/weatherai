// backend/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectDB } from './lib/db.js';
import { userId } from './middleware/userId.js';
import { cooldown } from './middleware/cooldown.js';

import cities from './routes/cities.js';
import search from './routes/search.js';
import weather from './routes/weather.js';
import ai from './routes/ai.js';
import diag from './routes/diag.js';

const app = express();


// --- Robust CORS with allowlist + preflight ---
// ---- BULLETPROOF CORS (put this BEFORE any routes/middleware) ----
app.set('trust proxy', 1);

const raw = (process.env.CORS_ORIGIN || '*').trim();
// Example for prod: "https://weatherai-py6o.vercel.app,http://localhost:5173"
const allowAll = raw === '*';
const allowList = allowAll ? [] : raw.split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow if wildcard OR origin is in the allowList OR request has no origin (curl/server-to-server)
  const ok =
    allowAll ||
    !origin ||
    allowList.includes(origin);

  if (ok) {
    // Reflect the requesting origin (or * if you want)
    res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin);
    res.setHeader('Vary', 'Origin'); // important for caches
  }

  // Methods + headers for preflight
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-id'
  );
  // If you plan to use cookies, also set:
  // res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Fast exit for preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
// ---- END CORS ----


app.use(express.json());
app.use(userId);

// Friendly root message
app.get('/', (_req, res) => {
  res.type('text/plain').send('WeatherDeck API • Try /api/health');
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/cities', cities);
app.use('/api/search', cooldown(500), search);
app.use('/api/weather', weather);
app.use('/api/ai', ai);
app.use('/api/_diag', diag);

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`backend running on :${PORT}`)))
  .catch((err) => {
    console.error('DB connect error:', err.message);
    process.exit(1);
  });
