import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: String,
    specialty: String,
    category: String,
    dob: String,
    birthdayMonthDay: { type: String, index: true, default: null },
    lastBirthdayGreetingSentAt: { type: Date },
    phoneNumber: String,
    email: String,
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    areaId: { type: mongoose.Schema.Types.ObjectId, ref: "Area" },
    // assignedTo: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    // },
  },
  { timestamps: true },
);

doctorSchema.pre("save", function () {
  if (this.isModified("dob") && this.dob) {
    const parsed = new Date(this.dob);
    if (!isNaN(parsed.getTime())) {
      this.birthdayMonthDay = `${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    } else {
      this.birthdayMonthDay = null;
    }
  }
});

doctorSchema.index({ organizationId: 1, areaId: 1, name: 1 }, { unique: true });

export default mongoose.model("Doctor", doctorSchema);
