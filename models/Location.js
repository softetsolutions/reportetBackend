import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  name: String,
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }
});

export default mongoose.model('Location', locationSchema);
