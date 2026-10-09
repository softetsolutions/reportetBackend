import mongoose from "mongoose";
import ExcelJS from "exceljs";
import Employee from "../models/Employee.js";
import EmployeeBankDetail from "../models/EmployeeBankDetail.js";
import EmployeeSalaryStructure from "../models/EmployeeSalaryStructure.js";
import OrgHoliday from "../models/OrgHoliday.js";
import PayrollRun from "../models/PayrollRun.js";
import Payslip from "../models/Payslip.js";
import PayrollSettings from "../models/PayrollSettings.js";
import Organization from "../models/Organization.js";
import {
  getOrCreatePayrollSettings,
  computeEmployeeMonthAttendance,
  resolveDivisorDays,
  computeLopAmount,
  sumLines,
  round2,
  monthBounds,
} from "../utils/payrollAttendance.js";

const orgIdFromReq = (req) => req.organization._id || req.organization.id;

const MONTH_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const findStructureForMonth = async (organizationId, employeeId, year, month) => {
  const { endDate } = monthBounds(year, month);
  return EmployeeSalaryStructure.findOne({
    organizationId,
    employeeId,
    effectiveFrom: { $lte: endDate },
  })
    .sort({ effectiveFrom: -1 })
    .lean();
};

const buildPayslipAmounts = ({
  structure,
  attendance,
  settings,
  finalLopDays,
}) => {
  const earnings = (structure.earnings || []).map((e) => ({
    code: e.code || "",
    label: e.label,
    amount: round2(e.amount),
  }));
  const deductions = (structure.deductions || []).map((d) => ({
    code: d.code || "",
    label: d.label,
    amount: round2(d.amount),
  }));
  const gross = sumLines(earnings);
  const structureDeductions = sumLines(deductions);
  const divisorDays = resolveDivisorDays(attendance, settings.lopDivisorMethod);
  const lopAmount = computeLopAmount(gross, finalLopDays, divisorDays);
  const netPay = round2(Math.max(gross - structureDeductions - lopAmount, 0));
  return { earnings, deductions, gross, structureDeductions, lopAmount, netPay };
};

const refreshRunTotals = async (runId) => {
  const slips = await Payslip.find({ payrollRunId: runId }).lean();
  const payable = slips.filter((s) => s.status !== "onHold");
  await PayrollRun.findByIdAndUpdate(runId, {
    employeeCount: slips.length,
    grossTotal: round2(payable.reduce((s, p) => s + p.gross, 0)),
    deductionTotal: round2(
      payable.reduce((s, p) => s + p.structureDeductions, 0),
    ),
    lopTotal: round2(payable.reduce((s, p) => s + p.lopAmount, 0)),
    netTotal: round2(payable.reduce((s, p) => s + p.netPay, 0)),
  });
};

const generatePayslipsForRun = async ({
  run,
  organizationId,
  settings,
  replaceExisting,
}) => {
  if (replaceExisting) {
    await Payslip.deleteMany({
      payrollRunId: run._id,
      status: { $ne: "finalized" },
    });
  }

  const employees = await Employee.find({
    organizationId,
    isActive: true,
  })
    .select("_id firstName lastName employeeId role")
    .lean();

  const skippedNoStructure = [];
  const created = [];

  for (const employee of employees) {
    const structure = await findStructureForMonth(
      organizationId,
      employee._id,
      run.year,
      run.month,
    );
    if (!structure) {
      skippedNoStructure.push({
        employeeId: employee._id,
        code: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
      });
      continue;
    }

    const existing = await Payslip.findOne({
      payrollRunId: run._id,
      employeeId: employee._id,
    }).lean();
    if (existing?.status === "finalized") continue;

    const attendance = await computeEmployeeMonthAttendance({
      organizationId,
      employeeId: employee._id,
      year: run.year,
      month: run.month,
      settings,
    });

    const bank = await EmployeeBankDetail.findOne({
      organizationId,
      employeeId: employee._id,
    }).lean();

    const finalLopDays = attendance.suggestedLopDays;
    const amounts = buildPayslipAmounts({
      structure,
      attendance,
      settings,
      finalLopDays,
    });

    const payload = {
      organizationId,
      payrollRunId: run._id,
      employeeId: employee._id,
      month: run.month,
      year: run.year,
      status: "draft",
      salaryStructureId: structure._id,
      ...amounts,
      finalLopDays,
      attendance,
      bankSnapshot: bank
        ? {
            accountHolderName: bank.accountHolderName,
            accountNumber: bank.accountNumber,
            ifsc: bank.ifsc,
            bankName: bank.bankName || "",
            accountType: bank.accountType || "",
          }
        : {},
      holdReason: null,
      currency: structure.currency || "INR",
    };

    if (existing) {
      await Payslip.findByIdAndUpdate(existing._id, { $set: payload });
      created.push(existing._id);
    } else {
      const slip = await Payslip.create(payload);
      created.push(slip._id);
    }
  }

  await PayrollRun.findByIdAndUpdate(run._id, {
    skippedNoStructure: skippedNoStructure.length,
  });
  await refreshRunTotals(run._id);

  return { skippedNoStructure, createdCount: created.length };
};

