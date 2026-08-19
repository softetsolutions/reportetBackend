import mongoose from "mongoose";

const orgSchema = new mongoose.Schema(
  {
    organizationName: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    code: { type: String, unique: true, required: true },
    brandName: { type: String, default: "ReportET" },
    logoUrl: { type: String, default: null },

    liveTrackingEnabled: { type: Boolean, default: false },
    liveTrackingEnabledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Organization", orgSchema);
