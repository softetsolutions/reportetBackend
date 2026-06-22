import Leave from "../models/Leave.js";
import Employee from "../models/Employee.js";


export const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(422).json({
        success: false,
        message: "leaveType, startDate, endDate and reason are required",
      });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(422).json({
        success: false,
        message: "startDate cannot be after endDate",
      });
    }

    
    const leave = await Leave.create({
      employeeId: req.employee._id,
      organizationId: req.employee.organizationId,
      leaveType,
      startDate,
      endDate,
      reason,
    });

    res.status(201).json({
      success: true,
      message: "Leave applied successfully",
      leave,
    });
  } catch (error) {
    console.error("Error applying leave:", error);
    res.status(500).json({ success: false, message: "Failed to apply leave" });
  }
};


export const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.employee._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch your leaves" });
  }
};


export const getAllLeavesForAdmin = async (req, res) => {
  try {
    const { status, pageNo = 1, limit = 10, role } = req.body;

    const filter = { organizationId: req.organization.id };
    if (status) filter.status = status;

  
    if (role) {
      const employees = await Employee.find({
        organizationId: req.organization.id,
        role: role,
      }).select("_id");
      filter.employeeId = { $in: employees.map((e) => e._id) };
    }

    const [leaves, totalCount] = await Promise.all([
      Leave.find(filter)
        .populate("employeeId", "firstName lastName employeeId role")
        .populate("actionBy", "firstName lastName role")
        .sort({ createdAt: -1 })
        .skip((pageNo - 1) * limit)
        .limit(limit),
      Leave.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, leaves, totalCount });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch leaves" });
  }
};
export const getLeavesForAreaManager = async (req, res) => {
  try {
    const { status, pageNo = 1, limit = 10 } = req.body;

    const manager = await Employee.findById(req.employee._id).select(
      "assignedHeadQuarters assignedAreas"
    );

    
    const subordinates = await Employee.find({
      organizationId: req.employee.organizationId,
      role: "mr",
      assignedHeadQuarters: { $in: manager.assignedHeadQuarters },
    }).select("_id");

    const subordinateIds = subordinates.map((e) => e._id);

    const filter = {
      organizationId: req.employee.organizationId,
      employeeId: { $in: subordinateIds },
    };
    if (status) filter.status = status;

    const [leaves, totalCount] = await Promise.all([
      Leave.find(filter)
        .populate("employeeId", "firstName lastName employeeId role")
        .populate("actionBy", "firstName lastName role")
        .sort({ createdAt: -1 })
        .skip((pageNo - 1) * limit)
        .limit(limit),
      Leave.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, leaves, totalCount });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch leaves" });
  }
};

export const actionOnLeaveByAdmin = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { action, rejectionReason } = req.body; 

    if (!["approved", "rejected"].includes(action)) {
      return res
        .status(422)
        .json({ success: false, message: "action must be approved or rejected" });
    }

    if (action === "rejected" && !rejectionReason) {
      return res
        .status(422)
        .json({ success: false, message: "rejectionReason is required when rejecting" });
    }

    const leave = await Leave.findOne({
      _id: leaveId,
      organizationId: req.organization.id,
    });

    if (!leave) {
      return res
        .status(404)
        .json({ success: false, message: "Leave not found" });
    }

    if (leave.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Leave is already ${leave.status}`,
      });
    }

    leave.status = action;
    leave.actionBy = req.organization.id; 
    leave.actionByRole = "admin";
    leave.actionAt = new Date();
    if (action === "rejected") leave.rejectionReason = rejectionReason;

    await leave.save();

    res.status(200).json({
      success: true,
      message: `Leave ${action} successfully`,
      leave,
    });
  } catch (error) {
    console.error("Error actioning leave:", error);
    res.status(500).json({ success: false, message: "Failed to action leave" });
  }
};


export const actionOnLeaveByAreaManager = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(action)) {
      return res
        .status(422)
        .json({ success: false, message: "action must be approved or rejected" });
    }

    if (action === "rejected" && !rejectionReason) {
      return res
        .status(422)
        .json({ success: false, message: "rejectionReason is required when rejecting" });
    }

    const manager = await Employee.findById(req.employee._id).select(
      "assignedHeadQuarters organizationId"
    );

    const leave = await Leave.findById(leaveId).populate(
      "employeeId",
      "assignedHeadQuarters organizationId"
    );

    if (!leave) {
      return res
        .status(404)
        .json({ success: false, message: "Leave not found" });
    }

    
    const sameOrg =
      leave.employeeId.organizationId.toString() ===
      manager.organizationId.toString();

    const sharedHQ = leave.employeeId.assignedHeadQuarters.some((hq) =>
      manager.assignedHeadQuarters.map((h) => h.toString()).includes(hq.toString())
    );

    if (!sameOrg || !sharedHQ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to action this leave",
      });
    }

    if (leave.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Leave is already ${leave.status}`,
      });
    }

    leave.status = action;
    leave.actionBy = req.employee._id;
    leave.actionByRole = "areaManager";
    leave.actionAt = new Date();
    if (action === "rejected") leave.rejectionReason = rejectionReason;

    await leave.save();

    res.status(200).json({
      success: true,
      message: `Leave ${action} successfully`,
      leave,
    });
  } catch (error) {
    console.error("Error actioning leave by area manager:", error);
    res.status(500).json({ success: false, message: "Failed to action leave" });
  }
};