// ─── Settings & holidays ───────────────────────────────────────────

export const getPayrollSettings = async (req, res) => {
  try {
    const settings = await getOrCreatePayrollSettings(orgIdFromReq(req));
    res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error("getPayrollSettings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
};

export const updatePayrollSettings = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { weeklyOffWeekdays, lopDivisorMethod, payslipTemplate } =
      req.body || {};

    const updates = {};
    if (weeklyOffWeekdays !== undefined) {
      if (
        !Array.isArray(weeklyOffWeekdays) ||
        !weeklyOffWeekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      ) {
        return res.status(422).json({
          success: false,
          message: "weeklyOffWeekdays must be an array of integers 0-6 (0=Sunday)",
        });
      }
      updates.weeklyOffWeekdays = [...new Set(weeklyOffWeekdays)];
    }
    if (lopDivisorMethod !== undefined) {
      if (!["calendar_days", "working_days"].includes(lopDivisorMethod)) {
        return res.status(422).json({
          success: false,
          message: "lopDivisorMethod must be calendar_days or working_days",
        });
      }
      updates.lopDivisorMethod = lopDivisorMethod;
    }
    if (payslipTemplate !== undefined) {
      if (!["classic", "modern", "compact"].includes(payslipTemplate)) {
        return res.status(422).json({
          success: false,
          message: "payslipTemplate must be classic, modern, or compact",
        });
      }
      updates.payslipTemplate = payslipTemplate;
    }

    await getOrCreatePayrollSettings(organizationId);
    const settings = await PayrollSettings.findOneAndUpdate(
      { organizationId },
      { $set: updates },
      { new: true },
    );
    res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error("updatePayrollSettings:", error);
    res.status(500).json({ success: false, message: "Failed to update settings" });
  }
};

export const listHolidays = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { year } = req.query;
    const filter = { organizationId };
    if (year) {
      filter.date = {
        $gte: `${year}-01-01`,
        $lte: `${year}-12-31`,
      };
    }
    const holidays = await OrgHoliday.find(filter).sort({ date: 1 }).lean();
    res.status(200).json({ success: true, holidays });
  } catch (error) {
    console.error("listHolidays:", error);
    res.status(500).json({ success: false, message: "Failed to list holidays" });
  }
};

export const upsertHoliday = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { date, name } = req.body || {};
    if (!date || !name?.trim()) {
      return res.status(422).json({
        success: false,
        message: "date (YYYY-MM-DD) and name are required",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(422).json({
        success: false,
        message: "date must be YYYY-MM-DD",
      });
    }

    const holiday = await OrgHoliday.findOneAndUpdate(
      { organizationId, date },
      { $set: { name: name.trim() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, holiday });
  } catch (error) {
    console.error("upsertHoliday:", error);
    res.status(500).json({ success: false, message: "Failed to save holiday" });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { holidayId } = req.params;
    if (!mongoose.isObjectIdOrHexString(holidayId)) {
      return res.status(400).json({ success: false, message: "Invalid holiday id" });
    }
    const deleted = await OrgHoliday.findOneAndDelete({
      _id: holidayId,
      organizationId,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Holiday not found" });
    }
    res.status(200).json({ success: true, message: "Holiday deleted" });
  } catch (error) {
    console.error("deleteHoliday:", error);
    res.status(500).json({ success: false, message: "Failed to delete holiday" });
  }
};

// ─── Bank details ──────────────────────────────────────────────────

export const getEmployeeBankDetails = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { employeeId } = req.params;
    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee id" });
    }
    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select("_id")
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    const bankDetails = await EmployeeBankDetail.findOne({
      organizationId,
      employeeId,
    }).lean();
    res.status(200).json({ success: true, bankDetails: bankDetails || null });
  } catch (error) {
    console.error("getEmployeeBankDetails:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bank details" });
  }
};

