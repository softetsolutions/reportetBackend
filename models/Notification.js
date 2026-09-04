import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
      default: null,
    },
    eventType: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    isRead: { type: Boolean, default: false },
    emailStatus: {
      type: String,
      enum: ["not_applicable", "pending", "sent", "failed"],
      default: "not_applicable",
    },
  },
  { timestamps: true },
);

notificationSchema.index({ organizationId: 1, isRead: 1 });
notificationSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
