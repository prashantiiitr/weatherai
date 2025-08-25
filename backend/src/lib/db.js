import mongoose from 'mongoose';
export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI not set');
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(uri, { dbName: 'weatherdeck' });
}
