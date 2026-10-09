import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import HeadQuarter from "../models/HeadQuarter.js";
import Zone from "../models/Zone.js";
import PromotionHistory from "../models/PromotionHistory.js";
import TrackingSession from "../models/TrackingSession.js";
import LiveLocation from "../models/LiveLocation.js";
import Trip from "../models/Trip.js";
import { Roles, roleOrder } from "../config/constants.js";

const ALLOWED_PROMOTIONS = {
  [Roles.MR]: Roles.AREA_MANAGER,
  [Roles.AREA_MANAGER]: Roles.ZONAL_MANAGER,
};

const toIdString = (value) => String(value?._id || value);

const toUniqueIdStrings = (values = []) => [
  ...new Set((values || []).map(toIdString).filter(Boolean)),
];

const isSubset = (candidateIds, ownerIds) => {
  const ownerSet = new Set(ownerIds.map(String));
  return candidateIds.every((id) => ownerSet.has(String(id)));
};

const getActor = (req) => {
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
      assignedHeadQuarters: (req.employee.assignedHeadQuarters || []).map(
        toIdString,
      ),
    };
  }

  return null;
};

const resolveMrToAmHeadQuarters = (employee, body) => {
  const currentHqs = toUniqueIdStrings(employee.assignedHeadQuarters);
  const hasReplace = Array.isArray(body.assignedHeadQuarters);
  const hasAdd = Array.isArray(body.addHeadQuarters);

  if (hasReplace && hasAdd) {
    return {
      error: {
        status: 422,
        message:
          "Provide either assignedHeadQuarters (replace) or addHeadQuarters (keep + add), not both",
      },
    };
  }

  if (hasReplace) {
    const finalHqs = toUniqueIdStrings(body.assignedHeadQuarters);
    if (!finalHqs.length) {
      return {
        error: {
          status: 422,
          message: "At least one headquarter must be assigned to an area manager",
        },
      };
    }
    return { finalHqs };
  }

  if (hasAdd) {
    const additions = toUniqueIdStrings(body.addHeadQuarters);
    if (!additions.length) {
      return {
        error: {
          status: 422,
          message: "addHeadQuarters must include at least one headquarter",
        },
      };
    }
    return { finalHqs: toUniqueIdStrings([...currentHqs, ...additions]) };
  }

  if (!currentHqs.length) {
    return {
      error: {
        status: 422,
        message:
          "Employee has no headquarters. Provide assignedHeadQuarters or addHeadQuarters",
      },
    };
  }

  return { finalHqs: currentHqs };
};

const validateHeadQuartersInOrg = async (hqIds, organizationId) => {
  const objectIds = hqIds.map((id) => new mongoose.Types.ObjectId(id));
  const hqs = await HeadQuarter.find({
    _id: { $in: objectIds },
    organizationId,
  })
    .select("_id headQuarterName")
    .lean();

  if (hqs.length !== hqIds.length) {
    return {
      error: {
        status: 422,
        message: "One or more headquarters are invalid for this organization",
      },
    };
  }

  return { hqs };
};

const findAmHqConflict = async ({
  organizationId,
  hqIds,
  excludeEmployeeId,
}) => {
  const conflictingAm = await Employee.findOne({
    organizationId,
    role: Roles.AREA_MANAGER,
    isActive: true,
    _id: { $ne: excludeEmployeeId },
    assignedHeadQuarters: { $in: hqIds },
  })
    .select("firstName lastName employeeId assignedHeadQuarters")
    .populate("assignedHeadQuarters", "headQuarterName")
    .lean();

  if (!conflictingAm) return null;

  const conflictHqIds = new Set(hqIds.map(String));
  const sharedHq = (conflictingAm.assignedHeadQuarters || []).find((hq) =>
    conflictHqIds.has(String(hq._id)),
  );

  const hqLabel = sharedHq?.headQuarterName || "selected headquarter";
  const amName =
    `${conflictingAm.firstName || ""} ${conflictingAm.lastName || ""}`.trim() ||
    "Area Manager";

  return {
    status: 422,
    message: `HQ "${hqLabel}" is already assigned to Area Manager ${amName} (${conflictingAm.employeeId})`,
  };
};

const disableMrTracking = async (employeeId) => {
  const activeSessions = await TrackingSession.find({
    employeeId,
    status: "active",
  }).select("_id startTime");

  const now = new Date();
  for (const session of activeSessions) {
    session.status = "completed";
    session.endTime = now;
    await session.save();

    await Trip.findOneAndUpdate(
      { sessionId: session._id, status: { $ne: "completed" } },
      {
        $set: {
          status: "completed",
          endTime: now,
          durationSeconds: Math.max(
            0,
            Math.round((now - session.startTime) / 1000),
          ),
        },
      },
    ).catch(() => null);
  }

  await LiveLocation.findOneAndUpdate(
    { employeeId },
    { isOnline: false, sessionId: null },
  ).catch(() => null);
};

const populateEmployee = (query) =>
  query
    .populate("assignedHeadQuarters", "headQuarterName _id location zone")
    .populate("assignedZones", "name _id")
    .select("-password -__v");

