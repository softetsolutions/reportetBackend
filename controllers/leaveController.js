import mongoose from "mongoose";
import Leave from "../models/Leave.js";
import Employee from "../models/Employee.js";
import LeaveType from "../models/LeaveType.js";
import EmployeeLeaveBalance from "../models/EmployeeLeaveBalance.js";
import { getSubordinateRoles } from "../utils/helperFunction.js";
import {
  seedBalancesForLeaveType,
  ensureEmployeeLeaveBalance,
  getAvailableLeaveBalance,
  decrementLeaveBalance,
  adjustBalancesForQuotaChange,
} from "../utils/leaveBalance.js";

const DIRECT_REPORT_ROLE = {
  areaManager: "mr",
  zonalManager: "areaManager",
  admin: "zonalManager",
};

const OTHER_REPORT_ROLES = {
  areaManager: [],
  zonalManager: ["mr"],
  admin: ["areaManager", "mr"],
};

const LEAVE_POPULATE = [
  {
    path: "employeeId",
    select: "firstName lastName employeeId role assignedHeadQuarters",
  },
  { path: "leaveType", select: "name code paid" },
];

const toObjectIdArray = (ids = []) =>
  (ids?.toObject?.() ?? ids).map((id) =>
    id instanceof mongoose.Types.ObjectId
      ? id
      : new mongoose.Types.ObjectId(String(id)),
  );

const buildHqSubsetFilter = (headQuarters) => ({
  assignedHeadQuarters: {
    $not: { $elemMatch: { $nin: headQuarters } },
    $ne: [],
  },
});

const getActorContext = (req) => {
  if (req.organization) {
    return {
      kind: "admin",
      role: "admin",
      organizationId: req.organization._id || req.organization.id,
      actorId: req.organization._id || req.organization.id,
    };
  }

  if (req.employee) {
    return {
      kind: "employee",
      role: req.employee.role,
      organizationId: req.employee.organizationId,
      actorId: req.employee._id,
      assignedHeadQuarters: toObjectIdArray(req.employee.assignedHeadQuarters),
    };
  }

  return null;
};

const findScopedEmployees = async ({
  organizationId,
  roles,
  assignedHeadQuarters,
  excludeId,
}) => {
  if (!roles?.length) return [];

  const filter = {
    organizationId,
    role: { $in: roles },
    isActive: true,
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  if (assignedHeadQuarters) {
    Object.assign(filter, buildHqSubsetFilter(assignedHeadQuarters));
  }

  return Employee.find(filter)
    .select("_id role firstName lastName employeeId")
    .lean();
};

const buildLeaveQuery = ({
  organizationId,
  employeeIds,
  status,
  leaveType,
  fromDate,
  toDate,
}) => {
  const filter = {
    organizationId,
    employeeId: { $in: employeeIds },
  };

  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;

  if (fromDate || toDate) {
    filter.leaveDate = {};
    if (fromDate) filter.leaveDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.leaveDate.$lte = end;
    }
  }

  return filter;
};

const canApproveApplicantRole = (actorRole, applicantRole) => {
  const subordinateRoles = getSubordinateRoles(actorRole, true);
  if (actorRole === "admin") {
    return ["mr", "areaManager", "zonalManager"].includes(applicantRole);
  }
  return subordinateRoles.includes(applicantRole);
};

const isEmployeeInActorScope = (employee, actor) => {
  if (actor.kind === "admin") {
    return (
      String(employee.organizationId) === String(actor.organizationId)
    );
  }

  const actorHqs = new Set(actor.assignedHeadQuarters.map(String));
  const employeeHqs = (employee.assignedHeadQuarters || []).map(String);

  if (!employeeHqs.length) return false;
  return employeeHqs.every((hq) => actorHqs.has(hq));
};

export const getLeaveTypes = async (req, res) => {
  try {
    const actor = getActorContext(req);
    if (!actor) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const includeInactive = req.query.includeInactive === "true";
    const filter = { organizationId: actor.organizationId };
    if (!includeInactive) filter.active = true;

    const leaveTypes = await LeaveType.find(filter)
      .select("-__v")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      leaveTypes,
    });
  } catch (error) {
    console.error("Error fetching leave types:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leave types",
    });
  }
};

