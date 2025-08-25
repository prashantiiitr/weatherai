import { Router } from 'express';
import { addCity, listCities, removeCity } from '../controllers/citiesController.js';
const r = Router();
r.get('/', listCities);
r.post('/', addCity);
r.delete('/', removeCity);
export default r;
