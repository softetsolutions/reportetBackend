import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    headQuarterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Headquarter",
      required: true,
    },

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

locationSchema.index(
  { organizationId: 1, headQuarterId: 1, name: 1 },
  { unique: true },
);

export default mongoose.model("Area", locationSchema);
