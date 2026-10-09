import express from "express";
import multer from "multer";
import { orgAuth, auth, authOrOrg } from "../middleware/authMiddleware.js";
import {
  getPayrollSettings,
  updatePayrollSettings,
  listHolidays,
  upsertHoliday,
  deleteHoliday,
  getEmployeeBankDetails,
  upsertEmployeeBankDetails,
  createSalaryStructure,
  listSalaryStructures,
  getCurrentSalaryStructure,
  createPayrollRun,
  listPayrollRuns,
  getPayrollRun,
  regeneratePayrollRun,
  finalizePayrollRun,
  getPayslip,
  updatePayslip,
  exportBankFile,
  exportPayslipsExcel,
} from "../controllers/payrollController.js";
import {
  downloadHolidayTemplate,
  importHolidaysFromExcel,
  bulkCreateHolidays,
  copyHolidaysYear,
  listHolidayPresets,
  applyHolidayPreset,
  previewHolidayPreset,
} from "../controllers/payrollHolidayController.js";
import {
  listMyPayslips,
  getMyPayslipForDownload,
  getPayslipTemplates,
} from "../controllers/employeePayslipController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ── Employee self-service (employee JWT) ───────────────────────────
router.get("/me/payslips", auth, listMyPayslips);
router.get("/me/payslips/:payslipId", auth, getMyPayslipForDownload);
router.get("/payslip-templates", authOrOrg, getPayslipTemplates);

// ── Org admin ──────────────────────────────────────────────────────
router.get("/settings", orgAuth, getPayrollSettings);
router.patch("/settings", orgAuth, updatePayrollSettings);

router.get("/holidays/template", orgAuth, downloadHolidayTemplate);
router.get("/holidays/presets", orgAuth, listHolidayPresets);
router.get("/holidays/presets/preview", orgAuth, previewHolidayPreset);
router.post("/holidays/presets/apply", orgAuth, applyHolidayPreset);
router.post("/holidays/bulk", orgAuth, bulkCreateHolidays);
router.post("/holidays/copy-year", orgAuth, copyHolidaysYear);
router.post(
  "/holidays/import",
  orgAuth,
  upload.single("file"),
  importHolidaysFromExcel,
);

router.get("/holidays", orgAuth, listHolidays);
router.post("/holidays", orgAuth, upsertHoliday);
router.delete("/holidays/:holidayId", orgAuth, deleteHoliday);

router.get(
  "/employees/:employeeId/bank-details",
  orgAuth,
  getEmployeeBankDetails,
);
router.put(
  "/employees/:employeeId/bank-details",
  orgAuth,
  upsertEmployeeBankDetails,
);

router.post(
  "/employees/:employeeId/salary-structures",
  orgAuth,
  createSalaryStructure,
);
router.get(
  "/employees/:employeeId/salary-structures",
  orgAuth,
  listSalaryStructures,
);
router.get(
  "/employees/:employeeId/salary-structures/current",
  orgAuth,
  getCurrentSalaryStructure,
);

router.post("/runs", orgAuth, createPayrollRun);
router.get("/runs", orgAuth, listPayrollRuns);
router.get("/runs/:runId", orgAuth, getPayrollRun);
router.post("/runs/:runId/regenerate", orgAuth, regeneratePayrollRun);
router.post("/runs/:runId/finalize", orgAuth, finalizePayrollRun);

router.get("/runs/:runId/payslips/:payslipId", orgAuth, getPayslip);
router.patch("/runs/:runId/payslips/:payslipId", orgAuth, updatePayslip);

router.get("/runs/:runId/export/bank-file", orgAuth, exportBankFile);
router.get("/runs/:runId/export/payslips", orgAuth, exportPayslipsExcel);

export default router;
