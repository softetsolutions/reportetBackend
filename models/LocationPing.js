import mongoose from "mongoose";

const locationPingSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrackingSession",
      required: true,
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
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    accuracy: Number,
    speed: Number,
    heading: Number,
    battery: Number,
    timestamp: { type: Date, required: true, default: Date.now },
  },
  {
    timeseries: {
      timeField: "timestamp",
      metaField: "employeeId",
      granularity: "seconds",
    },
  },
);

locationPingSchema.index({ sessionId: 1, timestamp: 1 });
locationPingSchema.index({ employeeId: 1, timestamp: 1 });

export default mongoose.model("LocationPing", locationPingSchema);
