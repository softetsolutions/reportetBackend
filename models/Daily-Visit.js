import mongoose from "mongoose";

const dailyVisit = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    areaId: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Area", required: true },
    ],
    doctorId: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    ],
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    assistedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    remark: { type: String, default: "-" },
    visitDate: { type: String, required: true },
  },
  { timestamps: true },
);

dailyVisit.index(
  { organizationId: 1, employeeId: 1, visitDate: 1 },
  { unique: true },
);

export default mongoose.model("DailyVisit", dailyVisit);
