import express from "express";
import multer from "multer";
import { auth, authOrOrg, orgAuth } from "../middleware/authMiddleware.js";
import { 
  addDoctor, 
  getDoctorsByAreaId, 
  getAllDoctors, 
  assignDoctorToMR, 
  importDoctorsFromExcel, 
  getDoctorByMrId 
} from "../controllers/doctorController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Organization-level routes
router.post("/add", orgAuth, addDoctor);
router.get("/getAll", orgAuth, getAllDoctors);
router.get("/getByAreaId/:areaId", auth, getDoctorsByAreaId);
router.post("/assignToMR", orgAuth, assignDoctorToMR);
router.post("/import", orgAuth, upload.single("file"), importDoctorsFromExcel);

// MR-level route
router.get("/mr/:mrId",authOrOrg, getDoctorByMrId);

export default router;
