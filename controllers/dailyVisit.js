import DailyVisit from "../models/Daily-Visit.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import dayjs from "../utils/day.js";

function toISTDateString(isoString) {
  const date = dayjs(isoString);
  if (!date.isValid()) return null;
  return date.tz("Asia/Kolkata").format("YYYY-MM-DD");
}

// Create Daily Visit
export const createDailyVisit = async (req, res) => {
  try {
    const { areaId, doctorId, remark, visitDate } = req.body;
    const employeeId = req?.employee?._id;
    const organizationId = req?.employee?.organizationId;

    if (!areaId.length || !doctorId.length || !visitDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedVisitDate = dayjs(visitDate)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD");

    const dailyVisit = await DailyVisit.create({
      areaId,
      doctorId,
      employeeId,
      remark,
      organizationId,
      visitDate: normalizedVisitDate,
    });

    res.status(201).json({
      success: true,
      message: "Daily visit created successfully",
      submissionDetail: dailyVisit,
    });
  } catch (error) {
    console.error("Srroe in reporting daily visit", error);
    if (error?.code === 11000) {
      return res.status(500).json({
        success: false,
        error: "You have already submitted the daily visit report for this day",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getDailyVisitList = async (req, res) => {
  try {
    const employeeId = req.employee?._id;
    if (!employeeId) {
      res.status(500).json({ success: false, message: "Unauthorized" });
    }
    const { from, to, rowsPerPage = 10, pageNumber } = req.body;
    const limit = Math.min(parseInt(rowsPerPage) || 20, 50);
    const fromDate = toISTDateString(from);
    const toDate = toISTDateString(to);

    const dailyVisitWithFilter = await DailyVisit.find(
      {
        employeeId,
        ...(fromDate && { visitDate: { $gte: fromDate } }),
        ...(toDate && { visitDate: { $lte: toDate } }),
      },
      {
        _id: 1,
        date: 1,
        remark: 1,
        doctorId: 1,
        assistedBy: 1,
        createdAt: 1,
        visitDate: 1,
      },
    )
      .populate("doctorId", "_id name specialty")
      .populate("areaId", "name _id")
      .sort({ _id: 1 })
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

export const getOrganizationDailyVisitList = async (req, res) => {
  try {
    let { employeeId, dateFrom, dateTo, pageNo = 1, limit = 10 } = req?.body;
    pageNo = Number(req.body.pageNo) || 1;
    limit = Number(req.body.limit) || 5;

    const filter = {
      organizationId: req?.organization?.id,
      ...(employeeId && { employeeId: employeeId }),
      ...(dateFrom && { visitDate: { $gte: dateFrom } }),
      ...(dateTo && { visitDate: { $lte: dateTo } }),
    };

    const [dailyVistList, dailyVistListCount] = await Promise.all([
      DailyVisit.find(
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
        .populate("doctorId", "_id name specialty")
        .populate("areaId", "name _id")
        .populate("employeeId", "firstName lastName employeeId role")
        .populate("assistedBy", "firstName lastName employeeId "),
      DailyVisit.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: dailyVistList,
      dailyVistListCount: dailyVistListCount,
    });
  } catch (error) {
    console.error("Unable to get the dailyVisit", error);
    res.status(500).json({
      success: false,
      message: "Unable to get the visit details",
    });
  }
};

//complete dailyVisit list for the
export const getDailyVisitInfo = async (req, res) => {
  try {
    const employeeId = req?.employee?.id;
    const startOfDay = dayjs().tz("Asia/Kolkata").startOf("day").utc().toDate();

    const endOfDay = dayjs().tz("Asia/Kolkata").endOf("day").utc().toDate();

    const alreadySubmitted = await DailyVisit.find({
      employeeId,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .populate("doctorId", "_id name specialty")
      .populate("areaId", "name _id");

    if (alreadySubmitted?.length) {
      return res.status(200).json({
        success: true,
        message: "Today's visit report has already been submitted.",
        data: alreadySubmitted,
      });
    }
    res.status(200).json({
      success: false,
      message: "Today's visit report has not been submitted.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get the daily visit info",
      error: error.message,
    });
  }
};


// UPDATE a daily visit (orgAuth only)
export const updateDailyVisit = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedVisit = await DailyVisit.findOneAndUpdate(
      {
        _id: id,
        organizationId: req?.organization?.id, // scope to org for safety
      },
      req.body,
      { new: true, runValidators: true }
    )
      .populate("employeeId", "_id firstName lastName role")
      .populate("doctorId", "_id name")
      .populate("areaId", "_id name")
      .populate("assistedBy", "_id firstName lastName");

    if (!updatedVisit) {
      return res.status(404).json({
        success: false,
        message: "Daily visit not found or not part of your organization",
      });
    }

    res.status(200).json({ success: true, data: updatedVisit });
  } catch (error) {
    console.error("Failed to update daily visit", error);
    res.status(500).json({ success: false, message: error?.message });
  }
};

// DELETE a daily visit (orgAuth only)
export const deleteDailyVisit = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await DailyVisit.findOneAndDelete({
      _id: id,
      organizationId: req?.organization?.id, // scope to org for safety
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Daily visit not found or not part of your organization",
      });
    }

    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    console.error("Failed to delete daily visit", error);
    res.status(500).json({ success: false, message: error?.message });
  }
};