import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrackingSession",
      required: true,
      unique: true,
    },
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
    status: { type: String, enum: ["active", "completed"], default: "active" },
    startTime: Date,
    endTime: Date,
    startLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: [Number],
    },
    endLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: [Number],
    },
    totalDistanceMeters: { type: Number, default: 0 },
    pingCount: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true },
);

tripSchema.index({ employeeId: 1, date: 1 }, { unique: true });
tripSchema.index({ organizationId: 1, date: 1 });

export default mongoose.model("Trip", tripSchema);
