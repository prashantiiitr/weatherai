import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const UserSchema = new Schema({
  name: String,
  email: { type: String, unique: true },
}, { timestamps: true });

export default models.User || model('User', UserSchema);
