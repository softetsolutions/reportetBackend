import express from "express";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  getDailyVisitInfo,
  createDailyVisit,
  getDailyVisitList,
  getOrganizationDailyVisitList,
  updateDailyVisit,
  deleteDailyVisit,
  getDoctorVisitReport
} from "../controllers/dailyVisit.js";

const router = express.Router();

router.post("/create", auth, createDailyVisit);
router.post("/getVisitList", auth, getDailyVisitList);
router.get("/getVisitInfo", auth, getDailyVisitInfo);
router.post(
  "/getOrganizationVisitList",
  orgAuth,
  getOrganizationDailyVisitList,
);
router.get("/getDoctorVisitReport", orgAuth, getDoctorVisitReport);
router.put("/:id", orgAuth, updateDailyVisit);      
router.delete("/:id", orgAuth, deleteDailyVisit);


export default router;
