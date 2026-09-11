import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
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
    leaveDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    approvedByRole: {
      type: String,
      enum: ["areaManager", "zonalManager", "admin"],
      default: null,
    },
    actionAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Leave", leaveSchema);
