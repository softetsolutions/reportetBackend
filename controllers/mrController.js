import Doctor from "../models/Doctor.js";
import Mr from "../models/Mr.js";
import bcrypt from "bcrypt";

export const createMr = async (req, res) => {
  try {
    const { firstName, lastName, userName, password } = req.body;

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
      "displayName _id",
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
    const mrs = await Mr.find(
      { organizationId: req.organization._id },
      { password: 0, organizationId: 0, __v: 0, createdAt: 0, updatedAt: 0 },
    )
      .populate("assignedAreas", "name")
      .populate("assignedDoctors", "name");

    res.status(200).json(mrs);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve MRs" });
  }
};

export const getMrAssignesDoctorAndArea = async (req, res) => {
  try {
    const mrAssignedDoctorsAndArea = await Mr.aggregate([
      {
        $match: { _id: req.mr._id },
      },
      {
        $project: {
          assignedAreas: 1,
          assignedDoctors: 1,
        },
      },

      // Populate Areas
      {
        $lookup: {
          from: "areas",
          let: { areaIds: "$assignedAreas" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", "$$areaIds"] },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
              },
            },
          ],
          as: "assignedAreas",
        },
      },

      // Populate Doctors
      {
        $lookup: {
          from: "doctors",
          let: { doctorIds: "$assignedDoctors" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", "$$doctorIds"] },
              },
            },

            // populate doctor.area
            {
              $lookup: {
                from: "areas",
                let: { areaId: "$areaId" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$_id", "$$areaId"] },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                    },
                  },
                ],
                as: "area",
              },
            },

            {
              $unwind: {
                path: "$area",
                preserveNullAndEmptyArrays: true,
              },
            },

            {
              $project: {
                _id: 1,
                name: 1,
                specialty: 1,
                area: 1,
              },
            },
          ],
          as: "assignedDoctors",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: mrAssignedDoctorsAndArea[0],
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};
