import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import DailyVisit from "../models/Daily-Visit.js";
import Sale from "../models/Sale.js";
import Doctor from "../models/Doctor.js";
import Leave from "../models/Leave.js";

const MONTH_NAMES = [
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
];

function getMonthYearRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const result = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= last) {
    result.push({
      month: MONTH_NAMES[cur.getMonth()],
      year: cur.getFullYear(),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

export const getCallAverageReport = async (req, res) => {
  try {
    const {
      startDate: queryStartDate,
      endDate: queryEndDate,
      headQuarterId,
    } = req.query;
    const organizationId = req.organization?._id;

    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    let startDate = queryStartDate;
    let endDate = queryEndDate;

    if (!startDate || !endDate) {
      const [span] = await DailyVisit.aggregate([
        { $match: { organizationId: orgObjectId } },
        {
          $group: {
            _id: null,
            minDate: { $min: "$visitDate" },
            maxDate: { $max: "$visitDate" },
          },
        },
      ]);
      const today = new Date().toISOString().slice(0, 10);
      startDate = startDate || span?.minDate || today;
      endDate = endDate || span?.maxDate || today;
    }

    const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);
    const totalCalendarDays =
      Math.floor((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;

    const employeeFilter = { organizationId: orgObjectId, isActive: true };
    if (headQuarterId) {
      const hqIds = headQuarterId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id));
      employeeFilter.assignedHeadQuarters = { $in: hqIds };
    }

    const employees = await Employee.find(employeeFilter)
      .populate("assignedHeadQuarters", "headQuarterName")
      .select("firstName lastName displayName assignedHeadQuarters")
      .lean();

    if (!employees.length) {
      return res.json({
        success: true,
        filters: { startDate, endDate, headQuarterId: headQuarterId || null },
        data: [],
      });
    }

    const employeeIds = employees.map((e) => e._id);
    const headQuarterIds = [
      ...new Set(
        employees.flatMap((e) =>
          (e.assignedHeadQuarters || []).map((h) => h._id.toString()),
        ),
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const visitStats = await DailyVisit.aggregate([
      {
        $match: {
          organizationId: orgObjectId,
          employeeId: { $in: employeeIds },
          visitDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$employeeId",
          totalVisits: { $sum: { $size: "$doctorId" } },
          doctorsVisited: { $push: "$doctorId" },
        },
      },
      {
        $project: {
          totalVisits: 1,
          doctorsVisited: {
            $reduce: {
              input: "$doctorsVisited",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] },
            },
          },
        },
      },
    ]);
    const visitStatsMap = new Map(visitStats.map((v) => [v._id.toString(), v]));

    const leaveStats = await Leave.aggregate([
      {
        $match: {
          organizationId: orgObjectId,
          employeeId: { $in: employeeIds },
          status: "approved",
          startDate: { $lte: rangeEnd },
          endDate: { $gte: rangeStart },
        },
      },
      {
        $project: {
          employeeId: 1,

          overlapStart: {
            $cond: [
              { $gt: ["$startDate", rangeStart] },
              "$startDate",
              rangeStart,
            ],
          },
          overlapEnd: {
            $cond: [{ $lt: ["$endDate", rangeEnd] }, "$endDate", rangeEnd],
          },
        },
      },
      {
        $project: {
          employeeId: 1,
          leaveDays: {
            $add: [
              {
                $floor: {
                  $divide: [
                    { $subtract: ["$overlapEnd", "$overlapStart"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
              1,
            ],
          },
        },
      },
      {
        $group: { _id: "$employeeId", totalLeaveDays: { $sum: "$leaveDays" } },
      },
    ]);
    const leaveStatsMap = new Map(
      leaveStats.map((l) => [l._id.toString(), l.totalLeaveDays]),
    );

    const monthYearPairs = getMonthYearRange(startDate, endDate);
    const saleStats = await Sale.aggregate([
      {
        $match: {
          organizationId: orgObjectId,
          saleBy: { $in: employeeIds },
          $or: monthYearPairs.map((p) => ({ month: p.month, year: p.year })),
        },
      },
      { $group: { _id: "$saleBy", totalSale: { $sum: "$saleAmount" } } },
    ]);
    const saleStatsMap = new Map(
      saleStats.map((s) => [s._id.toString(), s.totalSale]),
    );

    const doctorsByHQ = await Doctor.aggregate([
      { $match: { organizationId: orgObjectId } },
      {
        $lookup: {
          from: "areas",
          localField: "areaId",
          foreignField: "_id",
          as: "area",
        },
      },
      { $unwind: "$area" },
      { $match: { "area.headQuarterId": { $in: headQuarterIds } } },
      { $group: { _id: "$area.headQuarterId", doctorIds: { $push: "$_id" } } },
    ]);
    const doctorsByHQMap = new Map(
      doctorsByHQ.map((d) => [
        d._id.toString(),
        d.doctorIds.map((id) => id.toString()),
      ]),
    );

    const data = employees.map((emp) => {
      const stats = visitStatsMap.get(emp._id.toString());
      const totalVisits = stats?.totalVisits || 0;
      const doctorsVisited = new Set(
        (stats?.doctorsVisited || []).map((id) => id.toString()),
      );
      const totalSale = saleStatsMap.get(emp._id.toString()) || 0;

      const leaveDays = leaveStatsMap.get(emp._id.toString()) || 0;
      const workDays = Math.max(totalCalendarDays - leaveDays, 0);

      const hqIds = (emp.assignedHeadQuarters || []).map((h) =>
        h._id.toString(),
      );
      const doctorUniverse = new Set(
        hqIds.flatMap((hqId) => doctorsByHQMap.get(hqId) || []),
      );
      const missedDoctorCount = [...doctorUniverse].filter(
        (id) => !doctorsVisited.has(id),
      ).length;

      return {
        name: emp.displayName || `${emp.firstName} ${emp.lastName}`,
        headQuarterName: (emp.assignedHeadQuarters || [])
          .map((h) => h.headQuarterName)
          .join(", "),
        workDays,
        totalVisits,
        totalSale,
        missedDoctorCount,
      };
    });

    return res.json({
      success: true,
      filters: { startDate, endDate, headQuarterId: headQuarterId || null },
      data,
    });
  } catch (err) {
    console.error("callAverageReport error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
