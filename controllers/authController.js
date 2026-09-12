import Employee from "../models/Employee.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export const generateToken = (id, role, assignedHeadQuarter) =>
  jwt.sign({ id, role, assignedHeadQuarter, typ: "employee" }, process.env.JWT_SECRET);

export const login = async (req, res) => {
  try {
    const { userName, password } = req.body;

    const user = await Employee.findOne(
      { userName: userName },
      {
        firstName: 0,
        lastName: 0,
        displayName: 0,
        employeeId: 0,
        email: 0,
        phoneNumber: 0,
        userName: 0,
        deactivatedAt: 0,
        assignedAreas: 0,
        assignedDoctors: 0,
        createdAt: 0,
        updatedAt: 0,
        __v: 0,
      },
    ).populate("assignedHeadQuarters", "_id headQuarterName location");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account has been deactivated. Please contact your administrator.",
      });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id, user.role, user.assignedHeadQuarters);

    res.status(200).json({
      message: "Login successful",
      token: token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};
export const logout = (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
};
