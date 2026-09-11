import Employee from "../models/Employee.js";

export const IMMEDIATE_MANAGER_ROLE = {
  mr: "areaManager",
  areaManager: "zonalManager",
  zonalManager: null,
};

const formatPhone = (phoneNumber) => {
  if (phoneNumber === undefined || phoneNumber === null || phoneNumber === "") {
    return null;
  }
  return String(phoneNumber);
};

const getIdList = (values = []) =>
  (values?.toObject?.() ?? values ?? []).map((value) => String(value._id || value));

export const getManagerDisplayName = (manager) => {
  if (!manager) return null;
  const name = `${manager.firstName || ""} ${manager.lastName || ""}`.trim();
  return name || null;
};

export const preloadManagersForOrg = async (organizationId) =>
  Employee.find({
    organizationId,
    role: { $in: ["areaManager", "zonalManager"] },
    isActive: true,
  })
    .select(
      "firstName lastName employeeId role phoneNumber email assignedHeadQuarters assignedZones",
    )
    .lean();

export const resolveManagerFromPreloaded = (employee, managers = []) => {
  const managerRole = IMMEDIATE_MANAGER_ROLE[employee.role];
  if (!managerRole) return null;

  const employeeHqs = getIdList(employee.assignedHeadQuarters);
  const employeeZones = getIdList(employee.assignedZones);

  const manager = managers.find((candidate) => {
    if (candidate.role !== managerRole) return false;

    if (employee.role === "areaManager") {
      if (employeeZones.length) {
        const managerZones = getIdList(candidate.assignedZones);
        return employeeZones.every((zone) => managerZones.includes(zone));
      }
      const managerHqs = getIdList(candidate.assignedHeadQuarters);
      return employeeHqs.every((hq) => managerHqs.includes(hq));
    }

    const managerHqs = getIdList(candidate.assignedHeadQuarters);
    return employeeHqs.every((hq) => managerHqs.includes(hq));
  });

  if (!manager) return null;

  return {
    _id: manager._id,
    firstName: manager.firstName,
    lastName: manager.lastName,
    employeeId: manager.employeeId,
    role: manager.role,
    phone: formatPhone(manager.phoneNumber),
    email: manager.email,
  };
};

export const findImmediateManager = async (employee) => {
  const managerRole = IMMEDIATE_MANAGER_ROLE[employee.role];
  if (!managerRole) return null;

  const filter = {
    organizationId: employee.organizationId,
    role: managerRole,
    isActive: true,
  };

  if (employee.role === "areaManager") {
    const employeeZones =
      employee.assignedZones?.toObject?.() ?? employee.assignedZones ?? [];
    if (employeeZones.length) {
      filter.assignedZones = { $all: employeeZones };
    } else {
      const employeeHeadQuarters =
        employee.assignedHeadQuarters?.toObject?.() ??
        employee.assignedHeadQuarters ??
        [];
      filter.assignedHeadQuarters = { $all: employeeHeadQuarters };
    }
  } else {
    const employeeHeadQuarters =
      employee.assignedHeadQuarters?.toObject?.() ??
      employee.assignedHeadQuarters ??
      [];
    filter.assignedHeadQuarters = { $all: employeeHeadQuarters };
  }

  const manager = await Employee.findOne(filter)
    .select(
      "firstName lastName employeeId role phoneNumber email assignedHeadQuarters",
    )
    .populate("assignedHeadQuarters", "headQuarterName")
    .lean();

  if (!manager) return null;

  const employeeHqIds = new Set(
    (employee.assignedHeadQuarters || []).map((hq) => String(hq._id || hq)),
  );
  const overlappingHq = (manager.assignedHeadQuarters || []).find((hq) =>
    employeeHqIds.has(String(hq._id)),
  );
  const fallbackHq = manager.assignedHeadQuarters?.[0];

  return {
    _id: manager._id,
    firstName: manager.firstName,
    lastName: manager.lastName,
    employeeId: manager.employeeId,
    role: manager.role,
    phone: formatPhone(manager.phoneNumber),
    email: manager.email,
    headQuarterName:
      overlappingHq?.headQuarterName || fallbackHq?.headQuarterName || null,
  };
};
