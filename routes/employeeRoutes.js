import express from "express";
import { orgAuth, auth } from "../middleware/authMiddleware.js";
import {
  onboardEmployee,
  paginatedEmployeeList,
  getEmployeeById,
  updateEmployee,
  getAssignedDoctorAndArea,
  getAllEmployeeOptions,
  forgotPassword,
  resetPassword,
  getSuperiors,
  getSubordinates,
} from "../controllers/employeeController.js";
import { getCallAverageReport } from "../controllers/callAverageReportController.js";

const router = express.Router();

router.get("/getAllEmployeeOptions", orgAuth, getAllEmployeeOptions);
router.get("/getAssignedDetails", auth, getAssignedDoctorAndArea);
router.get("/getSuperiors", auth, getSuperiors);
router.get("/getSubordinates", auth, getSubordinates);
router.get("/call-average", orgAuth, getCallAverageReport);

router.get("/:employeeId", orgAuth, getEmployeeById);
router.patch("/:employeeId", orgAuth, updateEmployee);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/create", orgAuth, onboardEmployee);
router.post("/getAllEmployees", orgAuth, paginatedEmployeeList);

export default router;
