import express from "express";
import { orgAuth, auth } from "../middleware/authMiddleware.js";
import { onboardEmployee } from "../controllers/employeeController.js";
import {
  paginatedEmployeeList,
  getEmployeeById,
  updateEmployee,
  getAssignedDoctorAndArea,
  getAllEmployeeOptions,
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/create", orgAuth, onboardEmployee);
router.post("/getAllEmployees", orgAuth, paginatedEmployeeList);
router.get("/getAllEmployeeOptions", orgAuth, getAllEmployeeOptions);
router.get("/getAssignedDetails", auth, getAssignedDoctorAndArea);
router.get("/:employeeId", orgAuth, getEmployeeById);
router.patch("/:employeeId", orgAuth, updateEmployee);

export default router;
