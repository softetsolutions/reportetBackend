import Sale from "../models/Sale.js";
import dayjs from "dayjs";
import { currentYearInIndia } from "../utils/helperFunction.js";

export const createSale = async (req, res) => {
  try {
    const { stockist, month, saleAmount } = req?.body;

    // const monthName = new Date().toLocaleString("en-US", {
    //   month: "long",
    // });

    const sale = await Sale.create({
      saleBy: req?.employee?._id,
      stockist: stockist,
      month: month.toLowerCase(),
      year: Number(currentYearInIndia),
      saleAmount: saleAmount,
      organizationId: req?.employee?.organizationId, // automatically assigned
    });

    res.status(201).json({
      success: true,
      data: sale,
    });
  } catch (err) {
    console.error("Error in creating sale", err);
    if (err?.code === 11000) {
      return res.status(500).json({
        success: false,
        error:
          "This month’s sales for this stockist have already been submitted by you.",
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const alreadySubmitedSale = async (req, res) => {
  try {
    const employeeId = req?.employee?._id;
    const organizationId = req?.employee?.organizationId;
    const monthName = new Date().toLocaleString("en-US", {
      month: "long",
    });

    const saleDetail = await Sale.findOne({
      saleBy: employeeId,
      month: monthName.toLowerCase(),
      organizationId: organizationId,
    });

    res.status(200).json({
      success: true,
      isAlreadySunmitedSales: Boolean(saleDetail),
      ...(Boolean(saleDetail) && { detail: saleDetail }),
    });
  } catch (error) {
    console.error("Unable to get the already");
    res.status(500).json({
      success: false,
      message: "Failed to get already submit details",
    });
  }
};

export const getSalesListOfEmployee = async (req, res) => {
  try {
    const employeeId = req.employee?._id;
    if (!employeeId) {
      res.status(500).json({ success: false, message: "Unauthorized" });
    }
    const { from, to, rowsPerPage = 10, pageNumber } = req.body;
    const limit = Math.min(parseInt(rowsPerPage) || 20, 50);
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    if (fromDate && isNaN(fromDate.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid from data",
      });
    }

    if (toDate && isNaN(toDate.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid to date",
      });
    }

    const saleVisitWithFilter = await Sale.find(
      {
        saleBy: employeeId,
        ...(fromDate && { createdAt: { $gte: from } }),
        ...(toDate && { createdAt: { $lte: to } }),
      },
      {
        _id: 1,
        stockist: 1,
        month: 1,
        saleAmount: 1,
        createdAt: 1,
      },
    )
      .populate("stockist", "_id name")
      .sort({ _id: -1 })
      .skip(rowsPerPage * (pageNumber - 1))
      .limit(limit + 1)
      .lean();

    res.status(200).json({
      success: true,
      data: saleVisitWithFilter.length
        ? saleVisitWithFilter.slice(0, rowsPerPage)
        : saleVisitWithFilter,
      hasMore: saleVisitWithFilter.length > rowsPerPage,
    });
  } catch (error) {
    console.error("Failed to fetch the sales list of employee", error);
    res.status(500).json({
      message: "Failed to retrieve sale list",
      error: error?.message,
    });
  }
};

export const getAllSales = async (req, res) => {
  try {
    let { employeeId, months,years, pageNo = 1, limit = 10 } = req?.body;

    pageNo = Number(req.body.pageNo) || 1;
    limit = Number(req.body.limit) || 5;

    // if (dateFrom && dateTo) {
    //   dateFrom = dayjs
    //     .tz(dateFrom, "Asia/Kolkata")
    //     .startOf("day")
    //     .utc()
    //     .toDate();
    //   dateTo = dayjs.tz(dateTo, "Asia/Kolkata").endOf("day").utc().toDate();
    // }

    const filter = {
      organizationId: req?.organization?.id,
      ...(employeeId && { employeeId: employeeId }),
      ...(months && months.length > 0 && { month: { $in: months } }),
      
    };

    if (years?.length > 0) {
  const yearConditions = years.map((year) => {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year}-12-31T23:59:59.999Z`);
    return { createdAt: { $gte: start, $lte: end } };
  });


  if (yearConditions.length === 1) {
    filter.createdAt = yearConditions[0].createdAt;
  } else {
    filter.$or = yearConditions;
  }
}

    const [sales, totalSalesCount] = await Promise.all([
      Sale.find(
        filter,
        {
          organizationId: 0,
          updatedAt: 0,
          __v: 0,
        },
        {
          skip: (pageNo - 1) * limit,
          limit,
        },
      )
        .populate("saleBy", "_id firstName lastName role")
        .populate("stockist", "_id name"),
      Sale.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: sales,
      saleCount: totalSalesCount,
    });
  } catch (error) {
    console.error("Unable to fetch all sales", error);
    res.status(500).json({
      success: false,
      messasge: error?.message,
    });
  }
};

export const updateSale = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedSale = await Sale.findOneAndUpdate(
      {
        _id: id,
        organizationId: req?.organization?.id, 
      },
      req.body,
      { new: true, runValidators: true }
    )
      .populate("saleBy", "_id firstName lastName role")
      .populate("stockist", "_id name");

    if (!updatedSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found or not part of your organization",
      });
    }

    res.status(200).json({ success: true, data: updatedSale });
  } catch (err) {
    console.error("Failed to update sale", err);
    res.status(400).json({ success: false, error: err.message });
  }
};

export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Sale.findOneAndDelete({
      _id: id,
      organizationId: req?.organization?.id, 
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Sale not found or not part of your organization",
      });
    }

    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("Failed to delete sale", err);
    res.status(400).json({ success: false, error: err.message });
  }
};