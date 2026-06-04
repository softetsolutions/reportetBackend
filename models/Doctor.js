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
    // assignedTo: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    // },
  },
  { timestamps: true },
);

doctorSchema.index({ organizationId: 1, areaId: 1, name: 1 }, { unique: true });

export default mongoose.model("Doctor", doctorSchema);
