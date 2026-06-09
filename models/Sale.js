import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    stockist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stockist",
      required: true,
    },
    month: {
      type: String,
      enum: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      required: true,
    },
    saleAmount: { type: Number, required: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Sale", saleSchema);
