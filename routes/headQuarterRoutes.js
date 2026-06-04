import express from "express";
import {
  addHeadquarter,
  fetchHeadquarterData,
  getAllHeadQuartersName,
} from "../controllers/headQuarterController.js";
import { orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/bulkuiadd", orgAuth, addHeadquarter);
router.post("/getPaginatedHeadQuarters", orgAuth, fetchHeadquarterData);
router.get("/getAllHeadQuarterNames", orgAuth, getAllHeadQuartersName);

export default router;
