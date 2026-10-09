import mongoose from "mongoose";

const dayPlanSchema = new mongoose.Schema(
  {
    /** YYYY-MM-DD (Asia/Kolkata calendar) */
    date: { type: String, required: true },
    areaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Area" }],
    doctorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
  },
  { _id: false },
);

const tourPlanMonthSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    submittedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    reviewedByRole: {
      type: String,
      enum: ["areaManager", "zonalManager", "admin"],
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    /** At most one item per date — enforced in application logic */
    days: { type: [dayPlanSchema], default: [] },
  },
  { timestamps: true },
);

tourPlanMonthSchema.index(
  { organizationId: 1, employeeId: 1, year: 1, month: 1 },
  { unique: true },
);

export default mongoose.model("TourPlanMonth", tourPlanMonthSchema);
