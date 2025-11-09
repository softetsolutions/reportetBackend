import express from "express";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import { createDailyVisit, getDoctorsWithRemarks } from "../controllers/dailyVisit.js";

const router = express.Router();

router.post("/create", auth, createDailyVisit);
router.get("/visitReport", authOrOrg, getDoctorsWithRemarks);

export default router;
