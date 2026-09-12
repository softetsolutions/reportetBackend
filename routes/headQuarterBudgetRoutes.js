import express from "express";
import { orgAuth } from "../middleware/authMiddleware.js";
import {
  setHeadQuarterBudget,
  getHeadQuarterBudget,
  getAllHeadQuarterBudgetsForYear,
  getConfiguredFinancialYears,
  updateMonthlyBudget,
} from "../controllers/headQuarterBudgetController.js";

const router = express.Router();

router.get("/meta/years", orgAuth, getConfiguredFinancialYears);
router.get("/", orgAuth, getAllHeadQuarterBudgetsForYear);
router.put("/:headQuarterId", orgAuth, setHeadQuarterBudget);
router.patch("/:headQuarterId", orgAuth, updateMonthlyBudget);
router.get("/:headQuarterId", orgAuth, getHeadQuarterBudget);

export default router;
