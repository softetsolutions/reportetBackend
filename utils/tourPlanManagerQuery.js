import {
  resolveSubordinateGroups,
} from "./managerScope.js";

const EMPLOYEE_ROLES = ["mr", "areaManager", "zonalManager"];

export const parseListFilters = (query) => {
  const role = query.role?.trim() || null;
  if (role && !EMPLOYEE_ROLES.includes(role)) {
    return { error: "role must be mr, areaManager, or zonalManager" };
  }

  return {
    status: query.status?.trim() || null,
    year: query.year ? Number(query.year) : null,
    month: query.month ? Number(query.month) : null,
    role,
    search: query.search?.trim() || query.name?.trim() || null,
  };
};

const matchesSearch = (employee, search) => {
  const regex = new RegExp(
    search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );
  const fullName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
  return (
    regex.test(employee.firstName || "") ||
    regex.test(employee.lastName || "") ||
    regex.test(fullName) ||
    regex.test(String(employee.employeeId || ""))
  );
};

/** Scoped employees for manager list, with optional role + name filters. */
export const resolveFilteredSubordinates = async (actor, filters) => {
  const groups = await resolveSubordinateGroups(actor);
  if (!groups.hasSubordinates) {
    return {
      hasSubordinates: false,
      employees: [],
      directIdSet: new Set(),
    };
  }

  const directIdSet = new Set(
    groups.directEmployees.map((e) => String(e._id)),
  );

  let employees = [...groups.directEmployees, ...groups.otherEmployees];

  if (filters.role) {
    employees = employees.filter((e) => e.role === filters.role);
  }

  if (filters.search) {
    employees = employees.filter((e) => matchesSearch(e, filters.search));
  }

  return {
    hasSubordinates: true,
    employees,
    directIdSet,
  };
};

export { EMPLOYEE_ROLES };
