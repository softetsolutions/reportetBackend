import mongoose from "mongoose";

const dailyVisit = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  areaId: { type: mongoose.Schema.Types.ObjectId, ref: "Area" },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  mrId: { type: mongoose.Schema.Types.ObjectId, ref: "Mr" },
  remark: { type: String },
},
{ timestamps: true }
);

export default mongoose.model("DailyVisit", dailyVisit);
