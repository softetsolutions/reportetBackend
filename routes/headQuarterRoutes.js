import express from "express";
import multer from "multer";
import {
  addHeadquarter,
  fetchHeadquarterData,
  getAllHeadQuartersName,
  getEmployeeHeadQuarter,
  editHeadquarter,
  deleteHeadquarter,
  importHeadquartersFromExcel,
  getUnassignedHierarchy,
} from "../controllers/headQuarterController.js";
import { authOrOrg, orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/bulkuiadd", orgAuth, addHeadquarter);
router.post("/getPaginatedHeadQuarters", orgAuth, fetchHeadquarterData);
router.get("/getAllHeadQuarterNames", orgAuth, getAllHeadQuartersName);
router.post("/employee", authOrOrg, getEmployeeHeadQuarter);
router.put("/:headquarterId", orgAuth, editHeadquarter);
router.delete("/:headquarterId", orgAuth, deleteHeadquarter);
router.post(
  "/import",
  orgAuth,
  upload.single("file"),
  importHeadquartersFromExcel,
);
router.get("/unassigned", orgAuth, getUnassignedHierarchy);

export default router;
