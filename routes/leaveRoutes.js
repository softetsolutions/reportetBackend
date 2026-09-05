import express from "express";
import {
  applyLeave,
  getMyLeaves,
  getAllLeavesForAdmin,
  getLeavesForAreaManager,
  actionOnLeaveByAdmin,
  actionOnLeaveByAreaManager,
  getLeaveSummary,
} from "../controllers/leaveController.js";
import { auth, orgAuth, authorizeRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/apply", auth, applyLeave);
router.get("/my", auth, getMyLeaves);

router.post(
  "/team",
  auth,
  authorizeRole("areaManager", "zonalManager"),
  getLeavesForAreaManager,
);
router.patch(
  "/:leaveId/action/manager",
  auth,
  authorizeRole("areaManager", "zonalManager"),
  actionOnLeaveByAreaManager,
);

router.post("/all", orgAuth, getAllLeavesForAdmin);
router.patch("/:leaveId/action/admin", orgAuth, actionOnLeaveByAdmin);
router.get("/getLeaveSummary", orgAuth, getLeaveSummary);

export default router;