export const createLeaveType = async (req, res) => {
  try {
    const organizationId = req.organization._id || req.organization.id;
    const {
      name,
      code,
      annualQuota,
      paid,
      creditWindow = "YEARLY",
      creditAmount,
      carryForward = false,
      maxCarryForward = 0,
      active = true,
    } = req.body;

    if (
      !name?.trim() ||
      !code?.trim() ||
      annualQuota === undefined ||
      annualQuota === null ||
      typeof paid !== "boolean"
    ) {
      return res.status(422).json({
        success: false,
        message: "name, code, annualQuota and paid are required",
      });
    }

    if (Number(annualQuota) < 0) {
      return res.status(422).json({
        success: false,
        message: "annualQuota cannot be negative",
      });
    }

    const leaveType = await LeaveType.create({
      organizationId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      annualQuota: Number(annualQuota),
      paid,
      creditWindow,
      creditAmount:
        creditAmount === undefined || creditAmount === null
          ? Number(annualQuota)
          : Number(creditAmount),
      carryForward: Boolean(carryForward),
      maxCarryForward: Number(maxCarryForward) || 0,
      active: Boolean(active),
    });

    if (leaveType.active) {
      await seedBalancesForLeaveType({
        organizationId,
        leaveTypeId: leaveType._id,
        annualQuota: leaveType.annualQuota,
      });
    }

    res.status(201).json({
      success: true,
      message: "Leave type created successfully",
      leaveType,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Leave type with this name already exists",
      });
    }
    console.error("Error creating leave type:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create leave type",
    });
  }
};

export const updateLeaveType = async (req, res) => {
  try {
    const organizationId = req.organization._id || req.organization.id;
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave type ID",
      });
    }

    const leaveType = await LeaveType.findOne({ _id: id, organizationId });
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    const {
      name,
      code,
      annualQuota,
      paid,
      creditWindow,
      creditAmount,
      carryForward,
      maxCarryForward,
      active,
    } = req.body;

    const oldQuota = leaveType.annualQuota;
    const wasActive = leaveType.active;

    if (name !== undefined) leaveType.name = String(name).trim();
    if (code !== undefined) leaveType.code = String(code).trim().toUpperCase();
    if (annualQuota !== undefined) {
      if (Number(annualQuota) < 0) {
        return res.status(422).json({
          success: false,
          message: "annualQuota cannot be negative",
        });
      }
      leaveType.annualQuota = Number(annualQuota);
    }
    if (typeof paid === "boolean") leaveType.paid = paid;
    if (creditWindow !== undefined) leaveType.creditWindow = creditWindow;
    if (creditAmount !== undefined) leaveType.creditAmount = Number(creditAmount);
    if (typeof carryForward === "boolean") leaveType.carryForward = carryForward;
    if (maxCarryForward !== undefined) {
      leaveType.maxCarryForward = Number(maxCarryForward) || 0;
    }
    if (typeof active === "boolean") leaveType.active = active;

    await leaveType.save();

    if (leaveType.annualQuota !== oldQuota) {
      await adjustBalancesForQuotaChange({
        organizationId,
        leaveTypeId: leaveType._id,
        oldQuota,
        newQuota: leaveType.annualQuota,
      });
    }

    if (!wasActive && leaveType.active) {
      await seedBalancesForLeaveType({
        organizationId,
        leaveTypeId: leaveType._id,
        annualQuota: leaveType.annualQuota,
      });
    }

    res.status(200).json({
      success: true,
      message: "Leave type updated successfully",
      leaveType,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Leave type with this name already exists",
      });
    }
    console.error("Error updating leave type:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update leave type",
    });
  }
};

