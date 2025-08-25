import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;

const CitySchema = new Schema({
  userId: { type: String, index: true, required: true },
  name: { type: String, required: true },
  country: { type: String, default: 'IN' },
  state: { type: String, default: null },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
}, { timestamps: true });

CitySchema.index({ userId: 1, name: 1, country: 1 }, { unique: true });

export default models.City || model('City', CitySchema);
