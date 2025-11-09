import Mr from "../models/Mr.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const login = async (req, res) => {
  try {
    const { userName, password } = req.body;

    // Find user|| !(await bcrypt.compare(password, user.password))
    const user = await Mr.findOne({ userName });
    if (!user ) {
      console.log("User not found");
      return res.status(401).json({ message: "Invalid credentials" });
    }
     const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("Password mismatch");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = generateToken(user._id);
 console.log("Login successful, token:", token);
    // Set token in secure HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
