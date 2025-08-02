import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { createDailyVisit } from "../controllers/dailyVisit.js";

const router = express.Router();

router.use(auth);
router.post("/create", createDailyVisit);

export default router;