export const getMyLeaveBalance = async (req, res) => {
  try {
    const organizationId = req.employee.organizationId;
    const employeeId = req.employee._id;

    const [leaveTypes, balanceDocs, approvedCounts] = await Promise.all([
      LeaveType.find({ organizationId, active: true })
        .select("name code paid annualQuota")
        .sort({ name: 1 })
        .lean(),
      EmployeeLeaveBalance.find({ organizationId, employeeId })
        .select("leaveType balance")
        .lean(),
      Leave.aggregate([
        {
          $match: {
            organizationId,
            employeeId,
            status: "approved",
          },
        },
        {
          $group: {
            _id: "$leaveType",
            used: { $sum: 1 },
          },
        },
      ]),
    ]);

    const balanceByType = new Map(
      balanceDocs.map((doc) => [String(doc.leaveType), doc]),
    );
    const usedByType = new Map(
      approvedCounts.map((row) => [String(row._id), row.used]),
    );

    const balances = leaveTypes.map((type) => {
      const typeId = String(type._id);
      const balanceDoc = balanceByType.get(typeId);
      const used = usedByType.get(typeId) ?? 0;
      const balance =
        balanceDoc?.balance ?? Math.max(type.annualQuota - used, 0);

      return {
        leaveType: type,
        balance,
        used,
        annualQuota: type.annualQuota,
      };
    });

    res.status(200).json({
      success: true,
      balances,
    });
  } catch (error) {
    console.error("Error fetching leave balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leave balance",
    });
  }
};

export const applyLeave = async (req, res) => {
  try {
    const { leaveType, date, reason } = req.body;
    const organizationId = req.employee.organizationId;
    const employeeId = req.employee._id;

    if (!leaveType || !date || !reason) {
      return res.status(422).json({
        success: false,
        message: "Leave type, date and reason are required",
      });
    }

    if (!mongoose.isObjectIdOrHexString(String(leaveType))) {
      return res.status(422).json({
        success: false,
        message: "Invalid leave type",
      });
    }

    if (Number.isNaN(new Date(date).getTime())) {
      return res.status(422).json({
        success: false,
        message: "Invalid leave date",
      });
    }

    const leaveTypeDoc = await LeaveType.findOne({
      _id: leaveType,
      organizationId,
      active: true,
    });

    if (!leaveTypeDoc) {
      return res.status(422).json({
        success: false,
        message: "Leave type not found or inactive",
      });
    }

    await ensureEmployeeLeaveBalance({
      organizationId,
      employeeId,
      leaveTypeId: leaveTypeDoc._id,
      annualQuota: leaveTypeDoc.annualQuota,
    });

    const availability = await getAvailableLeaveBalance({
      organizationId,
      employeeId,
      leaveTypeId: leaveTypeDoc._id,
    });

    if (!availability || availability.available < 1) {
      return res.status(422).json({
        success: false,
        message: "Insufficient leave balance",
      });
    }

    const leave = await Leave.create({
      employeeId,
      organizationId,
      leaveType: leaveTypeDoc._id,
      leaveDate: date,
      reason,
    });

    res.status(201).json({
      success: true,
      message: "Leave applied successfully",
      leave,
    });
  } catch (error) {
    console.error("Error applying leave:", error);
    res.status(500).json({ success: false, message: "Failed to apply leave" });
  }
};

export const getMyLeaves = async (req, res) => {
  try {
    const { status, leaveType, fromDate, toDate } = req.query;

    const filter = buildLeaveQuery({
      organizationId: req.employee.organizationId,
      employeeIds: [req.employee._id],
      status,
      leaveType,
      fromDate,
      toDate,
    });

    const leaves = await Leave.find(filter)
      .populate(LEAVE_POPULATE)
      .sort({ leaveDate: -1, createdAt: -1 });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch your leaves" });
  }
};

