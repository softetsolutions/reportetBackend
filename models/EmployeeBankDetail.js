import mongoose from "mongoose";

const employeeBankDetailSchema = new mongoose.Schema(
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
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifsc: { type: String, required: true, trim: true, uppercase: true },
    bankName: { type: String, default: "", trim: true },
    accountType: {
      type: String,
      enum: ["savings", "current", ""],
      default: "savings",
    },
  },
  { timestamps: true },
);

employeeBankDetailSchema.index(
  { organizationId: 1, employeeId: 1 },
  { unique: true },
);

export default mongoose.model("EmployeeBankDetail", employeeBankDetailSchema);
