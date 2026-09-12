import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    annualQuota: {
      type: Number,
      required: true,
      min: 0,
    },

    paid: {
      type: Boolean,
      required: true,
    },

    creditWindow: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"],
      required: true,
    },

    creditAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    carryForward: {
      type: Boolean,
      required: true,
    },

    maxCarryForward: {
      type: Number,
      default: 0,
      min: 0,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

leaveTypeSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model("Leavetype", leaveTypeSchema);
