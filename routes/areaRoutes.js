import express from "express";
import multer from "multer";
import { authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  addArea,
  getAreas,
  getAreaById,
  importAreasFromExcel,
  getAreasByHeadQuarterId,
  getEmployeeAssignedAreas,
  editArea,
  deleteArea,
} from "../controllers/areaController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/add", orgAuth, addArea);
router.post("/", orgAuth, getAreas);
router.post("/import", orgAuth, upload.single("file"), importAreasFromExcel);
router.get("/headquarter/:id", orgAuth, getAreasByHeadQuarterId);
router.post("/employee", authOrOrg, getEmployeeAssignedAreas);
router.put("/:areaId", orgAuth, editArea);
router.delete("/:areaId", orgAuth, deleteArea);
router.get("/:id", orgAuth, getAreaById);

export default router;
