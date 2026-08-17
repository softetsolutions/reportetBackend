import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    saleBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "saleByModel",
      required: true,
    },
    saleByModel: {
      type: String,
      enum: ["Organization", "Employee"],
      required: true,
    },
    stockist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stockist",
      required: true,
    },
    month: {
      type: String,
      enum: [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ],
      required: true,
    },
    year: { type: Number, required: true },
    saleAmount: { type: Number, required: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true },
);

saleSchema.index(
  { organizationId: 1, saleBy: 1, month: 1, year: 1, stockist: 1 },
  { unique: true },
);

export default mongoose.model("Sale", saleSchema);
