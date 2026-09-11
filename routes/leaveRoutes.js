import express from "express";
import {
  applyLeave,
  getMyLeaves,
  getSubordinateLeaves,
  actionOnLeave,
  getLeaveTypes,
  getMyLeaveBalance,
  createLeaveType,
  updateLeaveType,
} from "../controllers/leaveController.js";
import {
  getLeaveReport,
  exportLeaveReport,
} from "../controllers/leaveReportController.js";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/types", authOrOrg, getLeaveTypes);
router.post("/types", orgAuth, createLeaveType);
router.put("/types/:id", orgAuth, updateLeaveType);

router.get("/balance", auth, getMyLeaveBalance);

router.post("/apply", auth, applyLeave);
router.get("/my", auth, getMyLeaves);

router.get("/subordinates", authOrOrg, getSubordinateLeaves);
router.get("/getLeaveReport", orgAuth, getLeaveReport);
router.get("/exportLeaveReport", orgAuth, exportLeaveReport);
router.post("/:id/action", authOrOrg, actionOnLeave);

export default router;
