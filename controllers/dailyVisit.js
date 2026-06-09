import DailyVisit from "../models/Daily-Visit.js";

// Create Daily Visit
export const createDailyVisit = async (req, res) => {
  try {
    const { date, areaId, doctorId, remark } = req.body;
    const mrId = req.mr._id;

    if (!date || !areaId || !doctorId || !mrId || !remark) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const dailyVisit = await DailyVisit.create({
      date,
      areaId,
      doctorId,
      mrId,
      remark,
    });

    res.status(201).json({
      success: true,
      message: "Daily visit created successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create daily visit",
      error: error.message,
    });
  }
};

// Get Doctors with Remarks
export const getDoctorsWithRemarks = async (req, res) => {
  try {
    const { mrId, areaId, startDate, endDate } = req.query;

    if (!mrId || !areaId || !startDate || !endDate) {
      return res.status(400).json({
        message: "mrId, areaId, startDate, and endDate are required",
      });
    }

    const visits = await DailyVisit.find({
      mrId,
      areaId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    })
      .populate("doctorId", "name _id")
      .select("doctorId remark -_id");

    res.status(200).json(visits);
  } catch (err) {
    console.error("failed to fetch visit", err.message);
    res.status(500).json({
      message: "Failed to retrieve doctors with remarks",
      error: err.message,
    });
  }
};

export const getDailyVisitList = async (req, res) => {
  try {
    const mrId = req.mr?._id;
    if (!mrId) {
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

    const dailyVisitWithFilter = await DailyVisit.find(
      {
        mrId,
        ...(fromDate && { createdAt: { $gte: from } }),
        ...(toDate && { createdAt: { $lte: to } }),
      },
      {
        _id: 1,
        date: 1,
        remark: 1,
        doctorId: 1,
      },
    )
      .populate("doctorId", "name _id")
      .sort({ _id: -1 })
      .skip(rowsPerPage * (pageNumber - 1))
      .limit(limit + 1)
      .lean();

    res.status(200).json({
      success: true,
      data: dailyVisitWithFilter.length
        ? dailyVisitWithFilter.slice(0, rowsPerPage)
        : dailyVisitWithFilter,
      hasMore: dailyVisitWithFilter.length > rowsPerPage,
    });
  } catch (error) {
    console.error("Failed to fetch daily visit", error);
    res.status(500).json({
      message: "Failed to retrieve daily visit",
      error: error.message,
    });
  }
};
