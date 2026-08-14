import mongoose from "mongoose";
import HeadQuarter from "../models/HeadQuarter.js";
import Employee from "../models/Employee.js";
import { sendMail, sendForgotPasswordMail } from "../config/mailer.js";
import {
  getSuperiorRoles,
  getSubordinateRoles,
} from "../utils/helperFunction.js";
import Area from "../models/Area.js";
import crypto from "crypto";
import Doctor from "../models/Doctor.js";

export const onboardEmployee = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      employeeId,
      password,
      email,
      phoneNumber,
      role,
      assignedHeadQuarters,
      assignedZones,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !employeeId ||
      !password ||
      !email ||
      !phoneNumber
    ) {
      return res.status(422).json({
        success: false,
        message:
          "One of the required field is missing. Pls fill all required field and try again later.",
      });
    }

    if (!role) {
      return res.status(422).json({
        success: false,
        message: "Role is required while onboarding the employee",
      });
    }

    if (role === "zonalManager") {
      if (!assignedZones || assignedZones.length === 0) {
        return res.status(422).json({
          success: false,
          message: "At least one zone must be assigned to a zonal manager",
        });
      }
    } else {
      // mr / areaManager still use headquarters
      if (role === "mr" && assignedHeadQuarters?.length > 1) {
        return res.status(422).json({
          success: false,
          message: "If role is mr then only an headquarter can be assigned",
        });
      }
      if (!assignedHeadQuarters || assignedHeadQuarters.length === 0) {
        return res.status(422).json({
          success: false,
          message: "At least one headquarter must be assigned",
        });
      }
    }

    const userName =
      req?.organization?.code && employeeId
        ? `${req?.organization?.code}_${employeeId}`
        : undefined;

    const data = await Employee.create({
      firstName,
      lastName,
      userName,
      employeeId,
      email,
      phoneNumber,
      password,
      role,
      organizationId: req?.organization?.id,
      assignedHeadQuarters: role === "zonalManager" ? [] : assignedHeadQuarters,
      assignedZones: role === "zonalManager" ? assignedZones : [],
    });

    sendMail(
      "Welcome to the team pls find the credential to log in mobile application",
      userName,
      password,
      [{ email: email, name: (firstName || "") + (lastName || "") }],
    ).catch((error) => console.error(error));

    res.status(200).json({
      success: true,
      message: "Employee onboarded successfuly",
    });
  } catch (error) {
    console.error("Error in onboarding employee", error);
    res.status(500).json({
      success: false,
      message: "Unable to onboard new Employee. Pls try again later",
    });
  }
};
export const paginatedEmployeeList = async (req, res) => {
  try {
    let { pageNo = 1, limit = 5 } = req.body;
    const { name, fromDate, toDate, role } = req.body;
    const filter = { organizationId: req?.organization?.id };
    if (role?.trim()) {
      filter.role = role.trim();
    }

    if (name?.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) {
        filter.$or = [
          { firstName: { $regex: parts[0], $options: "i" } },
          { lastName: { $regex: parts[0], $options: "i" } },
        ];
      } else {
        const first = parts[0];
        const last = parts.slice(1).join(" ");
        filter.$and = [
          { firstName: { $regex: first, $options: "i" } },
          { lastName: { $regex: last, $options: "i" } },
        ];
      }
    }

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [employee, totalEmployeeCount] = await Promise.all([
      Employee.find(
        filter,
        {
          __v: 0,
          updatedAt: 0,
          password: 0,
          organizationId: 0,
        },
        {
          skip: (pageNo - 1) * limit,
          limit: limit,
        },
      ).populate("assignedHeadQuarters", "headQuarterName _id"),
      Employee.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      employees: employee,
      employeeCount: totalEmployeeCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to fetch employee list",
    });
  }
};

export const getAllEmployeeOptions = async (req, res) => {
  try {
    const organizationId = req?.organization?.id;

    const employeeOptions = await Employee.find(
      {
        organizationId: organizationId,
      },
      {
        _id: 1,
        firstName: 1,
        lastName: 1,
      },
    );

    res.status(200).json({
      success: true,
      data: employeeOptions,
    });
  } catch (error) {
    console.error("Got error in geting employee options", error);
    res.status(500).json({
      success: false,
      message: "Problem in fetching all employees option. Pls try again later",
    });
  }
};

