import mongoose from "mongoose";

const MONTHS = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

const monthlyBudgetSchema = new mongoose.Schema(
  {
    month: { type: String, enum: MONTHS, required: true },
    allocatedBudget: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const headQuarterBudgetSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    headQuarterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Headquarter",
      required: true,
    },

    financialYear: { type: String, required: true },
    months: {
      type: [monthlyBudgetSchema],
      validate: {
        validator: (arr) => arr.length === 12,
        message: "All 12 months must be provided",
      },
    },
    totalAllocatedBudget: { type: Number, default: 0 },
  },
  { timestamps: true },
);

headQuarterBudgetSchema.index(
  { organizationId: 1, headQuarterId: 1, financialYear: 1 },
  { unique: true },
);

headQuarterBudgetSchema.pre("save", function (next) {
  this.totalAllocatedBudget = this.months.reduce(
    (sum, m) => sum + (m.allocatedBudget || 0),
    0,
  );
  next();
});

export const FINANCIAL_YEAR_MONTHS = MONTHS;
export default mongoose.model("HeadQuarterBudget", headQuarterBudgetSchema);