export const upsertEmployeeBankDetails = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { employeeId } = req.params;
    const {
      accountHolderName,
      accountNumber,
      ifsc,
      bankName = "",
      accountType = "savings",
    } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee id" });
    }
    if (!accountHolderName?.trim() || !accountNumber?.trim() || !ifsc?.trim()) {
      return res.status(422).json({
        success: false,
        message: "accountHolderName, accountNumber and ifsc are required",
      });
    }

    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select("_id")
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const bankDetails = await EmployeeBankDetail.findOneAndUpdate(
      { organizationId, employeeId },
      {
        $set: {
          accountHolderName: accountHolderName.trim(),
          accountNumber: String(accountNumber).trim(),
          ifsc: String(ifsc).trim().toUpperCase(),
          bankName: String(bankName || "").trim(),
          accountType: ["savings", "current"].includes(accountType)
            ? accountType
            : "savings",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ success: true, bankDetails });
  } catch (error) {
    console.error("upsertEmployeeBankDetails:", error);
    res.status(500).json({ success: false, message: "Failed to save bank details" });
  }
};

// ─── Salary structures ─────────────────────────────────────────────

export const createSalaryStructure = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { employeeId } = req.params;
    const { effectiveFrom, earnings, deductions = [], currency = "INR" } =
      req.body || {};

    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee id" });
    }
    if (!effectiveFrom || !Array.isArray(earnings) || !earnings.length) {
      return res.status(422).json({
        success: false,
        message: "effectiveFrom and at least one earning line are required",
      });
    }

    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select("_id")
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const normalizedEarnings = earnings.map((e) => ({
      code: e.code || "",
      label: String(e.label || "").trim(),
      amount: Number(e.amount),
    }));
    if (normalizedEarnings.some((e) => !e.label || Number.isNaN(e.amount) || e.amount < 0)) {
      return res.status(422).json({
        success: false,
        message: "Each earning needs label and non-negative amount",
      });
    }

    const normalizedDeductions = (deductions || []).map((d) => ({
      code: d.code || "",
      label: String(d.label || "").trim(),
      amount: Number(d.amount),
    }));
    if (
      normalizedDeductions.some(
        (d) => !d.label || Number.isNaN(d.amount) || d.amount < 0,
      )
    ) {
      return res.status(422).json({
        success: false,
        message: "Each deduction needs label and non-negative amount",
      });
    }

    const structure = await EmployeeSalaryStructure.create({
      organizationId,
      employeeId,
      effectiveFrom: new Date(effectiveFrom),
      currency,
      earnings: normalizedEarnings,
      deductions: normalizedDeductions,
    });

    res.status(201).json({ success: true, structure });
  } catch (error) {
    console.error("createSalaryStructure:", error);
    res.status(500).json({ success: false, message: "Failed to create salary structure" });
  }
};

export const listSalaryStructures = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { employeeId } = req.params;
    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee id" });
    }
    const structures = await EmployeeSalaryStructure.find({
      organizationId,
      employeeId,
    })
      .sort({ effectiveFrom: -1 })
      .lean();
    res.status(200).json({ success: true, structures });
  } catch (error) {
    console.error("listSalaryStructures:", error);
    res.status(500).json({ success: false, message: "Failed to list structures" });
  }
};

export const getCurrentSalaryStructure = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { employeeId } = req.params;
    const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();

    if (!mongoose.isObjectIdOrHexString(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee id" });
    }

    const structure = await EmployeeSalaryStructure.findOne({
      organizationId,
      employeeId,
      effectiveFrom: { $lte: asOf },
    })
      .sort({ effectiveFrom: -1 })
      .lean();

    res.status(200).json({ success: true, structure: structure || null });
  } catch (error) {
    console.error("getCurrentSalaryStructure:", error);
    res.status(500).json({ success: false, message: "Failed to fetch structure" });
  }
};

// ─── Payroll runs ──────────────────────────────────────────────────

