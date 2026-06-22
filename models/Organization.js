import mongoose from "mongoose";

const orgSchema = new mongoose.Schema(
  {
    organizationName: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    code: { type: String, unique: true, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("Organization", orgSchema);
