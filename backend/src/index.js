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

// ======= SIMPLE, BULLETPROOF CORS (no package) =======
const corsCfg = (process.env.CORS_ORIGIN || '*').trim();
// e.g. "https://weatherai-py6o.vercel.app,http://localhost:5173" or "*"
const allowAll  = corsCfg === '*';
const allowList = allowAll ? [] : corsCfg.split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin; // may be undefined for curl/health

  // allow if wildcard OR no Origin header (server-to-server/health) OR in allowlist
  const isAllowed = allowAll || !origin || allowList.includes(origin);

  // only set header if we know what to set
  if (isAllowed) {
    if (allowAll) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin'); // avoid cache pollution
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  // If you ever use cookies, also set:
  // res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Preflight short-circuit
  if (req.method === 'OPTIONS') return res.sendStatus(204);

  next();
});
// ======= END CORS =======



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
