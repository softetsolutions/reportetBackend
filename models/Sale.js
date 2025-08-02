import mongoose from "mongoose";

const saleSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  stockist: { type: mongoose.Schema.Types.ObjectId, ref: 'Stockist', required: true },
  month: { type: String, required: true },
  saleAmount: { type: Number, required: true },
  organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
      },
}, { timestamps: true });

export default mongoose.model("Sale", saleSchema);
