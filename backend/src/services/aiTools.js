// backend/src/services/aiTools.js
import axios from 'axios';

const PORT = process.env.PORT || 4000;
const BASE = `http://127.0.0.1:${PORT}`;

export async function tool_searchCities(q) {
  const { data } = await axios.get(`${BASE}/api/search`, { params: { q }, timeout: 8000 });
  return (Array.isArray(data) ? data : []).slice(0, 5);
}

export async function tool_addCity(userId, { name, country, state = null, lat, lon }) {
  const { data } = await axios.post(
    `${BASE}/api/cities`,
    { name, country, state, lat, lon },
    { headers: { 'x-user-id': userId, 'Content-Type': 'application/json' }, timeout: 8000 }
  );
  return data;
}

export async function tool_getWeather(cityId, userId) {
  const { data } = await axios.get(`${BASE}/api/weather`, {
    params: { cityId },
    headers: { 'x-user-id': userId },
    timeout: 10000
  });
  return data;
}

// NEW: list user's cities
export async function tool_listCities(userId) {
  const { data } = await axios.get(`${BASE}/api/cities`, {
    headers: { 'x-user-id': userId }, timeout: 8000
  });
  return Array.isArray(data) ? data : [];
}

// NEW: delete by (name, state?, country? default IN)
export async function tool_deleteCityByName(userId, { name, state = null, country = 'IN' }) {
  const cities = await tool_listCities(userId);
  const n = (s) => (s || '').toString().trim().toLowerCase();
  const target = cities.find(c =>
    n(c.name) === n(name) &&
    (state ? n(c.state) === n(state) : true) &&
    (country ? n(c.country) === n(country) : true)
  );
  if (!target?._id) return { ok: false, reason: 'not_found' };

  const { data } = await axios.delete(`${BASE}/api/cities`, {
    params: { id: target._id },
    headers: { 'x-user-id': userId },
    timeout: 8000
  });
  return { ok: true, removed: target, api: data };
}
