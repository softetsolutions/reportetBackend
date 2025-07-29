import mongoose from 'mongoose';

const orgSchema = new mongoose.Schema({
  organizationName: String,
  email: { type: String, unique: true },
  password: String,
  role: {type: String, default: 'admin'},
});

export default mongoose.model('Organization', orgSchema);
