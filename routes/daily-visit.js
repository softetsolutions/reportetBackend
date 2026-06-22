import express from "express";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  getDailyVisitInfo,
  createDailyVisit,
  getDoctorsWithRemarks,
  getDailyVisitList,
  getOrganizationDailyVisitList,
} from "../controllers/dailyVisit.js";

const router = express.Router();

router.post("/create", auth, createDailyVisit);
router.get("/visitReport", authOrOrg, getDoctorsWithRemarks);
router.post("/getVisitList", auth, getDailyVisitList);
router.get("/getVisitInfo", auth, getDailyVisitInfo);
router.post(
  "/getOrganizationVisitList",
  orgAuth,
  getOrganizationDailyVisitList,
);

export default router;
