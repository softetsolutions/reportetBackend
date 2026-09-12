import mongoose from "mongoose";

const employeeLeaveBalanceSchema = new mongoose.Schema(
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
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leavetype",
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

employeeLeaveBalanceSchema.index(
  { employeeId: 1, leaveType: 1 },
  { unique: true },
);
employeeLeaveBalanceSchema.index({ organizationId: 1, leaveType: 1 });

export default mongoose.model(
  "Employeeleavebalance",
  employeeLeaveBalanceSchema,
);