export const getEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findOne({
      employeeId: employeeId,
      organizationId: req?.organization?.id,
    })
      .populate("assignedHeadQuarters", "headQuarterName _id")
      .populate("assignedZones", "name _id")
      .select("-password -__v -updatedAt");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your organization",
      });
    }

    let assignedAreas = [];

    if (employee.role === "zonalManager") {
      const zoneIds = employee.assignedZones.map((z) => z._id);
      assignedAreas = await Area.find(
        { zoneId: { $in: zoneIds }, organizationId: req?.organization?.id },
        { name: 1, _id: 1 },
      );
    } else {
      const hqIds = employee.assignedHeadQuarters.map((hq) => hq._id);
      assignedAreas = await Area.find(
        {
          headQuarterId: { $in: hqIds },
          organizationId: req?.organization?.id,
        },
        { name: 1, _id: 1 },
      );
    }

    const areaIds = assignedAreas.map((a) => a._id);

    const assignedDoctors = await Doctor.find(
      { areaId: { $in: areaIds }, organizationId: req?.organization?.id },
      { name: 1, specialty: 1, _id: 1 },
    );

    res.status(200).json({
      success: true,
      employee: {
        ...employee.toObject(),
        assignedAreas,
        assignedDoctors,
      },
    });
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch employee data",
    });
  }
};
export const updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const allowedFields = [
      "firstName",
      "lastName",
      "email",
      "phoneNumber",
      "role",
      "assignedHeadQuarters",
      "assignedZones",
      "assignedAreas",
      "assignedDoctors",
      "isActive",
      "deactivatedAt",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (req.body.isActive !== undefined) {
      updates.isActive = req.body.isActive;
      updates.deactivatedAt = req.body.isActive ? null : new Date();
    }

    if (updates.firstName || updates.lastName) {
      const existing = await Employee.findOne({
        employeeId,
        organizationId: req?.organization?.id,
      });
      updates.displayName = `${updates.firstName || existing.firstName} ${updates.lastName || existing.lastName}`;
    }

    const { addHeadQuarters, removeHeadQuarters } = req.body;

    if (addHeadQuarters?.length) {
      const existing = await Employee.findOne({
        employeeId,
        organizationId: req?.organization?.id,
      }).select("role assignedHeadQuarters");

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Employee not found in your organization",
        });
      }

      if (existing.role === "mr") {
        const currentCount = existing.assignedHeadQuarters.length;
        const newUniqueCount = addHeadQuarters.filter(
          (hq) =>
            !existing.assignedHeadQuarters
              .map((h) => h.toString())
              .includes(hq),
        ).length;

        if (currentCount + newUniqueCount > 1) {
          return res.status(422).json({
            success: false,
            message: "MR can only be assigned to one headquarter",
          });
        }
      }
    }

    const mongoUpdate = {};

    if (Object.keys(updates).length) {
      mongoUpdate.$set = updates;
    }

    if (addHeadQuarters?.length) {
      mongoUpdate.$addToSet = {
        assignedHeadQuarters: { $each: addHeadQuarters },
      };
    }

    if (removeHeadQuarters?.length) {
      mongoUpdate.$pull = {
        assignedHeadQuarters: { $in: removeHeadQuarters },
      };
    }

    if (
      mongoUpdate.$set?.assignedHeadQuarters &&
      (mongoUpdate.$addToSet || mongoUpdate.$pull)
    ) {
      delete mongoUpdate.$set.assignedHeadQuarters;
    }

    const employee = await Employee.findOneAndUpdate(
      {
        employeeId: employeeId,
        organizationId: req?.organization?.id,
      },
      mongoUpdate,
      { new: true, runValidators: true },
    )
      .populate("assignedHeadQuarters", "headQuarterName _id")
      .select("-password -__v -updatedAt");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your organization",
      });
    }

    const message =
      req.body.isActive !== undefined
        ? `Employee ${employee.isActive ? "activated" : "deactivated"} successfully`
        : addHeadQuarters?.length
          ? "Headquarter(s) assigned successfully"
          : removeHeadQuarters?.length
            ? "Headquarter(s) unassigned successfully"
            : "Employee updated successfully";

    res.status(200).json({
      success: true,
      message,
      employee,
    });
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update employee",
    });
  }
};

