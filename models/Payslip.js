import mongoose from "mongoose";

const moneyLineSchema = new mongoose.Schema(
  {
    code: { type: String, default: "", trim: true },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const attendanceSnapshotSchema = new mongoose.Schema(
  {
    calendarDays: { type: Number, default: 0 },
    weeklyOffDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    workingDaysInMonth: { type: Number, default: 0 },
    suggestedLopDays: { type: Number, default: 0 },
  },
  { _id: false },
);

const bankSnapshotSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountType: { type: String, default: "" },
  },
  { _id: false },
);

const payslipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ["draft", "finalized", "onHold"],
      default: "draft",
    },
    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeSalaryStructure",
      default: null,
    },
    earnings: { type: [moneyLineSchema], default: [] },
    deductions: { type: [moneyLineSchema], default: [] },
    gross: { type: Number, default: 0 },
    structureDeductions: { type: Number, default: 0 },
    finalLopDays: { type: Number, default: 0, min: 0 },
    lopAmount: { type: Number, default: 0, min: 0 },
    netPay: { type: Number, default: 0 },
    attendance: { type: attendanceSnapshotSchema, default: () => ({}) },
    bankSnapshot: { type: bankSnapshotSchema, default: () => ({}) },
    holdReason: { type: String, default: null },
    adminNote: { type: String, default: null },
    currency: { type: String, default: "INR" },
  },
  { timestamps: true },
);

payslipSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });
payslipSchema.index({ organizationId: 1, month: 1, year: 1 });

export default mongoose.model("Payslip", payslipSchema);
