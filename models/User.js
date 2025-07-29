import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'mr', 'supervisor'], default: 'user' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }, // for MR/Supervisor
  assignedLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' }
});

export default mongoose.model('User', userSchema);
