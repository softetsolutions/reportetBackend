import mongoose from "mongoose";
import HeadQuarter from "../models/HeadQuarter.js";
import Employee from "../models/Employee.js";
import brevo from "../config/mailer.js";
import sendMail from "../config/mailer.js";
import Area from "../models/Area.js";
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
    } = req.body;

    if (!role) {
      res.status(422).json({
        success: false,
        message: "Role is required while onboarding the employee",
      });
    } else if (role === "mr" && assignedHeadQuarters.length > 1) {
      res.status(422).json({
        success: false,
        message: "If role is mr then only an headquarter can be assigned",
      });
    }
    


    const data = await Employee.create({
      firstName: firstName,
      lastName: lastName,
      employeeId: employeeId,
    
      email: email,
      phoneNumber: phoneNumber,
      password: password,
      role: role,
      organizationId: req?.organization?.id,
      assignedHeadQuarters: assignedHeadQuarters,
    });

    sendMail(
      "Welcome to the team pls find the credential to log in mobile application",
      employeeId,
      
      password,
      [{ email: email, name: (firstName || "") + (lastName || "") }],
    ).catch((error) => console.error(error));
    console.log("New Employee created", data, "with password", password);

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
    const filter = { organizationId: req?.organization?.id };

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


export const getEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findOne({
      employeeId: employeeId,
      organizationId: req?.organization?.id,
    })
      .populate("assignedHeadQuarters", "headQuarterName _id")
      .select("-password -__v -updatedAt");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your organization",
      });
    }

    const hqIds = employee.assignedHeadQuarters.map((hq) => hq._id);

    const assignedAreas = await Area.find(
      { headQuarterId: { $in: hqIds }, organizationId: req?.organization?.id },
      { name: 1, _id: 1 }
    );

    const areaIds = assignedAreas.map((a) => a._id);

    const assignedDoctors = await Doctor.find(
      { areaId: { $in: areaIds }, organizationId: req?.organization?.id },
      { name: 1, specialty: 1, _id: 1 }
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
          (hq) => !existing.assignedHeadQuarters.map((h) => h.toString()).includes(hq)
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
      { new: true, runValidators: true }
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