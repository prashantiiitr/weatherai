import axios from 'axios';
import mongoose from 'mongoose';
import City from '../models/City.js';
import WeatherCache from '../models/WeatherCache.js';

const TTL_CUR = parseInt(process.env.CACHE_TTL_CURRENT || '600', 10);
const TTL_FC  = parseInt(process.env.CACHE_TTL_FORECAST || '3600', 10);

function makeMock(city) {
  return {
    city,
    current: {
      main: { temp: 28, feels_like: 30, pressure: 1012, humidity: 60 },
      weather: [{ main: 'Clouds', description: 'scattered clouds', icon: '03d' }],
      wind: { speed: 3.4 },
    },
    forecast: {
      list: Array.from({ length: 5 }).map((_, i) => ({
        dt: Math.floor(Date.now() / 1000) + (i + 1) * 86400,
        main: { temp: 26 + i, feels_like: 27 + i },
        weather: [{ main: i % 2 ? 'Clouds' : 'Clear', description: i % 2 ? 'broken clouds' : 'clear sky', icon: i % 2 ? '03d' : '01d' }],
      })),
    },
  };
}

async function cacheGet(key)   { return WeatherCache.findOne({ key }).lean(); }
async function cacheSet(key,d) { return WeatherCache.updateOne({ key },{ $set:{ data:d, fetchedAt:new Date() } },{ upsert:true }); }
function isFresh(hit,ttl)      { return !!hit && (Date.now() - new Date(hit.fetchedAt).getTime()) < ttl*1000; }

export async function weather(req, res) {
  try {
    const { cityId } = req.query;
    if (!cityId || !mongoose.isValidObjectId(cityId)) return res.status(400).json({ error: 'cityId required/invalid' });

    const city = await City.findById(cityId).lean();
    if (!city) return res.status(404).json({ error: 'City not found' });

    const key = (process.env.OPENWEATHER_API_KEY || '').trim();
    const { lat, lon } = city;

    
    if (lat == null || lon == null) {
      console.warn('weather: city missing lat/lon → mock');
      return res.json(makeMock(city));
    }
    if (!key) {
      console.warn('weather: OPENWEATHER_API_KEY not set → mock');
      return res.json(makeMock(city));
    }

    const kCur = `cur:${cityId}`;
    const kFc  = `fc:${cityId}`;
    const [hitCur, hitFc] = await Promise.all([cacheGet(kCur), cacheGet(kFc)]);
    const curFresh = isFresh(hitCur, TTL_CUR);
    const fcFresh  = isFresh(hitFc, TTL_FC);

    if (curFresh && fcFresh) {
      return res.json({ city, current: hitCur.data, forecast: hitFc.data });
    }

    let current = curFresh ? hitCur.data : null;
    let forecast = fcFresh ? hitFc.data : null;

    const fetchCurrent = async () => {
      const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { lat, lon, units: 'metric', appid: key }, timeout: 8000,
      });
      await cacheSet(kCur, data);
      return data;
    };
    const fetchForecast = async () => {
      const { data } = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
        params: { lat, lon, units: 'metric', appid: key }, timeout: 8000,
      });
      await cacheSet(kFc, data);
      return data;
    };

    try {
      const tasks = [];
      if (!curFresh) tasks.push(fetchCurrent().then(d => (current = d)));
      if (!fcFresh)  tasks.push(fetchForecast().then(d => (forecast = d)));
      await Promise.all(tasks);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.code;
      const msg = err?.response?.data || err?.message;
      console.error('OpenWeather fetch error:', status || code, msg);

      if (!current && hitCur) current = hitCur.data;
      if (!forecast && hitFc) forecast = hitFc.data;
      if (!current || !forecast) {
        console.warn('weather: provider unavailable & no cache → mock');
        return res.json(makeMock(city));
      }
    }

    return res.json({ city, current, forecast });
  } catch (e) {
    console.error('weather route fatal:', e);
    return res.status(502).json({ error: 'Weather provider error. Try again shortly.' });
  }
}
