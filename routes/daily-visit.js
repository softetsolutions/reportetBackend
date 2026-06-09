import express from "express";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  createDailyVisit,
  getDoctorsWithRemarks,
  getDailyVisitList,
} from "../controllers/dailyVisit.js";

const router = express.Router();

router.post("/create", auth, createDailyVisit);
router.get("/visitReport", authOrOrg, getDoctorsWithRemarks);
router.post("/getVisitList", auth, getDailyVisitList);

export default router;
