import express from "express";
import {
  addHeadquarter,
  fetchHeadquarterData,
  getAllHeadQuartersName,
  getEmployeeHeadQuarter,
} from "../controllers/headQuarterController.js";
import { authOrOrg, orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/bulkuiadd", orgAuth, addHeadquarter);
router.post("/getPaginatedHeadQuarters", orgAuth, fetchHeadquarterData);
router.get("/getAllHeadQuarterNames", orgAuth, getAllHeadQuartersName);
router.post("/employee", authOrOrg, getEmployeeHeadQuarter);

export default router;
