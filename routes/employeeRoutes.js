import express from "express";
import { orgAuth, auth } from "../middleware/authMiddleware.js";
import { onboardEmployee } from "../controllers/employeeController.js";
import {
  paginatedEmployeeList,
  getEmployeeById,
  updateEmployee,
  getAssignedDoctorAndArea,
  getAllEmployeeOptions,
  forgotPassword,
  resetPassword
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/create", orgAuth, onboardEmployee);
router.post("/getAllEmployees", orgAuth, paginatedEmployeeList);
router.get("/getAllEmployeeOptions", orgAuth, getAllEmployeeOptions);
router.get("/getAssignedDetails", auth, getAssignedDoctorAndArea);
router.get("/:employeeId", orgAuth, getEmployeeById);
router.patch("/:employeeId", orgAuth, updateEmployee);
router.post("/forgot-password", forgotPassword);       
router.post("/reset-password/:token", resetPassword);

export default router;
