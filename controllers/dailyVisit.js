import DailyVisit from "../models/Daily-Visit.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import mongoose from "mongoose";

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

    const filter = { employeeId: employeeId };
    if (from || to) {
      filter.visitDate = {};
      if (from) {
        let fromDate = from.split("T")[0];
        filter.visitDate.$gte = fromDate;
      }
      if (to) {
        let toDate = to.split("T")[0];
        filter.visitDate.$lte = toDate;
      }
    }

    const dailyVisitWithFilter = await DailyVisit.find(filter, {
      _id: 1,
      date: 1,
      remark: 1,
      doctorId: 1,
      assistedBy: 1,
      createdAt: 1,
      visitDate: 1,
    })
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
    limit = Number(req.body.limit) || 10;

    const filter = {
      organizationId: req?.organization?.id,
      ...(employeeId && { employeeId: employeeId }),
    };
    if (dateFrom || dateTo) {
      filter.visitDate = {};
      if (dateFrom) {
        filter.visitDate.$gte = dateFrom;
      }
      if (dateTo) {
        filter.visitDate.$lte = dateTo;
      }
    }

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
      { new: true, runValidators: true },
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

export const getDoctorVisitReport = async (req, res) => {
  try {
    const {
      month,
      year,
      doctorId,
      doctorName,
      pageNo = 1,
      limit = 10,
      minVisits,
      maxVisits,
      headQuarterId,
    } = req.query;
    //const organizationId = req?.organization?.id;
    let organizationId;
    let employeeId;
    let restrictDoctorIds;
    let restrictHeadQuarterIds;

    if (req?.employee?._id) {
      let employee = req.employee;
      if (!employee.assignedDoctors) {
        employee = await mongoose
          .model("Employee")
          .findById(employee._id)
          .lean();
      }
      if (!employee) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }
      organizationId = employee.organizationId;
      employeeId = employee._id;

      restrictHeadQuarterIds = employee.assignedHeadQuarters;
    } else if (req?.organization?.id) {
      organizationId = req.organization.id;
    } else {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const page = Math.max(1, parseInt(pageNo));
    const perPage = Math.min(parseInt(limit) || 10, 50);
    const skip = (page - 1) * perPage;

    const doctorMatchStage = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };
    if (doctorId) {
      doctorMatchStage._id = new mongoose.Types.ObjectId(doctorId);
    }
    if (doctorName) {
      doctorMatchStage.name = { $regex: doctorName, $options: "i" };
    }

    // Conditions applied inside the lookup pipeline (on DailyVisit docs)
    const visitBaseMatch = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };
    if (employeeId) {
      visitBaseMatch.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    if (year && month) {
      visitBaseMatch.visitDate = {
        $regex: `^${year}-${String(month).padStart(2, "0")}`,
      };
    } else if (year) {
      visitBaseMatch.visitDate = { $regex: `^${year}-` };
    }

    const visitCountFilter = {};
    if (minVisits !== undefined && maxVisits !== undefined) {
      visitCountFilter.$gte = parseInt(minVisits);
      visitCountFilter.$lte = parseInt(maxVisits);
    } else if (minVisits !== undefined) {
      if (parseInt(minVisits) >= 3) {
        visitCountFilter.$gte = 3;
      } else {
        visitCountFilter.$eq = parseInt(minVisits);
      }
    }

    const hasVisitCountFilter = Object.keys(visitCountFilter).length > 0;
    let headQuarterMatch = [];
    if (headQuarterId) {
      if (
        restrictHeadQuarterIds &&
        !restrictHeadQuarterIds.map(String).includes(String(headQuarterId))
      ) {
        headQuarterMatch = [
          { $match: { "area.headQuarterId": new mongoose.Types.ObjectId() } },
        ];
      } else {
        headQuarterMatch = [
          {
            $match: {
              "area.headQuarterId": new mongoose.Types.ObjectId(headQuarterId),
            },
          },
        ];
      }
    } else if (restrictHeadQuarterIds) {
      headQuarterMatch = [
        {
          $match: {
            "area.headQuarterId": {
              $in: restrictHeadQuarterIds.map(
                (id) => new mongoose.Types.ObjectId(id),
              ),
            },
          },
        },
      ];
    }

    const basePipeline = [
      {
        $lookup: {
          from: "areas",
          localField: "areaId",
          foreignField: "_id",
          as: "area",
        },
      },
      { $unwind: { path: "$area", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "headquarters",
          localField: "area.headQuarterId",
          foreignField: "_id",
          as: "headquarter",
        },
      },
      { $unwind: { path: "$headquarter", preserveNullAndEmptyArrays: true } },
      ...headQuarterMatch,

      {
        $lookup: {
          from: "dailyvisits",
          let: { doctorId: "$_id" },
          pipeline: [
            { $match: visitBaseMatch },
            { $unwind: "$doctorId" },
            {
              $match: {
                $expr: { $eq: ["$$doctorId", "$doctorId"] },
              },
            },
          ],
          as: "visits",
        },
      },

      {
        $project: {
          _id: 0,
          doctorId: "$_id",
          doctorName: "$name",
          specialty: "$specialty",
          totalVisits: { $size: "$visits" },
          headQuarterName: "$headquarter.headQuarterName",
          visitDates: {
            $reduce: {
              input: "$visits.visitDate",
              initialValue: "",
              in: {
                $cond: [
                  { $eq: ["$$value", ""] },
                  "$$this",
                  { $concat: ["$$value", ", ", "$$this"] },
                ],
              },
            },
          },
        },
      },

      ...(hasVisitCountFilter
        ? [{ $match: { totalVisits: visitCountFilter } }]
        : []),
      { $sort: { totalVisits: -1, doctorName: 1 } },
    ];
    const headquarterFilter = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ...(restrictHeadQuarterIds
        ? {
            _id: {
              $in: restrictHeadQuarterIds.map(
                (id) => new mongoose.Types.ObjectId(id),
              ),
            },
          }
        : {}),
    };

    const [report, countResult, headquarters, maxVisitsResult] =
      await Promise.all([
        mongoose
          .model("Doctor")
          .aggregate([
            { $match: doctorMatchStage },
            ...basePipeline,
            { $skip: skip },
            { $limit: perPage },
          ]),
        mongoose
          .model("Doctor")
          .aggregate([
            { $match: doctorMatchStage },
            ...basePipeline,
            { $count: "total" },
          ]),

        mongoose
          .model("Headquarter")
          .find(headquarterFilter, { _id: 1, headQuarterName: 1 })
          .lean(),
        mongoose
          .model("Doctor")
          .aggregate([
            { $match: doctorMatchStage },
            ...basePipeline,
            { $group: { _id: null, max: { $max: "$totalVisits" } } },
          ]),
      ]);

    const maxTotalVisits = maxVisitsResult[0]?.max || 0;

    const total = countResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      maxTotalVisits,
      filters: { month, year, minVisits, maxVisits }, //,headquarters
      headquarters,
      data: report,
      pagination: {
        total,
        pageNo: page,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: page < Math.ceil(total / perPage),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to get doctor visit report", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubOrdinateDailyReport = async (req, res) => {
  try {
    if (req.employee?.role === "mr") {
      return res.status(400).json({
        success: false,
        message: "Bad request, You do not have any subordinates",
      });
    }

    const matchObject = {
      organizationId: req?.employee?.organizationId,
    };

    let {
      dateFrom = undefined,
      dateTo = undefined,
      pageNo = 1,
      limit = 5,
      selectedHeadQuarter = null,
    } = req?.body;

    pageNo = Math.max(1, Number(pageNo) || 1);
    limit = Math.max(1, Number(limit) || 5);

    if (dateFrom || dateTo) {
      matchObject.visitDate = {};
      if (dateFrom) matchObject.visitDate.$gte = dateFrom.split("T")[0];
      if (dateTo) matchObject.visitDate.$lte = dateTo.split("T")[0];
    }
    const employeFilter = { "employee.role": "mr" };

    let assignedHeadQuartersToCheck = selectedHeadQuarter[0]
      ? selectedHeadQuarter
      : req.employee.assignedHeadQuarters;

    if (selectedHeadQuarter[0]) {
      assignedHeadQuartersToCheck = assignedHeadQuartersToCheck
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }

    employeFilter["employee.assignedHeadQuarters.0"] = {
      $in: assignedHeadQuartersToCheck,
    };

    const subordinateDailyVisitReport = await DailyVisit.aggregate([
      {
        $match: matchObject,
      },
      {
        $project: {
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                role: 1,
                assignedHeadQuarters: 1,
              },
            },
          ],
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $match: employeFilter,
      },
      { $sort: { visitDate: -1, _id: -1 } },
      { $skip: limit * (pageNo - 1) },
      { $limit: limit + 1 },
      {
        $lookup: {
          from: "doctors",
          localField: "doctorId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "doctors",
        },
      },
      {
        $lookup: {
          from: "areas",
          localField: "areaId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "areas",
        },
      },
      { $unset: ["employeeId", "doctorId", "areaId"] },
    ]);

    res.status(200).json({
      success: true,
      data: subordinateDailyVisitReport.length
        ? subordinateDailyVisitReport.slice(0, limit)
        : subordinateDailyVisitReport,
      hasMore: subordinateDailyVisitReport.length > limit,
    });
  } catch (error) {
    console.error("Failed to get the daily visit report", error);
    res.status(500).json({ success: false, message: error?.message });
  }
};
