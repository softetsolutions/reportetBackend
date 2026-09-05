import express from "express";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  getDailyVisitInfo,
  createDailyVisit,
  getDailyVisitList,
  getOrganizationDailyVisitList,
  exportOrganizationDailyVisitList,
  updateDailyVisit,
  deleteDailyVisit,
  getDoctorVisitReport,
  exportDoctorVisitReport,
  getSubOrdinateDailyReport,
  getDoctorVisitSummary,
  getDailyWorkingVsReportingSummary,
} from "../controllers/dailyVisit.js";

const router = express.Router();

router.post("/create", auth, createDailyVisit);
router.post("/getVisitList", auth, getDailyVisitList);
router.get("/getVisitInfo", auth, getDailyVisitInfo);
router.post("/getSubordinateVisitReport", auth, getSubOrdinateDailyReport);
router.post(
  "/getOrganizationVisitList",
  orgAuth,
  getOrganizationDailyVisitList,
);
router.post(
  "/exportOrganizationVisitList",
  orgAuth,
  exportOrganizationDailyVisitList,
);
router.get("/getDoctorVisitReport", authOrOrg, getDoctorVisitReport);
router.get("/exportDoctorVisitReport", authOrOrg, exportDoctorVisitReport);
router.get("/getDoctorVisitSummary", orgAuth, getDoctorVisitSummary);
router.get("/workingReporting", orgAuth, getDailyWorkingVsReportingSummary);

router.put("/:id", orgAuth, updateDailyVisit);
router.delete("/:id", orgAuth, deleteDailyVisit);

export default router;
