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
const allowed = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman
    return cb(null, allowed.includes(origin));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// ------------------------------------------------

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
