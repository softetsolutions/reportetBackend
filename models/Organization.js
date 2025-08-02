import mongoose from 'mongoose';

const orgSchema = new mongoose.Schema({
  organizationName: String,
  email: { type: String, unique: true },
  password: String,
  role: {type: String, default: 'admin'},
},{timestamps: true});

export default mongoose.model('Organization', orgSchema);
