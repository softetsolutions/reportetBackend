import DailyVisit from "../models/Daily-Visit.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import dayjs from "../utils/day.js";

// Create Daily Visit
export const createDailyVisit = async (req, res) => {
  try {
    const { areaId, doctorId, remark } = req.body;
    const employeeId = req?.employee?._id;
    const organizationId = req?.employee?.organizationId;

    if (!areaId.length || !doctorId.length || !remark) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const dailyVisit = await DailyVisit.create({
      areaId,
      doctorId,
      employeeId,
      remark,
      organizationId,
    });

    console.log("dailyVisit is", dailyVisit);

    const submitedVisitDetails = await DailyVisit.findById(dailyVisit?.id, {
      updatedAt: 0,
      __v: 0,
    })
      .populate("doctorId", "_id name specialty")
      .populate("areaId", "name _id");

    res.status(201).json({
      success: true,
      message: "Daily visit created successfully",
      submissionDetail: submitedVisitDetails,
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

    const dailyVisitWithFilter = await DailyVisit.find(
      {
        employeeId,
        ...(fromDate && { createdAt: { $gte: from } }),
        ...(toDate && { createdAt: { $lte: to } }),
      },
      {
        _id: 1,
        date: 1,
        remark: 1,
        doctorId: 1,
        assistedBy: 1,
        createdAt: 1,
      },
    )
      .populate("doctorId", "_id name specialty")
      .populate("areaId", "name _id")
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

export const getOrganizationDailyVisitList = async (req, res) => {
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
      id: employeeId,
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