export const createPayrollRun = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { month, year } = req.body || {};
    const m = Number(month);
    const y = Number(year);

    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000) {
      return res.status(422).json({
        success: false,
        message: "Valid month (1-12) and year are required",
      });
    }

    const existing = await PayrollRun.findOne({ organizationId, month: m, year: y });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Payroll run already exists for this month",
        run: existing,
      });
    }

    const settings = await getOrCreatePayrollSettings(organizationId);
    const run = await PayrollRun.create({
      organizationId,
      month: m,
      year: y,
      status: "draft",
      generatedBy: organizationId,
    });

    const { skippedNoStructure, createdCount } = await generatePayslipsForRun({
      run,
      organizationId,
      settings,
      replaceExisting: false,
    });

    const fresh = await PayrollRun.findById(run._id).lean();
    res.status(201).json({
      success: true,
      message: "Payroll run created",
      run: fresh,
      createdPayslips: createdCount,
      skippedNoStructure,
    });
  } catch (error) {
    console.error("createPayrollRun:", error);
    res.status(500).json({ success: false, message: "Failed to create payroll run" });
  }
};

export const listPayrollRuns = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const runs = await PayrollRun.find({ organizationId })
      .sort({ year: -1, month: -1 })
      .lean();
    res.status(200).json({ success: true, runs });
  } catch (error) {
    console.error("listPayrollRuns:", error);
    res.status(500).json({ success: false, message: "Failed to list payroll runs" });
  }
};

export const getPayrollRun = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId } = req.params;
    if (!mongoose.isObjectIdOrHexString(runId)) {
      return res.status(400).json({ success: false, message: "Invalid run id" });
    }

    const run = await PayrollRun.findOne({ _id: runId, organizationId }).lean();
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll run not found" });
    }

    const payslips = await Payslip.find({ payrollRunId: run._id })
      .populate(
        "employeeId",
        "firstName lastName employeeId role displayName",
      )
      .sort({ createdAt: 1 })
      .lean();

    const missingBankDetails = payslips
      .filter((p) => !p.bankSnapshot?.accountNumber)
      .map((p) => ({
        payslipId: p._id,
        employeeId: p.employeeId?._id,
        employeeCode: p.employeeId?.employeeId,
        name: p.employeeId
          ? `${p.employeeId.firstName} ${p.employeeId.lastName}`.trim()
          : null,
      }));

    res.status(200).json({
      success: true,
      run,
      payslips,
      missingBankDetails,
    });
  } catch (error) {
    console.error("getPayrollRun:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payroll run" });
  }
};

export const regeneratePayrollRun = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId } = req.params;
    if (!mongoose.isObjectIdOrHexString(runId)) {
      return res.status(400).json({ success: false, message: "Invalid run id" });
    }

    const run = await PayrollRun.findOne({ _id: runId, organizationId });
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll run not found" });
    }
    if (run.status === "finalized") {
      return res.status(409).json({
        success: false,
        message: "Cannot regenerate a finalized payroll run",
      });
    }

    const settings = await getOrCreatePayrollSettings(organizationId);
    const { skippedNoStructure, createdCount } = await generatePayslipsForRun({
      run,
      organizationId,
      settings,
      replaceExisting: true,
    });

    const fresh = await PayrollRun.findById(run._id).lean();
    res.status(200).json({
      success: true,
      message: "Payroll run regenerated",
      run: fresh,
      createdPayslips: createdCount,
      skippedNoStructure,
    });
  } catch (error) {
    console.error("regeneratePayrollRun:", error);
    res.status(500).json({ success: false, message: "Failed to regenerate run" });
  }
};

export const finalizePayrollRun = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId } = req.params;
    if (!mongoose.isObjectIdOrHexString(runId)) {
      return res.status(400).json({ success: false, message: "Invalid run id" });
    }

    const run = await PayrollRun.findOne({ _id: runId, organizationId });
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll run not found" });
    }
    if (run.status === "finalized") {
      return res.status(409).json({
        success: false,
        message: "Payroll run is already finalized",
      });
    }

    await Payslip.updateMany(
      { payrollRunId: run._id, status: "draft" },
      { $set: { status: "finalized" } },
    );

    run.status = "finalized";
    run.finalizedAt = new Date();
    await run.save();
    await refreshRunTotals(run._id);

    const fresh = await PayrollRun.findById(run._id).lean();
    res.status(200).json({
      success: true,
      message: "Payroll run finalized",
      run: fresh,
    });
  } catch (error) {
    console.error("finalizePayrollRun:", error);
    res.status(500).json({ success: false, message: "Failed to finalize run" });
  }
};

