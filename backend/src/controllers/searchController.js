import axios from 'axios';
import WeatherCache from '../models/WeatherCache.js';



const GEO_TTL = parseInt(process.env.GEO_CACHE_TTL || '604800', 10); // default 7 days

function normalize(items = []) {
  return items.map(c => ({
    name: c.name,
    state: c.state ?? null,
    country: c.country ?? null,
    lat: c.lat,
    lon: c.lon,
  })).filter(c => c?.name && typeof c.lat === 'number' && typeof c.lon === 'number');
}

function isFresh(hit, ttl) {
  if (!hit) return false;
  const age = Date.now() - new Date(hit.fetchedAt).getTime();
  return age < ttl * 1000;
}

export async function search(req, res) {
  const raw = (req.query.q || '').trim();
  if (!raw) return res.status(400).json({ error: 'Missing q' });

  const key = (process.env.OPENWEATHER_API_KEY || '').trim();
  if (!key) {
   
    return res.json([]);
  }

  const cacheKey = `geo:${raw.toLowerCase()}`;

  try {
   
    const hit = await WeatherCache.findOne({ key: cacheKey }).lean();
    if (isFresh(hit, GEO_TTL)) {
      return res.json(hit.data);
    }

   
    const { data } = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
      params: { q: raw, limit: 5, appid: key },
      timeout: 8000,
    });

    const out = normalize(Array.isArray(data) ? data : []);
    await WeatherCache.updateOne(
      { key: cacheKey },
      { $set: { data: out, fetchedAt: new Date() } },
      { upsert: true }
    );

    return res.json(out);
  } catch (err) {
    const status = err?.response?.status;
    const code = err?.code;
    const msg = err?.response?.data || err?.message;
    console.error('OpenWeather geocode error:', status || code, msg);

   
    const stale = await WeatherCache.findOne({ key: cacheKey }).lean();
    if (stale?.data) return res.json(stale.data);

    return res.json([]); 
  }
}
