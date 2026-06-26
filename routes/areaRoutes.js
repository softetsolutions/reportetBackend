import express from "express";
import multer from "multer";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  addArea,
  getAreas,
  getAreaById,
  importAreasFromExcel,
  getAreasByHeadQuarterId,
  getEmployeeAssignedAreas,
  editArea
} from "../controllers/areaController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Organization-level routes
router.post("/add", orgAuth, addArea);
router.post("/", orgAuth, getAreas);
router.get("/:id", orgAuth, getAreaById);
router.post("/import", orgAuth, upload.single("file"), importAreasFromExcel);
router.get("/headquarter/:id", orgAuth, getAreasByHeadQuarterId);

//employee level routes
router.post("/employee", authOrOrg, getEmployeeAssignedAreas);
router.put("/:areaId", orgAuth, editArea);

export default router;
