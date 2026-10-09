import mongoose from "mongoose";

const payrollSettingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    /** 0 = Sunday … 6 = Saturday. Default Sunday only. */
    weeklyOffWeekdays: {
      type: [Number],
      default: [0],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "weeklyOffWeekdays must be integers 0-6",
      },
    },
    lopDivisorMethod: {
      type: String,
      enum: ["calendar_days", "working_days"],
      default: "calendar_days",
    },
    /** Mobile/pdf-lib salary slip skin */
    payslipTemplate: {
      type: String,
      enum: ["classic", "modern", "compact"],
      default: "classic",
    },
  },
  { timestamps: true },
);

export default mongoose.model("PayrollSettings", payrollSettingsSchema);
