import mongoose from "mongoose";

const orgHolidaySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    /** YYYY-MM-DD in Asia/Kolkata calendar sense */
    date: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

orgHolidaySchema.index({ organizationId: 1, date: 1 }, { unique: true });
orgHolidaySchema.index({ organizationId: 1, date: 1, name: 1 });

export default mongoose.model("OrgHoliday", orgHolidaySchema);
