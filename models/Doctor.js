import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: String,
    specialty: String,
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    areaId: { type: mongoose.Schema.Types.ObjectId, ref: "Area" },
  },
  { timestamps: true }
);

export default mongoose.model("Doctor", doctorSchema);
