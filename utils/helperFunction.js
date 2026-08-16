import { roleOrder } from "../config/constants.js";

export const generateOrganizationCode = (organizationName) => {
  const words = organizationName.trim().split(/\s+/);

  let baseCode = "";

  if (words.length === 1) {
    baseCode = words[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 6)
      .toUpperCase();
  } else {
    baseCode = words
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  const uniqueIdentifier = Math.floor(1000 + Math.random() * 9000);

  return `${baseCode}${uniqueIdentifier}`;
};

export const getCellStringValue = (value) => {
  if (value == null) return "";

  // plain string / number
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value?.hyperlink !== undefined && value?.text !== undefined) {
    return getCellStringValue(value.text);
  }

  // rich text cell
  if (value?.richText && Array.isArray(value.richText)) {
    return value.richText
      .map((item) => item.text || "")
      .join("")
      .trim();
  }

  // fallback
  return String(value).trim();
};

export const currentYearInIndia = new Date(
  new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
).getFullYear();

export const getSuperiorRoles = (employeeRole) => {
  const employeeRoleIndex = roleOrder.indexOf(employeeRole);
  return employeeRoleIndex === -1 ? [] : roleOrder.slice(employeeRoleIndex);
};

export const getSubordinateRoles = (employeeRole) => {
  const employeeRoleIndex = roleOrder.indexOf(employeeRole);
  return employeeRoleIndex === -1
    ? []
    : roleOrder.slice(0, employeeRoleIndex + 1);
};
