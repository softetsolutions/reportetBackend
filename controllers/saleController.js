import Sale from "../models/Sale.js";
import dayjs from "dayjs";

export const createSale = async (req, res) => {
  try {
    const { stockist, month, saleAmount } = req?.body;

    const monthName = new Date().toLocaleString("en-US", {
      month: "long",
    });

    const sale = await Sale.create({
      saleBy: req?.employee?._id,
      stockist: stockist,
      month: monthName.toLowerCase(),
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
        error: "Sales for this month from you is already submited.",
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
    let { employeeId, dateFrom, dateTo, pageNo = 1, limit = 10 } = req?.body;

    pageNo = Number(req.body.pageNo) || 1;
    limit = Number(req.body.limit) || 5;

    if (dateFrom && dateTo) {
      dateFrom = dayjs
        .tz(dateFrom, "Asia/Kolkata")
        .startOf("day")
        .utc()
        .toDate();
      dateTo = dayjs.tz(dateTo, "Asia/Kolkata").endOf("day").utc().toDate();
    }

    const filter = {
      organizationId: req?.organization?.id,
      ...(employeeId && { employeeId: employeeId }),
      ...(dateFrom &&
        dateTo && {
          createdAt: { $gte: dateFrom },
          createdAt: { $lte: dateTo },
        }),
    };

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
    const sale = await Sale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteSale = async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
