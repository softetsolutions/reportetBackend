import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";

const EMPLOYEE_PROJECTION = {
  password: 0,
  assignedAreas: 0,
  assignedDoctors: 0,
  createdAt: 0,
  updatedAt: 0,
  __v: 0,
};

function tokenFromRequest(req, cookieName) {
  return req.cookies?.[cookieName] || req.headers["authorization"]?.split(" ")[1];
}

export const auth = async (req, res, next) => {
  try {
    const token = tokenFromRequest(req, "token");
    if (!token)
      return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.typ && decoded.typ !== "employee") {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    const employee = await Employee.findById(decoded.id, EMPLOYEE_PROJECTION);
    if (!employee)
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid Employee" });

    if (!employee.isActive) {
      return res.status(403).json({
        message:
          "Your account has been deactivated. Please contact your administrator.",
      });
    }

    req.employee = employee;

    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

export const orgAuth = async (req, res, next) => {
  try {
    const token = tokenFromRequest(req, "orgToken");

    if (!token)
      return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.typ && decoded.typ !== "org") {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    const org = await Organization.findById(decoded.id).select("-password");
    if (!org)
      return res.status(401).json({ message: "Unauthorized - Invalid org" });

    req.organization = org;
    next();
  } catch (error) {
    console.error("Org Auth Error:", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

export const authOrOrg = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && (req.cookies.token || req.cookies.orgToken)) {
      token = req.cookies.orgToken || req.cookies.token;
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const loadEmployee = async () => {
      const employee = await Employee.findById(decoded.id, EMPLOYEE_PROJECTION);
      if (!employee) return false;
      if (!employee.isActive) {
        res.status(403).json({
          message:
            "Your account has been deactivated. Please contact your administrator.",
        });
        return null;
      }
      req.employee = employee;
      return true;
    };

    const loadOrg = async () => {
      const org = await Organization.findById(decoded.id).select("-password");
      if (!org) return false;
      req.organization = org;
      return true;
    };

    if (decoded.typ === "employee") {
      const loaded = await loadEmployee();
      if (loaded === null) return;
      if (!loaded)
        return res
          .status(401)
          .json({ message: "Unauthorized - Invalid Employee" });
      return next();
    }

    if (decoded.typ === "org") {
      const loaded = await loadOrg();
      if (!loaded)
        return res.status(401).json({ message: "Unauthorized - Invalid org" });
      return next();
    }

    const employeeLoaded = await loadEmployee();
    if (employeeLoaded === null) return;
    if (employeeLoaded) return next();

    const orgLoaded = await loadOrg();
    if (orgLoaded) return next();

    return res.status(401).json({ message: "Unauthorized - No valid user" });
  } catch (err) {
    console.error("AuthOrOrg Error:", err.message);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.employee?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        message: "Forbidden - insufficient role",
      });
    }
    next();
  };
};
