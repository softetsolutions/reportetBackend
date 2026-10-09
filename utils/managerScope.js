import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import { getSubordinateRoles } from "./helperFunction.js";

export const DIRECT_REPORT_ROLE = {
  areaManager: "mr",
  zonalManager: "areaManager",
  admin: "zonalManager",
};

export const OTHER_REPORT_ROLES = {
  areaManager: [],
  zonalManager: ["mr"],
  admin: ["areaManager", "mr"],
};

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

export const getActorContext = (req) => {
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

export const findScopedEmployees = async ({
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
    .select(
      "_id role firstName lastName employeeId assignedHeadQuarters organizationId",
    )
    .lean();
};

export const canApproveApplicantRole = (actorRole, applicantRole) => {
  const subordinateRoles = getSubordinateRoles(actorRole, true);
  if (actorRole === "admin") {
    return ["mr", "areaManager", "zonalManager"].includes(applicantRole);
  }
  return subordinateRoles.includes(applicantRole);
};

export const isEmployeeInActorScope = (employee, actor) => {
  if (actor.kind === "admin") {
    return String(employee.organizationId) === String(actor.organizationId);
  }

  const actorHqs = new Set(actor.assignedHeadQuarters.map(String));
  const employeeHqs = (employee.assignedHeadQuarters || []).map(String);

  if (!employeeHqs.length) return false;
  return employeeHqs.every((hq) => actorHqs.has(hq));
};

/** Shared by leave and tour-plan manager list endpoints. */
export const resolveSubordinateGroups = async (actor) => {
  const directRole = DIRECT_REPORT_ROLE[actor.role];
  const otherRoles = OTHER_REPORT_ROLES[actor.role] || [];

  if (!directRole) {
    return {
      hasSubordinates: false,
      directEmployees: [],
      otherEmployees: [],
    };
  }

  const scopeHqs =
    actor.kind === "employee" ? actor.assignedHeadQuarters : undefined;
  const excludeId = actor.kind === "employee" ? actor.actorId : undefined;

  const [directEmployees, otherEmployees] = await Promise.all([
    findScopedEmployees({
      organizationId: actor.organizationId,
      roles: [directRole],
      assignedHeadQuarters: scopeHqs,
      excludeId,
    }),
    findScopedEmployees({
      organizationId: actor.organizationId,
      roles: otherRoles,
      assignedHeadQuarters: scopeHqs,
      excludeId,
    }),
  ]);

  return { hasSubordinates: true, directEmployees, otherEmployees };
};

/** Shared approve/reject body validation (leave + tour plan). */
export const parseApprovalAction = (body) => {
  const { action, rejectionReason } = body ?? {};

  if (!["approved", "rejected"].includes(action)) {
    return { error: "action must be approved or rejected" };
  }

  if (action === "rejected" && !rejectionReason?.trim()) {
    return { error: "rejectionReason is required when rejecting" };
  }

  return {
    action,
    rejectionReason: action === "rejected" ? rejectionReason.trim() : null,
  };
};

export const assertCanActionEmployee = (actor, applicant, resourceLabel) => {
  if (!canApproveApplicantRole(actor.role, applicant.role)) {
    return `You are not authorized to action this ${resourceLabel}`;
  }
  if (!isEmployeeInActorScope(applicant, actor)) {
    return `You are not authorized to action this ${resourceLabel}`;
  }
  return null;
};
