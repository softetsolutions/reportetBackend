import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    userName: { type: String, unique: true },

    password: String,
    displayName: {
      type: String,
      default: function () {
        return `${this.firstName} ${this.lastName}`;
      },
    },
    email: {
      type: String,
      unique: true,
    },
    role: { type: String, enum: ["mr", "supervisor"], default: "mr" },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    assignedAreas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Area" }],
    assignedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
  },
  { timestamps: true }
);

export default mongoose.model("Mr", userSchema);
