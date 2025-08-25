import City from '../models/City.js';

export async function listCities(req, res) {
  const cities = await City.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
  res.json(cities);
}

export async function addCity(req, res) {
  const { name, country, state, lat, lon } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  if (lat == null || lon == null) return res.status(400).json({ error: 'lat/lon required' });
  try {
    const doc = await City.create({ userId: req.userId, name, country, state, lat, lon });
    res.json(doc);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'City already added' });
    res.status(500).json({ error: 'Failed to save' });
  }
}

export async function removeCity(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  const r = await City.deleteOne({ _id: id, userId: req.userId });
  if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}
