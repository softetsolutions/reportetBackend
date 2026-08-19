import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import {
  startTracking,
  endTracking,
  capturePing,
  getTodayTrip,
  getTripByDate,
  getLiveLocations,
  getLiveLocationByEmployee,
  enableEmployeeTracking,
  disableEmployeeTracking,
  getTrackingStatus,
} from "../controllers/tracking.controller.js";
import { orgAuth, auth, authOrOrg } from "../middleware/authMiddleware.js";

const router = express.Router();

const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.employee?._id?.toString() || ipKeyGenerator(req),
});

router.post("/start", auth, startTracking);
router.post("/end", auth, endTracking);
router.post("/ping", auth, pingLimiter, capturePing);
router.get("/status", auth, getTrackingStatus);

router.get("/trip/today", authOrOrg, getTodayTrip);

router.get("/live", orgAuth, getLiveLocations);
router.get("/live/:employeeId", orgAuth, getLiveLocationByEmployee);
router.get("/trip", orgAuth, getTripByDate);
router.post(
  "/employees/:employeeId/tracking/enable",
  orgAuth,
  enableEmployeeTracking,
);
router.post(
  "/employees/:employeeId/tracking/disable",
  orgAuth,
  disableEmployeeTracking,
);

export default router;
