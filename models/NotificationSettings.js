import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["default", "custom"], default: "default" },
    logoUrl: { type: String, default: "" },
    backgroundImageUrl: { type: String, default: "" },
    headerText: { type: String, default: "" },
    bodyMessage: { type: String, default: "" },
    footerText: { type: String, default: "" },
    accentColor: { type: String, default: "#111827" },
  },
  { _id: false },
);

const eventConfigSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    channels: {
      email: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
    emailSubject: { type: String, default: "" },
    emailTemplate: { type: emailTemplateSchema, default: () => ({}) },
    sendTime: { type: String, default: "09:00" },
  },
  { _id: false },
);

const notificationSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      unique: true,
      required: true,
    },
    featureEnabled: { type: Boolean, default: false },
    events: [eventConfigSchema],
  },
  { timestamps: true },
);

export default mongoose.model(
  "NotificationSettings",
  notificationSettingsSchema,
);
