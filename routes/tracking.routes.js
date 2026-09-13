import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import {
  startTracking,
  endTracking,
  capturePing,
  getTodayTrip,
  getTripByDate,
  getTripRaw,
  listTrips,
  getLiveLocations,
  getLiveLocationByEmployee,
  listTrackingEmployees,
  enableOrgTracking,
  disableOrgTracking,
  enableEmployeeTracking,
  disableEmployeeTracking,
  getTrackingStatus,
} from "../controllers/tracking.controller.js";
import { orgAuth, auth, authOrOrg } from "../middleware/authMiddleware.js";

const router = express.Router();

/** Allow EventSource clients to pass JWT via ?token= */
const sseTokenFromQuery = (req, _res, next) => {
  if (!req.headers.authorization && req.query?.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.employee?._id?.toString() || ipKeyGenerator(req),
});

// MR
router.post("/start", auth, startTracking);
router.post("/end", auth, endTracking);
router.post("/ping", auth, pingLimiter, capturePing);
router.get("/status", auth, getTrackingStatus);

// Shared
router.get("/trip/today", authOrOrg, getTodayTrip);

// Org — live (SSE; token query supported for EventSource)
router.get("/live", sseTokenFromQuery, orgAuth, getLiveLocations);
router.get(
  "/live/:employeeId",
  sseTokenFromQuery,
  orgAuth,
  getLiveLocationByEmployee,
);

// Org — trips
router.get("/trips", orgAuth, listTrips);
router.get("/trip", orgAuth, getTripByDate);
router.get("/trip/raw", orgAuth, getTripRaw);

// Org — flags / directory
router.get("/employees", orgAuth, listTrackingEmployees);
router.post("/org/enable", orgAuth, enableOrgTracking);
router.post("/org/disable", orgAuth, disableOrgTracking);
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
