// backend/src/routes/diag.js
import { Router } from 'express';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const r = Router();

r.get('/openweather', async (_req, res) => {
  const key = (process.env.OPENWEATHER_API_KEY || '').trim();
  if (!key) return res.status(500).json({ ok: false, reason: 'no_openweather_key' });
  const mask = key.length >= 8 ? key.slice(0, 4) + '...' + key.slice(-4) : 'short';
  try {
    const { data } = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
      params: { q: 'Paris', limit: 1, appid: key },
      timeout: 8000,
    });
    return res.json({ ok: true, key: mask, sample: Array.isArray(data) });
  } catch (e) {
    return res.status(500).json({ ok: false, key: mask, err: e?.response?.data || e.message });
  }
});

r.get('/ai', async (_req, res) => {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return res.status(500).json({ ok: false, reason: 'no_gemini_key' });
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const out = await model.generateContent('Say OK');
    return res.json({ ok: true, reply: out.response.text() });
  } catch (e) {
    return res.status(500).json({ ok: false, err: e?.message || 'gemini failed' });
  }
});

export default r;
