import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
  name: String,
  specialty: String,
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  remarks: [
    {
      mrId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now },
      text: String
    }
  ]
});

export default mongoose.model('Doctor', doctorSchema);
