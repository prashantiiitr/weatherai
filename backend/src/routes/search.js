import { Router } from 'express';
import { search } from '../controllers/searchController.js';
const r = Router();
r.get('/', search);
export default r;
