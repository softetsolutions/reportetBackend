import express from "express";
import { orgAuth, auth } from "../middleware/authMiddleware.js";
import {
  getAllMrs,
  createMr,
  getMrByAreaId,
  getMrAssignesDoctorAndArea,
} from "../controllers/mrController.js";

const router = express.Router();
// router.use(orgAuth);
router.get("/getall", orgAuth, getAllMrs);
router.post("/create", orgAuth, createMr);
router.get("/getByAreaId/:areaId", orgAuth, getMrByAreaId);
router.get("/getAssignedDetail", auth, getMrAssignesDoctorAndArea);

export default router;