export const getSubordinateLeaves = async (req, res) => {
  try {
    const actor = getActorContext(req);
    if (!actor) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const directRole = DIRECT_REPORT_ROLE[actor.role];
    const otherRoles = OTHER_REPORT_ROLES[actor.role] || [];

    if (!directRole) {
      return res.status(200).json({
        success: true,
        message: "You do not have any subordinates",
        directReports: [],
        otherReports: [],
      });
    }

    const { status, leaveType, fromDate, toDate } = req.query;
    const scopeHqs =
      actor.kind === "employee" ? actor.assignedHeadQuarters : undefined;

    const [directEmployees, otherEmployees] = await Promise.all([
      findScopedEmployees({
        organizationId: actor.organizationId,
        roles: [directRole],
        assignedHeadQuarters: scopeHqs,
        excludeId: actor.kind === "employee" ? actor.actorId : undefined,
      }),
      findScopedEmployees({
        organizationId: actor.organizationId,
        roles: otherRoles,
        assignedHeadQuarters: scopeHqs,
        excludeId: actor.kind === "employee" ? actor.actorId : undefined,
      }),
    ]);

    const directIds = directEmployees.map((e) => e._id);
    const otherIds = otherEmployees.map((e) => e._id);

    const [directReports, otherReports] = await Promise.all([
      directIds.length
        ? Leave.find(
            buildLeaveQuery({
              organizationId: actor.organizationId,
              employeeIds: directIds,
              status,
              leaveType,
              fromDate,
              toDate,
            }),
          )
            .populate(LEAVE_POPULATE)
            .sort({ leaveDate: -1, createdAt: -1 })
        : [],
      otherIds.length
        ? Leave.find(
            buildLeaveQuery({
              organizationId: actor.organizationId,
              employeeIds: otherIds,
              status,
              leaveType,
              fromDate,
              toDate,
            }),
          )
            .populate(LEAVE_POPULATE)
            .sort({ leaveDate: -1, createdAt: -1 })
        : [],
    ]);

    res.status(200).json({
      success: true,
      directReports,
      otherReports,
    });
  } catch (error) {
    console.error("Error fetching subordinate leaves:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subordinate leaves",
    });
  }
};

export const actionOnLeave = async (req, res) => {
  try {
    const actor = getActorContext(req);
    if (!actor) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave ID",
      });
    }

    if (!["approved", "rejected"].includes(action)) {
      return res.status(422).json({
        success: false,
        message: "action must be approved or rejected",
      });
    }

    if (action === "rejected" && !rejectionReason?.trim()) {
      return res.status(422).json({
        success: false,
        message: "rejectionReason is required when rejecting",
      });
    }

    const leave = await Leave.findOne({
      _id: id,
      organizationId: actor.organizationId,
    }).populate("employeeId", "role organizationId assignedHeadQuarters");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    if (leave.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Leave is already ${leave.status}`,
      });
    }

    const applicant = leave.employeeId;
    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Leave applicant not found",
      });
    }

    if (!canApproveApplicantRole(actor.role, applicant.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to action this leave",
      });
    }

    if (!isEmployeeInActorScope(applicant, actor)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to action this leave",
      });
    }

    if (action === "approved") {
      const leaveTypeDoc = await LeaveType.findOne({
        _id: leave.leaveType,
        organizationId: actor.organizationId,
      });

      if (!leaveTypeDoc) {
        return res.status(422).json({
          success: false,
          message: "Leave type not found",
        });
      }

      await ensureEmployeeLeaveBalance({
        organizationId: actor.organizationId,
        employeeId: applicant._id,
        leaveTypeId: leave.leaveType,
        annualQuota: leaveTypeDoc.annualQuota,
      });

      const updatedBalance = await decrementLeaveBalance({
        organizationId: actor.organizationId,
        employeeId: applicant._id,
        leaveTypeId: leave.leaveType,
      });

      if (!updatedBalance) {
        return res.status(409).json({
          success: false,
          message: "Insufficient leave balance to approve",
        });
      }
    }

    leave.status = action;
    leave.approvedBy = actor.actorId;
    leave.approvedByRole = actor.role;
    leave.actionAt = new Date();
    leave.rejectionReason =
      action === "rejected" ? rejectionReason.trim() : null;

    await leave.save();

    const populated = await Leave.findById(leave._id).populate(LEAVE_POPULATE);

    res.status(200).json({
      success: true,
      message: `Leave ${action} successfully`,
      leave: populated,
    });
  } catch (error) {
    console.error("Error actioning leave:", error);
    res.status(500).json({ success: false, message: "Failed to action leave" });
  }
};
