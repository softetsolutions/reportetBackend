import express from "express";
import { orgAuth } from "../middleware/authMiddleware.js";
import { onboardEmployee } from "../controllers/employeeController.js";
import { paginatedEmployeeList ,getEmployeeById,updateEmployee} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/create", orgAuth, onboardEmployee);
router.post("/getAllEmployees", orgAuth, paginatedEmployeeList);
router.get("/:employeeId", orgAuth, getEmployeeById)
router.patch("/:employeeId", orgAuth, updateEmployee);

export default router;
