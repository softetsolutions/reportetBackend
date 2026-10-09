import mongoose from "mongoose";
import Payslip from "../models/Payslip.js";
import Organization from "../models/Organization.js";
import {
  getOrCreatePayrollSettings,
} from "../utils/payrollAttendance.js";
import {
  buildEmployeePayslipPayload,
  listPayslipTemplates,
  PAYSLIP_TEMPLATE_IDS,
} from "../utils/payslipLayout.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * GET /api/payroll/me/payslips
 * Employee JWT — list finalized payslips only.
 */
export const listMyPayslips = async (req, res) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { year } = req.query;
    const filter = {
      organizationId: req.employee.organizationId,
      employeeId: req.employee._id,
      status: "finalized",
    };
    if (year) {
      const y = Number(year);
      if (!Number.isInteger(y)) {
        return res.status(422).json({
          success: false,
          message: "year must be an integer",
        });
      }
      filter.year = y;
    }

    const payslips = await Payslip.find(filter)
      .select(
        "month year netPay gross lopAmount finalLopDays currency status updatedAt createdAt",
      )
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({
      success: true,
      payslips: payslips.map((p) => ({
        payslipId: p._id,
        month: p.month,
        year: p.year,
        periodLabel: `${MONTH_NAMES[p.month - 1] || p.month} ${p.year}`,
        currency: p.currency || "INR",
        gross: p.gross,
        netPay: p.netPay,
        lopDays: p.finalLopDays,
        lopAmount: p.lopAmount,
        status: p.status,
        finalizedAt: p.updatedAt || p.createdAt,
      })),
    });
  } catch (error) {
    console.error("listMyPayslips:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payslips",
    });
  }
};

/**
 * GET /api/payroll/me/payslips/:payslipId
 * Returns layout + data for on-screen view and pdf-lib download.
 * Optional query: templateId=classic|modern|compact (overrides org default)
 */
export const getMyPayslipForDownload = async (req, res) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { payslipId } = req.params;
    if (!mongoose.isObjectIdOrHexString(payslipId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payslip id",
      });
    }

    const payslip = await Payslip.findOne({
      _id: payslipId,
      organizationId: req.employee.organizationId,
      employeeId: req.employee._id,
    }).lean();

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    if (payslip.status !== "finalized") {
      return res.status(403).json({
        success: false,
        message: "Payslip is not available yet",
      });
    }

    const settings = await getOrCreatePayrollSettings(
      req.employee.organizationId,
    );
    const requested = req.query.templateId;
    const templateId = PAYSLIP_TEMPLATE_IDS.includes(requested)
      ? requested
      : settings.payslipTemplate || "classic";

    const organization = await Organization.findById(
      req.employee.organizationId,
    )
      .select("organizationName brandName logoUrl")
      .lean();

    const payload = buildEmployeePayslipPayload({
      payslip,
      employee: req.employee,
      organization,
      templateId,
    });

    res.status(200).json({
      success: true,
      ...payload,
      availableTemplates: listPayslipTemplates(),
    });
  } catch (error) {
    console.error("getMyPayslipForDownload:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payslip",
    });
  }
};

/**
 * GET /api/payroll/payslip-templates
 * Public to authenticated users (employee or org) — list template metadata.
 */
export const getPayslipTemplates = async (req, res) => {
  try {
    if (!req.employee && !req.organization) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    res.status(200).json({
      success: true,
      templates: listPayslipTemplates(),
    });
  } catch (error) {
    console.error("getPayslipTemplates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list templates",
    });
  }
};
