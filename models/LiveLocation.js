import mongoose from "mongoose";

const liveLocationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrackingSession",
      default: null,
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    accuracy: Number,
    speed: Number,
    heading: Number,
    isOnline: { type: Boolean, default: false },
    lastPingAt: { type: Date, default: null },
  },
  { timestamps: true },
);

liveLocationSchema.index({ location: "2dsphere" });
liveLocationSchema.index({ organizationId: 1, isOnline: 1 });

export default mongoose.model("LiveLocation", liveLocationSchema);