export const getAssignedDoctorAndArea = async (req, res) => {
  try {
    // here we are expecting the employee details in the req object so pls ensure to use auth middleware

    let areas;

    if (req?.employee?.role === "zonalManager") {
      areas = await Area.find(
        { zoneId: { $in: req?.employee?.assignedZones } },
        { _id: 1, name: 1 },
      );
    } else {
      areas = await Area.find(
        { headQuarterId: { $in: req?.employee?.assignedHeadQuarters } },
        { _id: 1, name: 1 },
      );
    }

    const areaId = areas.map((area) => area._id);

    const doctors = await Doctor.find(
      {
        areaId: { $in: areaId },
      },
      {
        _id: 1,
        name: 1,
        specialty: 1,
        areaId: 1,
      },
    );

    res.status(200).json({
      success: true,
      data: {
        assignedAreas: areas,
        assignedDoctors: doctors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Can not get assigned doctor and area details",
    });
  }
};
export const forgotPassword = async (req, res) => {
  try {
    const { userName } = req.body;

    if (!userName?.trim()) {
      return res.status(422).json({
        success: false,
        message: "Username is required",
      });
    }

    const employee = await Employee.findOne({ userName: userName.trim() });

    if (!employee) {
      return res.status(200).json({
        success: true,
        message:
          "If this username exists, a reset link has been sent to the registered email.",
      });
    }

    if (!employee.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is deactivated. Please contact your administrator.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    employee.resetPasswordToken = hashedToken;
    employee.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await employee.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reportet/employee/reset-password/${rawToken}`;

    try {
      // await sendMail(
      //   "passwordReset",
      //   resetUrl,
      //   null,
      //   [{ email: employee.email, name: employee.displayName }],
      // );
      await sendForgotPasswordMail(resetUrl, [
        { email: employee.email, name: employee.displayName },
      ]);
    } catch (mailError) {
      employee.resetPasswordToken = null;
      employee.resetPasswordExpires = null;
      await employee.save({ validateBeforeSave: false });

      console.error("Mail send failed:", mailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If this username exists, a reset link has been sent to the registered email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(422).json({
        success: false,
        message: "Both password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(422).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(422).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const employee = await Employee.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!employee) {
      return res.status(400).json({
        success: false,
        message:
          "Reset link is invalid or has expired. Please request a new one.",
      });
    }

    employee.password = newPassword;
    employee.resetPasswordToken = null;
    employee.resetPasswordExpires = null;
    await employee.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

export const getSuperiors = async (req, res) => {
  try {
    if (!req?.employee) {
      res.status(403).json({
        success: false,
        message: "Sorry you are not employee",
      });
      return;
    }
    const role = req?.employee?.role;
    const organizationId = req?.employee?.organizationId;
    const subordinateRoles = getSubordinateRoles(role);

    const filter = {
      organizationId: organizationId,
      role: { $nin: subordinateRoles },
    };

    if (role === "zonalManager") {
      const employeeZones = req?.employee?.assignedZones?.toObject?.() ?? [];
      filter.assignedZones = { $all: employeeZones };
    } else {
      const employeeHeadQuarters =
        req?.employee?.assignedHeadQuarters?.toObject?.() ?? [];
      filter.assignedHeadQuarters = { $all: employeeHeadQuarters };
    }

    const superiorList = await Employee.find(filter, {
      firstName: 1,
      lastName: 1,
      role: 1,
    }).lean();

    res.status(200).json({
      success: true,
      data: superiorList,
    });
  } catch (error) {
    console.error("Error in geting superiors:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

export const getSubordinates = async (req, res) => {
  try {
    if (!req?.employee) {
      res.status(403).json({
        success: false,
        message: "Sorry you are not employee",
      });
      return;
    }
    const role = req?.employee?.role;
    const organizationId = req?.employee?.organizationId;
    const superiorRoles = getSuperiorRoles(role);

    const filter = {
      organizationId: organizationId,
      role: { $nin: superiorRoles },
    };

    if (role === "zonalManager") {
      const employeeZones = req?.employee?.assignedZones?.toObject?.() ?? [];
      filter.assignedZones = {
        $not: { $elemMatch: { $nin: employeeZones } },
        $ne: [],
      };
    } else {
      const employeeHeadQuarters =
        req?.employee?.assignedHeadQuarters?.toObject?.() ?? [];
      filter.assignedHeadQuarters = {
        $not: { $elemMatch: { $nin: employeeHeadQuarters } },
        $ne: [],
      };
    }

    const subordinateList = await Employee.find(filter, {
      firstName: 1,
      lastName: 1,
      role: 1,
    }).lean();

    res.status(200).json({
      success: true,
      data: subordinateList,
    });
  } catch (error) {
    console.error("Error in geting subordinates", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};
