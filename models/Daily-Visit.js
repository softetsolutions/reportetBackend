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
    remark: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model("DailyVisit", dailyVisit);
