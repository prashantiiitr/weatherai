import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { userId } from './middleware/userId.js';
import cities from './routes/cities.js';
import search from './routes/search.js';
import weather from './routes/weather.js';
import { connectDB } from './lib/db.js';
import { cooldown } from './middleware/cooldown.js';
import { logger } from './middleware/logger.js'
const app = express();
app.get('/', (_req, res) => {
  res.type('text/plain').send('WeatherDeck API. Try /api/health');
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || '*' }));
app.use(express.json());
app.use(userId);
app.use(logger)  
app.get('/api/health', (_req,res)=> res.json({ ok: true }));
app.use('/api/cities', cities);
app.use('/api/search', cooldown(500), search);
app.use('/api/weather', weather);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`backend running on :${PORT}`)))
  .catch(err => { console.error('DB connect error:', err.message); process.exit(1); });
