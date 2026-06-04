import express from "express";
import multer from "multer";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  addArea,
  getAreas,
  getAreaById,
  importAreasFromExcel,
  getAreaByMrId,
  getAreasByHeadQuarterId,
} from "../controllers/areaController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Organization-level routes
router.post("/add", orgAuth, addArea);
router.get("/", orgAuth, getAreas);
router.get("/:id", orgAuth, getAreaById);
router.post("/import", orgAuth, upload.single("file"), importAreasFromExcel);
router.get("/headquarter/:id", orgAuth, getAreasByHeadQuarterId);

// MR-level route
router.get("/mr/:mrId", authOrOrg, getAreaByMrId);

export default router;
