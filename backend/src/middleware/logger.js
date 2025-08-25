
export function logger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} ${ms}ms`;
    
    if (process.env.NODE_ENV !== 'test') console.info(line);
  });
  next();
}
