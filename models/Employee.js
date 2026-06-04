import mongoose from "mongoose";
import bcrypt from "bcrypt";

const employeeSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    userName: { type: String, unique: true }, // replace userName with employeeId
    employeeId: { type: String, unique: true },
    email: String,
    phoneNumber: { type: Number, unique: true },
    password: String,
    displayName: {
      type: String,
      default: function () {
        return `${this.firstName} ${this.lastName}`;
      },
    },
    role: { type: String, enum: ["mr", "areaManager"], default: "mr" },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    assignedAreas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Area" }],
    assignedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
    assignedHeadQuarters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Headquarter" },
    ],
  },
  { timestamps: true },
);

employeeSchema.pre("save", async function () {
  this.password = await bcrypt.hash(this.password, 10);
});

employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export default mongoose.model("Employee", employeeSchema);
