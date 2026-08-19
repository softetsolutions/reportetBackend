import mongoose from "mongoose";

const trackingSessionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    date: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    startLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: [Number],
    },
    endLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: [Number],
    },
    lastPingAt: { type: Date, default: null },
  },
  { timestamps: true },
);

trackingSessionSchema.index({ employeeId: 1, date: 1 }, { unique: true });
trackingSessionSchema.index({ organizationId: 1, status: 1 });

export default mongoose.model("TrackingSession", trackingSessionSchema);
