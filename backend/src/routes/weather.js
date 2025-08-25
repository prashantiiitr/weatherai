import { Router } from 'express';
import { weather } from '../controllers/weatherController.js';
const r = Router();
r.get('/', weather);
export default r;