export const getPayslip = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId, payslipId } = req.params;
    if (
      !mongoose.isObjectIdOrHexString(runId) ||
      !mongoose.isObjectIdOrHexString(payslipId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const payslip = await Payslip.findOne({
      _id: payslipId,
      payrollRunId: runId,
      organizationId,
    })
      .populate(
        "employeeId",
        "firstName lastName employeeId role email phoneNumber assignedHeadQuarters assignedZones",
      )
      .lean();

    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    const org = await Organization.findById(organizationId)
      .select("organizationName brandName logoUrl")
      .lean();

    res.status(200).json({ success: true, payslip, organization: org });
  } catch (error) {
    console.error("getPayslip:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payslip" });
  }
};

export const updatePayslip = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId, payslipId } = req.params;
    const { finalLopDays, status, holdReason, adminNote } = req.body || {};

    if (
      !mongoose.isObjectIdOrHexString(runId) ||
      !mongoose.isObjectIdOrHexString(payslipId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const run = await PayrollRun.findOne({ _id: runId, organizationId });
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll run not found" });
    }
    if (run.status === "finalized") {
      return res.status(409).json({
        success: false,
        message: "Cannot edit payslips on a finalized run",
      });
    }

    const payslip = await Payslip.findOne({
      _id: payslipId,
      payrollRunId: runId,
      organizationId,
    });
    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }
    if (payslip.status === "finalized") {
      return res.status(409).json({
        success: false,
        message: "Payslip is finalized",
      });
    }

    if (status !== undefined) {
      if (!["draft", "onHold"].includes(status)) {
        return res.status(422).json({
          success: false,
          message: "status must be draft or onHold",
        });
      }
      payslip.status = status;
      if (status === "onHold") {
        payslip.holdReason = holdReason?.trim() || payslip.holdReason || "On hold";
      } else {
        payslip.holdReason = null;
      }
    } else if (holdReason !== undefined) {
      payslip.holdReason = holdReason;
    }

    if (adminNote !== undefined) {
      payslip.adminNote = adminNote;
    }

    if (finalLopDays !== undefined) {
      const days = Number(finalLopDays);
      if (Number.isNaN(days) || days < 0) {
        return res.status(422).json({
          success: false,
          message: "finalLopDays must be a non-negative number",
        });
      }
      payslip.finalLopDays = days;
      const settings = await getOrCreatePayrollSettings(organizationId);
      const divisorDays = resolveDivisorDays(
        payslip.attendance,
        settings.lopDivisorMethod,
      );
      payslip.lopAmount = computeLopAmount(payslip.gross, days, divisorDays);
      payslip.netPay = round2(
        Math.max(payslip.gross - payslip.structureDeductions - payslip.lopAmount, 0),
      );
    }

    await payslip.save();
    await refreshRunTotals(run._id);

    res.status(200).json({ success: true, payslip });
  } catch (error) {
    console.error("updatePayslip:", error);
    res.status(500).json({ success: false, message: "Failed to update payslip" });
  }
};

