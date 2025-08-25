import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;

const WeatherCacheSchema = new Schema({
  key: { type: String, unique: true, index: true },
  data: { type: Schema.Types.Mixed },
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default models.WeatherCache || model('WeatherCache', WeatherCacheSchema);
