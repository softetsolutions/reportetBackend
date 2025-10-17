import Doctor from "../models/Doctor.js";
import Mr from "../models/Mr.js";
import bcrypt from "bcrypt";

export const createMr = async (req, res) => {
  try {
    const { firstName, lastName, userName, password} = req.body;


    if (!firstName || !lastName || !userName || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const mr = await Mr.create({
      firstName,
      lastName,
      userName,
      
      password: hashed,
      organizationId: req.organization._id,
    });
    res.status(201).json(mr);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create MR", error: error.message });
  }
};

export const getMrByAreaId = async (req, res) => {
  try {
    const { areaId } = req.params;

    const mrs = await Mr.find({ assignedAreas: areaId }).select(
      "displayName _id"
    );

    if (mrs.length === 0)
      return res
        .status(404)
        .json({ message: "No MRs found for this location" });

    res.json(mrs);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve MRs by location name",
      error: error.message,
    });
  }
};

export const getAllMrs = async (req, res) => {
  try {
    const mrs = await Mr.find({ organizationId: req.organization._id });
    if (mrs.length === 0) {
      return res.status(404).json({ message: "No MRs found" });
    }
    res.status(200).json(mrs);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve MRs", error: error.message });
  }
};
