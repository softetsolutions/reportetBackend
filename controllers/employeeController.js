import mongoose from "mongoose";
import HeadQuarter from "../models/HeadQuarter.js";
import Employee from "../models/Employee.js";
import brevo from "../config/mailer.js";
import sendMail from "../config/mailer.js";

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