export const exportBankFile = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId } = req.params;
    if (!mongoose.isObjectIdOrHexString(runId)) {
      return res.status(400).json({ success: false, message: "Invalid run id" });
    }

    const run = await PayrollRun.findOne({ _id: runId, organizationId }).lean();
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll run not found" });
    }
    if (run.status !== "finalized") {
      return res.status(422).json({
        success: false,
        message: "Bank file can only be exported after the run is finalized",
      });
    }

    const payslips = await Payslip.find({ payrollRunId: run._id })
      .populate("employeeId", "firstName lastName employeeId")
      .lean();

    const eligible = [];
    const skipped = [];

    for (const slip of payslips) {
      const empName = slip.employeeId
        ? `${slip.employeeId.firstName} ${slip.employeeId.lastName}`.trim()
        : "";
      const empCode = slip.employeeId?.employeeId || "";

      if (slip.status === "onHold") {
        skipped.push({ reason: "onHold", employeeCode: empCode, name: empName });
        continue;
      }
      if (slip.status !== "finalized") {
        skipped.push({ reason: "notFinalized", employeeCode: empCode, name: empName });
        continue;
      }
      if (!slip.bankSnapshot?.accountNumber || !slip.bankSnapshot?.ifsc) {
        skipped.push({
          reason: "missingBankDetails",
          employeeCode: empCode,
          name: empName,
        });
        continue;
      }
      if (slip.netPay <= 0) {
        skipped.push({ reason: "zeroNetPay", employeeCode: empCode, name: empName });
        continue;
      }

      eligible.push({
        beneficiaryName: slip.bankSnapshot.accountHolderName || empName,
        accountNumber: slip.bankSnapshot.accountNumber,
        ifsc: slip.bankSnapshot.ifsc,
        amount: round2(slip.netPay),
        paymentType: "NEFT",
        narration: `SAL ${MONTH_SHORT[run.month - 1]}${run.year} ${empCode}`,
        employeeId: empCode,
        employeeName: empName,
      });
    }

    const header = [
      "Beneficiary Name",
      "Account Number",
      "IFSC",
      "Amount",
      "Payment Type",
      "Narration",
      "Employee Id",
      "Employee Name",
    ];
    const escapeCsv = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      header.join(","),
      ...eligible.map((r) =>
        [
          r.beneficiaryName,
          r.accountNumber,
          r.ifsc,
          r.amount,
          r.paymentType,
          r.narration,
          r.employeeId,
          r.employeeName,
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ];

    const csv = lines.join("\n");
    const fileName = `salary-bank-${run.year}-${String(run.month).padStart(2, "0")}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Bank-File-Rows", String(eligible.length));
    res.setHeader("X-Bank-File-Skipped", String(skipped.length));
    // Also expose skipped as custom header JSON for clients that can read it
    res.setHeader(
      "X-Bank-File-Skipped-JSON",
      encodeURIComponent(JSON.stringify(skipped)),
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error("exportBankFile:", error);
    res.status(500).json({ success: false, message: "Failed to export bank file" });
  }
};

export const exportPayslipsExcel = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { runId } = req.params;
    if (!mongoose.isObjectIdOrHexString(runId)) {
      return res.status(400).json({ success: false, message: "Invalid run id" });
    }

    const run = await PayrollRun.findOne({ _id: runId, organizationId }).lean();
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll run not found" });
    }

    const payslips = await Payslip.find({ payrollRunId: run._id })
      .populate("employeeId", "firstName lastName employeeId role")
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Payslips");
    sheet.columns = [
      { header: "Employee Id", key: "code", width: 14 },
      { header: "Name", key: "name", width: 24 },
      { header: "Role", key: "role", width: 14 },
      { header: "Status", key: "status", width: 12 },
      { header: "Present", key: "present", width: 10 },
      { header: "Paid Leave", key: "paidLeave", width: 12 },
      { header: "Suggested LOP", key: "suggestedLop", width: 14 },
      { header: "Final LOP", key: "finalLop", width: 12 },
      { header: "Gross", key: "gross", width: 12 },
      { header: "Deductions", key: "deductions", width: 12 },
      { header: "LOP Amount", key: "lopAmount", width: 12 },
      { header: "Net Pay", key: "net", width: 12 },
      { header: "Has Bank", key: "hasBank", width: 10 },
    ];

    for (const p of payslips) {
      sheet.addRow({
        code: p.employeeId?.employeeId || "",
        name: p.employeeId
          ? `${p.employeeId.firstName} ${p.employeeId.lastName}`.trim()
          : "",
        role: p.employeeId?.role || "",
        status: p.status,
        present: p.attendance?.presentDays ?? 0,
        paidLeave: p.attendance?.paidLeaveDays ?? 0,
        suggestedLop: p.attendance?.suggestedLopDays ?? 0,
        finalLop: p.finalLopDays,
        gross: p.gross,
        deductions: p.structureDeductions,
        lopAmount: p.lopAmount,
        net: p.netPay,
        hasBank: p.bankSnapshot?.accountNumber ? "Yes" : "No",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `payslips-${run.year}-${String(run.month).padStart(2, "0")}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error("exportPayslipsExcel:", error);
    res.status(500).json({ success: false, message: "Failed to export payslips" });
  }
};
