import express from "express";
import multer from "multer";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import {
  addDoctor,
  getDoctorsByAreaId,
  getAllDoctors,
  importDoctorsFromExcel,
} from "../controllers/doctorController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Organization-level routes
router.post("/add", orgAuth, addDoctor);
router.post("/getAll", orgAuth, getAllDoctors);
router.get("/getByAreaId/:areaId", auth, getDoctorsByAreaId);
router.post("/import", orgAuth, upload.single("file"), importDoctorsFromExcel);

export default router;
