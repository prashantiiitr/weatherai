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
const corsCfg = (process.env.CORS_ORIGIN || '*').trim();
const allowAll  = corsCfg === '*';
const allowList = allowAll ? [] : corsCfg.split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (allowAll) return cb(null, true);
    if (!origin)  return cb(null, true);                 // curl/health
    return cb(null, allowList.includes(origin));         // true/false
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-user-id'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


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
