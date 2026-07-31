import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: String,
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
});

export default mongoose.model("Zone", zoneSchema);
