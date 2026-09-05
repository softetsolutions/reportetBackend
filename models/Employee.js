import mongoose from "mongoose";
import bcrypt from "bcrypt";

const employeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    userName: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },

    email: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
    password: { type: String, required: true },
    displayName: {
      type: String,
      default: function () {
        return `${this.firstName} ${this.lastName}`;
      },
    },
    role: {
      type: String,
      enum: ["mr", "areaManager", "zonalManager"],
      default: "mr",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // assignedAreas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Area" }],
    // assignedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
    assignedHeadQuarters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Headquarter" },
    ],
    assignedZones: [{ type: mongoose.Schema.Types.ObjectId, ref: "Zone" }],
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true },
);

employeeSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, phoneNumber: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model("Employee", employeeSchema);
