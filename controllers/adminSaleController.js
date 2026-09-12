import Sale from "../models/Sale.js";
import Stockist from "../models/Stockist.js";
import { currentYearInIndia } from "../utils/helperFunction.js";

export const createSaleByAdmin = async (req, res) => {
  try {
    const organizationId = req?.organization?.id;
    const { stockist, month, saleAmount } = req?.body;

    if (!stockist || !month || !saleAmount) {
      return res.status(400).json({
        success: false,
        error: "stockist, month and saleAmount are required",
      });
    }

    
    const stockistDoc = await Stockist.findOne({
      _id: stockist,
      organizationId,
    });
    if (!stockistDoc) {
      return res.status(404).json({
        success: false,
        error: "Stockist not found in your organization",
      });
    }

    const sale = await Sale.create({
      saleBy: organizationId,
      saleByModel: "Organization",
      stockist: stockistDoc._id,
      month: month.toLowerCase(),
      year: Number(currentYearInIndia),
      saleAmount,
      organizationId,
    });

    res.status(201).json({
      success: true,
      data: sale,
    });
  } catch (err) {
    console.error("Error in creating sale by admin", err);
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "This month's sale for this stockist has already been submitted.",
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const alreadySubmitedSaleByAdmin = async (req, res) => {
  try {
    const organizationId = req?.organization?.id;
    const { stockist } = req.query;

    if (!stockist) {
      return res.status(400).json({
        success: false,
        message: "stockist is required",
      });
    }

    const monthName = new Date().toLocaleString("en-US", {
      month: "long",
    });

    const saleDetail = await Sale.findOne({
      saleBy: organizationId,
      stockist,
      month: monthName.toLowerCase(),
      year: Number(currentYearInIndia),
      organizationId,
    });

    res.status(200).json({
      success: true,
      isAlreadySunmitedSales: Boolean(saleDetail),
      ...(Boolean(saleDetail) && { detail: saleDetail }),
    });
  } catch (error) {
    console.error("Unable to check admin sale submission status", error);
    res.status(500).json({
      success: false,
      message: "Failed to get already submit details",
    });
  }
};