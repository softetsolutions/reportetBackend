import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { createDailyVisit, getDoctorsWithRemarks } from "../controllers/dailyVisit.js";

const router = express.Router();

router.post("/create", auth, createDailyVisit);
router.get("/visitReport", getDoctorsWithRemarks);

export default router;
