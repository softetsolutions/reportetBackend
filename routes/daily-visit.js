import express from "express";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  getDailyVisitInfo,
  createDailyVisit,
  getDailyVisitList,
  getOrganizationDailyVisitList,
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

export default router;