export const promoteEmployee = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!actor) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { employeeId } = req.params;
    const { toRole } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    if (!toRole || !roleOrder.includes(toRole)) {
      return res.status(422).json({
        success: false,
        message: "toRole must be areaManager or zonalManager",
      });
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: actor.organizationId,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your organization",
      });
    }

    if (!employee.isActive) {
      return res.status(422).json({
        success: false,
        message: "Cannot promote a deactivated employee",
      });
    }

    const expectedToRole = ALLOWED_PROMOTIONS[employee.role];
    if (!expectedToRole || expectedToRole !== toRole) {
      return res.status(422).json({
        success: false,
        message: `Invalid promotion. From ${employee.role} you can only promote to ${expectedToRole || "no further role"}`,
      });
    }

    if (actor.kind === "employee") {
      if (actor.role !== Roles.ZONAL_MANAGER) {
        return res.status(403).json({
          success: false,
          message: "Only organization admin or zonal manager can promote",
        });
      }
      if (toRole !== Roles.AREA_MANAGER || employee.role !== Roles.MR) {
        return res.status(403).json({
          success: false,
          message: "Zonal managers can only promote MR to area manager",
        });
      }
    }

    const fromRole = employee.role;
    const fromHeadQuarters = toUniqueIdStrings(employee.assignedHeadQuarters);
    const fromZones = toUniqueIdStrings(employee.assignedZones);

    let toHeadQuarters = [];
    let toZones = [];

    if (toRole === Roles.AREA_MANAGER) {
      const resolved = resolveMrToAmHeadQuarters(employee, req.body || {});
      if (resolved.error) {
        return res.status(resolved.error.status).json({
          success: false,
          message: resolved.error.message,
        });
      }

      const { finalHqs } = resolved;
      for (const hqId of finalHqs) {
        if (!mongoose.isObjectIdOrHexString(hqId)) {
          return res.status(422).json({
            success: false,
            message: "Invalid headquarter id in request",
          });
        }
      }

      const hqValidation = await validateHeadQuartersInOrg(
        finalHqs,
        actor.organizationId,
      );
      if (hqValidation.error) {
        return res.status(hqValidation.error.status).json({
          success: false,
          message: hqValidation.error.message,
        });
      }

      const conflict = await findAmHqConflict({
        organizationId: actor.organizationId,
        hqIds: finalHqs,
        excludeEmployeeId: employee._id,
      });
      if (conflict) {
        return res.status(conflict.status).json({
          success: false,
          message: conflict.message,
        });
      }

      if (actor.kind === "employee" && actor.role === Roles.ZONAL_MANAGER) {
        if (!isSubset(fromHeadQuarters, actor.assignedHeadQuarters)) {
          return res.status(403).json({
            success: false,
            message:
              "You can only promote MRs whose headquarters are inside your zone",
          });
        }
        if (!isSubset(finalHqs, actor.assignedHeadQuarters)) {
          return res.status(403).json({
            success: false,
            message:
              "New headquarters must be inside your assigned zonal territory",
          });
        }
      }

      toHeadQuarters = finalHqs;
      toZones = [];

      employee.role = Roles.AREA_MANAGER;
      employee.assignedHeadQuarters = finalHqs;
      employee.assignedZones = [];
    } else {
      // AM → ZM (admin only — already gated above for ZM actors)
      if (actor.kind !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only organization admin can promote area manager to zonal manager",
        });
      }

      const zoneIds = toUniqueIdStrings(req.body?.assignedZones);
      if (!zoneIds.length) {
        return res.status(422).json({
          success: false,
          message: "At least one zone must be assigned to a zonal manager",
        });
      }

      for (const zoneId of zoneIds) {
        if (!mongoose.isObjectIdOrHexString(zoneId)) {
          return res.status(422).json({
            success: false,
            message: "Invalid zone id in request",
          });
        }
      }

      const zones = await Zone.find({
        _id: { $in: zoneIds },
        organizationId: actor.organizationId,
      })
        .select("_id name")
        .lean();

      if (zones.length !== zoneIds.length) {
        return res.status(422).json({
          success: false,
          message: "One or more zones are invalid for this organization",
        });
      }

      const zoneHeadQuarters = await HeadQuarter.find(
        {
          zone: { $in: zoneIds },
          organizationId: actor.organizationId,
        },
        { _id: 1 },
      ).lean();

      toZones = zoneIds;
      toHeadQuarters = zoneHeadQuarters.map((hq) => String(hq._id));

      employee.role = Roles.ZONAL_MANAGER;
      employee.assignedZones = zoneIds;
      employee.assignedHeadQuarters = toHeadQuarters;
    }

    if (fromRole === Roles.MR) {
      await disableMrTracking(employee._id);
      employee.liveTrackingEnabled = false;
      employee.liveTrackingEnabledAt = null;
    }

    await employee.save();

    const history = await PromotionHistory.create({
      employeeId: employee._id,
      organizationId: actor.organizationId,
      fromRole,
      toRole,
      fromHeadQuarters,
      toHeadQuarters,
      fromZones,
      toZones,
      promotedByKind: actor.kind,
      promotedBy: actor.actorId,
      promotedByRole: actor.role === "admin" ? "admin" : "zonalManager",
    });

    const updatedEmployee = await populateEmployee(
      Employee.findById(employee._id),
    );

    return res.status(200).json({
      success: true,
      message: `Employee promoted from ${fromRole} to ${toRole}`,
      employee: updatedEmployee,
      promotion: history,
    });
  } catch (error) {
    console.error("Error promoting employee:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to promote employee",
    });
  }
};

export const getEmployeePromotions = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!actor) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (actor.kind === "employee" && actor.role !== Roles.ZONAL_MANAGER) {
      return res.status(403).json({
        success: false,
        message: "Only organization admin or zonal manager can view promotions",
      });
    }

    const { employeeId } = req.params;
    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: actor.organizationId,
    })
      .select("_id")
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your organization",
      });
    }

    const promotions = await PromotionHistory.find({
      organizationId: actor.organizationId,
      employeeId,
    })
      .populate("fromHeadQuarters", "headQuarterName _id")
      .populate("toHeadQuarters", "headQuarterName _id")
      .populate("fromZones", "name _id")
      .populate("toZones", "name _id")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      promotions,
    });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch promotions",
    });
  }
};
