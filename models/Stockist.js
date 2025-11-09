import mongoose from "mongoose";

const stockistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: String,
    state: String,
    gstNumber: String,
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Stockist", stockistSchema);
