import mongoose from "mongoose";

const promotionHistorySchema = new mongoose.Schema(
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
    fromRole: {
      type: String,
      enum: ["mr", "areaManager", "zonalManager"],
      required: true,
    },
    toRole: {
      type: String,
      enum: ["mr", "areaManager", "zonalManager"],
      required: true,
    },
    fromHeadQuarters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Headquarter" },
    ],
    toHeadQuarters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Headquarter" },
    ],
    fromZones: [{ type: mongoose.Schema.Types.ObjectId, ref: "Zone" }],
    toZones: [{ type: mongoose.Schema.Types.ObjectId, ref: "Zone" }],
    promotedByKind: {
      type: String,
      enum: ["admin", "employee"],
      required: true,
    },
    promotedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    promotedByRole: {
      type: String,
      enum: ["admin", "zonalManager"],
      required: true,
    },
  },
  { timestamps: true },
);

promotionHistorySchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });
promotionHistorySchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("PromotionHistory", promotionHistorySchema);
