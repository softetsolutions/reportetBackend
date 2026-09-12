import mongoose from "mongoose";
import ExcelJS from "exceljs";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import LeaveType from "../models/LeaveType.js";
import {
  getManagerDisplayName,
  preloadManagersForOrg,
  resolveManagerFromPreloaded,
} from "../utils/employeeManager.js";

const VALID_ROLES = ["mr", "areaManager", "zonalManager"];

const getMonthDateRange = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
};

const buildEmployeeFilter = (organizationId, { employeeName, role }) => {
  const filter = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  };

  if (role) {
    filter.role = role;
  }

  if (employeeName?.trim()) {
    const parts = employeeName.trim().split(/\s+/);
    if (parts.length === 1) {
      filter.$or = [
        { firstName: { $regex: parts[0], $options: "i" } },
        { lastName: { $regex: parts[0], $options: "i" } },
      ];
    } else {
      const first = parts[0];
      const last = parts.slice(1).join(" ");
      filter.$and = [
        { firstName: { $regex: first, $options: "i" } },
        { lastName: { $regex: last, $options: "i" } },
      ];
    }
  }

  return filter;
};

const parseLeaveReportQuery = (query, { paginate = true } = {}) => {
  if (query.month === undefined || query.year === undefined) {
    return { error: "month and year are required" };
  }

  const month = Number(query.month);
  const year = Number(query.year);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Invalid month parameter" };
  }

  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    return { error: "Invalid year parameter" };
  }

  if (query.role && !VALID_ROLES.includes(query.role)) {
    return { error: "Invalid role parameter" };
  }

  const parsed = {
    month,
    year,
    employeeName: query.employeeName?.trim() || undefined,
    role: query.role || undefined,
  };

  if (paginate) {
    parsed.pageNo = Math.max(1, Number.parseInt(query.pageNo, 10) || 1);
    parsed.limit = Math.min(Math.max(1, Number.parseInt(query.limit, 10) || 10), 50);
  }

  return { value: parsed };
};

const buildEmployeeDisplayName = (employee) =>
  employee.displayName ||
  `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

const buildLeaveBreakdown = (typeCounts, leaveTypes) => {
  const countsByType = new Map(
    typeCounts.map((row) => [String(row.leaveType), row.days]),
  );

  return leaveTypes
    .map((type) => ({
      code: type.code,
      name: type.name,
      days: countsByType.get(String(type._id)) || 0,
    }))
    .filter((entry) => entry.days > 0);
};

export async function buildLeaveReportData({
  organizationId,
  month,
  year,
  employeeName,
  role,
  pageNo = 1,
  limit = 10,
  paginate = true,
}) {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const employeeFilter = buildEmployeeFilter(organizationId, {
    employeeName,
    role,
  });
  const { start, end } = getMonthDateRange(year, month);

  const employeeQuery = Employee.find(employeeFilter)
    .select(
      "employeeId firstName lastName displayName role assignedHeadQuarters assignedZones organizationId",
    )
    .sort({ firstName: 1, lastName: 1 });

  if (paginate) {
    employeeQuery.skip((pageNo - 1) * limit).limit(limit);
  }

  const [total, employees, leaveTypes, managers] = await Promise.all([
    paginate ? Employee.countDocuments(employeeFilter) : Promise.resolve(0),
    employeeQuery.lean(),
    LeaveType.find({ organizationId: orgObjectId, active: true })
      .select("name code")
      .sort({ name: 1 })
      .lean(),
    preloadManagersForOrg(organizationId),
  ]);

  const employeeIds = employees.map((employee) => employee._id);
  const aggregatedLeaveStats =
    employeeIds.length > 0
      ? await Leave.aggregate([
          {
            $match: {
              organizationId: orgObjectId,
              employeeId: { $in: employeeIds },
              status: "approved",
              leaveDate: { $gte: start, $lte: end },
            },
          },
          {
            $group: {
              _id: { employeeId: "$employeeId", leaveType: "$leaveType" },
              days: { $sum: 1 },
            },
          },
        ])
      : [];

  const leaveStatsByEmployee = new Map();
  for (const row of aggregatedLeaveStats) {
    const employeeKey = String(row._id.employeeId);
    if (!leaveStatsByEmployee.has(employeeKey)) {
      leaveStatsByEmployee.set(employeeKey, []);
    }
    leaveStatsByEmployee.get(employeeKey).push({
      leaveType: row._id.leaveType,
      days: row.days,
    });
  }

  const data = employees.map((employee) => {
    const typeCounts = leaveStatsByEmployee.get(String(employee._id)) || [];
    const leaveBreakdown = buildLeaveBreakdown(typeCounts, leaveTypes);
    const totalLeaves = leaveBreakdown.reduce((sum, entry) => sum + entry.days, 0);
    const manager = resolveManagerFromPreloaded(employee, managers);

    return {
      employeeId: employee.employeeId,
      employeeName: buildEmployeeDisplayName(employee),
      managerName: getManagerDisplayName(manager),
      role: employee.role,
      totalLeaves,
      leaveBreakdown,
    };
  });

  const resolvedTotal = paginate ? total : data.length;

  return {
    month,
    year,
    employeeName: employeeName || null,
    role: role || null,
    leaveTypes,
    data,
    total: resolvedTotal,
  };
}

export const getLeaveReport = async (req, res) => {
  try {
    const organizationId = req.organization?._id || req.organization?.id;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const parsed = parseLeaveReportQuery(req.query);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const { month, year, employeeName, role, pageNo, limit } = parsed.value;
    const result = await buildLeaveReportData({
      organizationId,
      month,
      year,
      employeeName,
      role,
      pageNo,
      limit,
      paginate: true,
    });

    return res.status(200).json({
      success: true,
      message: "Leave report fetched successfully",
      data: result.data,
      pagination: {
        total: result.total,
        pageNo,
        limit,
        totalPages: Math.ceil(result.total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("getLeaveReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave report",
    });
  }
};

export const exportLeaveReport = async (req, res) => {
  try {
    const organizationId = req.organization?._id || req.organization?.id;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const parsed = parseLeaveReportQuery(req.query, { paginate: false });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const { month, year, employeeName, role } = parsed.value;
    const result = await buildLeaveReportData({
      organizationId,
      month,
      year,
      employeeName,
      role,
      paginate: false,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Leave Report");

    const columns = [
      { header: "Employee ID", key: "employeeId", width: 16 },
      { header: "Employee Name", key: "employeeName", width: 24 },
      { header: "Manager Name", key: "managerName", width: 24 },
      { header: "Role", key: "role", width: 16 },
      ...result.leaveTypes.map((type) => ({
        header: type.code,
        key: type.code,
        width: 12,
      })),
      { header: "Total Leaves", key: "totalLeaves", width: 14 },
    ];

    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true };

    for (const row of result.data) {
      const breakdownByCode = Object.fromEntries(
        row.leaveBreakdown.map((entry) => [entry.code, entry.days]),
      );

      worksheet.addRow({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        managerName: row.managerName || "",
        role: row.role,
        totalLeaves: row.totalLeaves,
        ...Object.fromEntries(
          result.leaveTypes.map((type) => [
            type.code,
            breakdownByCode[type.code] || 0,
          ]),
        ),
      });
    }

    const monthLabel = String(month).padStart(2, "0");
    const fileName = `leave-report_${year}-${monthLabel}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("exportLeaveReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export leave report",
    });
  }
};
