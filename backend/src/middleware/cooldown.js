const last = new Map(); 

export function cooldown(ms = 600) {
  return (req, res, next) => {
    const k = `${req.userId}:${req.path}`;
    const now = Date.now();
    const prev = last.get(k) || 0;
    if (now - prev < ms) {
      return res.status(429).json({ error: 'Slow down' });
    }
    last.set(k, now);
    next();
  };
}
