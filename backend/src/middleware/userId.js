export function userId(req, _res, next){
  req.userId = req.header('x-user-id') || req.query.uid || 'demo-user';
  next();
}
