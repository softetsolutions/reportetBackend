import mongoose from "mongoose";

const payrollRunSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    status: {
      type: String,
      enum: ["draft", "finalized"],
      default: "draft",
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    finalizedAt: { type: Date, default: null },
    employeeCount: { type: Number, default: 0 },
    skippedNoStructure: { type: Number, default: 0 },
    grossTotal: { type: Number, default: 0 },
    deductionTotal: { type: Number, default: 0 },
    lopTotal: { type: Number, default: 0 },
    netTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
);

payrollRunSchema.index(
  { organizationId: 1, month: 1, year: 1 },
  { unique: true },
);

export default mongoose.model("PayrollRun", payrollRunSchema);
