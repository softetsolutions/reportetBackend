import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";

//Employee Auth Middleware
export const auth = async (req, res, next) => {
  // console.log("🔹 Cookies received in auth:", req.cookies);
  try {
    const token =
      req.cookies.token || req.headers["authorization"]?.split(" ")[1];
    console.log("🔹 Received token inside auth middleware:", token);
    if (!token)
      return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await Employee.findById(decoded.id, {
      password: 0,
      assignedAreas: 0,
      assignedDoctors: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    });
    if (!employee)
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid Employee" });

    req.employee = employee;
    console.log("🔹 Employee in auth middleware:", employee);

    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

// Organization Auth
export const orgAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies.orgToken || req.headers["authorization"]?.split(" ")[1];

    if (!token)
      return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //console.log("Decoded  org auth token:", decoded);
    const org = await Organization.findById(decoded.id);
    if (!org)
      return res.status(401).json({ message: "Unauthorized - Invalid org" });

    req.organization = org;
    console.log("Organisation id is", req.organization.id);
    next();
  } catch (error) {
    console.error("Org Auth Error:", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};
// middleware/authMiddleware.js

export const authOrOrg = async (req, res, next) => {
  try {
    let token = null;

    // 1️⃣ Try Bearer header first (used by mobile)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2️⃣ Fallback to cookies (used by web)
    if (!token && (req.cookies.token || req.cookies.orgToken)) {
      token = req.cookies.token || req.cookies.orgToken;
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    // 3️⃣ Verify and find either Employee or Organization
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find Employee
    const employee = await Employee.findById(decoded.id, {
      password: 0,
      assignedAreas: 0,
      assignedDoctors: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    });
    if (employee) {
      req.employee = employee;
      console.log("🔹 Employee in auth middleware:", employee);

      return next();
    }

    // Try to find Organization
    const org = await Organization.findById(decoded.id);
    if (org) {
      req.organization = org;
      return next();
    }

    return res.status(401).json({ message: "Unauthorized - No valid user" });
  } catch (err) {
    console.error("AuthOrOrg Error:", err.message);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};
