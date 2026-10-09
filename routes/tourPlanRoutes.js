import express from "express";
import { auth, authOrOrg } from "../middleware/authMiddleware.js";
import {
  getMyTourPlanMonth,
  getMyTourPlanDay,
  bulkUpsertMyTourPlanDays,
  upsertMyTourPlanDay,
  copyPreviousMonthTourPlan,
  submitMyTourPlanMonth,
} from "../controllers/tourPlanController.js";
import {
  getSubordinateTourPlans,
  getSubordinateTourPlanById,
  actionOnTourPlan,
} from "../controllers/tourPlanManagerController.js";

const router = express.Router();

router.get("/me/month", auth, getMyTourPlanMonth);
router.get("/me/day", auth, getMyTourPlanDay);
router.put("/me/month/days", auth, bulkUpsertMyTourPlanDays);
router.put("/me/days/:date", auth, upsertMyTourPlanDay);
router.post("/me/copy-previous-month", auth, copyPreviousMonthTourPlan);
router.post("/me/submit", auth, submitMyTourPlanMonth);

router.get("/subordinates", authOrOrg, getSubordinateTourPlans);
router.get("/subordinates/:planId", authOrOrg, getSubordinateTourPlanById);
router.post("/:planId/action", authOrOrg, actionOnTourPlan);

export default router;
