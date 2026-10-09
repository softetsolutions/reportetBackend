import mongoose from "mongoose";

const moneyLineSchema = new mongoose.Schema(
  {
    code: { type: String, default: "", trim: true },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const employeeSalaryStructureSchema = new mongoose.Schema(
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
    effectiveFrom: { type: Date, required: true },
    currency: { type: String, default: "INR" },
    earnings: {
      type: [moneyLineSchema],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one earning line is required",
      },
    },
    deductions: { type: [moneyLineSchema], default: [] },
  },
  { timestamps: true },
);

employeeSalaryStructureSchema.index({
  organizationId: 1,
  employeeId: 1,
  effectiveFrom: -1,
});

export default mongoose.model(
  "EmployeeSalaryStructure",
  employeeSalaryStructureSchema,
);
