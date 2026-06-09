import mongoose from "mongoose";

const headQuarterSchema = new mongoose.Schema(
  {
    headQuarterName: String,
    location: String,
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true },
);

headQuarterSchema.index(
  { organizationId: 1, headQuarterName: 1 },
  { unique: true },
);

export default mongoose.model("Headquarter", headQuarterSchema);
