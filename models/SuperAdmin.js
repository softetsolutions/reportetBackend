import mongoose from "mongoose";

const superAdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    password: { type: String, required: true },
    isAnyUpdateOnMobile: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("SuperAdmin", superAdminSchema);
