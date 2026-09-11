import Employee from "../models/Employee.js";
import LeaveType from "../models/LeaveType.js";
import EmployeeLeaveBalance from "../models/EmployeeLeaveBalance.js";
import Leave from "../models/Leave.js";

export const seedBalancesForLeaveType = async ({
  organizationId,
  leaveTypeId,
  annualQuota,
}) => {
  const employees = await Employee.find({
    organizationId,
    isActive: true,
  })
    .select("_id")
    .lean();

  if (!employees.length) return 0;

  const docs = employees.map((employee) => ({
    employeeId: employee._id,
    organizationId,
    leaveType: leaveTypeId,
    balance: annualQuota,
  }));

  try {
    const result = await EmployeeLeaveBalance.insertMany(docs, {
      ordered: false,
    });
    return result.length;
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors) {
      return docs.length - (error.writeErrors?.length || 0);
    }
    throw error;
  }
};

export const seedBalancesForEmployee = async ({
  organizationId,
  employeeId,
}) => {
  const leaveTypes = await LeaveType.find({
    organizationId,
    active: true,
  })
    .select("_id annualQuota")
    .lean();

  if (!leaveTypes.length) return 0;

  const docs = leaveTypes.map((type) => ({
    employeeId,
    organizationId,
    leaveType: type._id,
    balance: type.annualQuota,
  }));

  try {
    const result = await EmployeeLeaveBalance.insertMany(docs, {
      ordered: false,
    });
    return result.length;
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors) {
      return docs.length - (error.writeErrors?.length || 0);
    }
    throw error;
  }
};

export const ensureEmployeeLeaveBalance = async ({
  organizationId,
  employeeId,
  leaveTypeId,
  annualQuota,
}) => {
  const existing = await EmployeeLeaveBalance.findOne({
    organizationId,
    employeeId,
    leaveType: leaveTypeId,
  });

  if (existing) return existing;

  return EmployeeLeaveBalance.create({
    organizationId,
    employeeId,
    leaveType: leaveTypeId,
    balance: annualQuota,
  });
};

export const getAvailableLeaveBalance = async ({
  organizationId,
  employeeId,
  leaveTypeId,
}) => {
  const balanceDoc = await EmployeeLeaveBalance.findOne({
    organizationId,
    employeeId,
    leaveType: leaveTypeId,
  }).lean();

  if (!balanceDoc) return null;

  const pendingCount = await Leave.countDocuments({
    organizationId,
    employeeId,
    leaveType: leaveTypeId,
    status: "pending",
  });

  return {
    balance: balanceDoc.balance,
    pendingCount,
    available: balanceDoc.balance - pendingCount,
  };
};

export const decrementLeaveBalance = async ({
  organizationId,
  employeeId,
  leaveTypeId,
}) => {
  return EmployeeLeaveBalance.findOneAndUpdate(
    {
      organizationId,
      employeeId,
      leaveType: leaveTypeId,
      balance: { $gte: 1 },
    },
    { $inc: { balance: -1 } },
    { new: true },
  );
};

export const adjustBalancesForQuotaChange = async ({
  organizationId,
  leaveTypeId,
  oldQuota,
  newQuota,
}) => {
  const delta = newQuota - oldQuota;
  if (delta === 0) return;

  if (delta > 0) {
    await EmployeeLeaveBalance.updateMany(
      { organizationId, leaveType: leaveTypeId },
      { $inc: { balance: delta } },
    );
    return;
  }

  const balances = await EmployeeLeaveBalance.find({
    organizationId,
    leaveType: leaveTypeId,
  });

  await Promise.all(
    balances.map((doc) => {
      doc.balance = Math.max(0, doc.balance + delta);
      return doc.save();
    }),
  );
};
