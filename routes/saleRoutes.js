import express from "express";
import {
  createSale,
  getAllSales,
  updateSale,
  deleteSale,
  getSalesListOfEmployee,
  alreadySubmitedSale,
} from "../controllers/saleController.js";
import { auth, orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", auth, createSale);
router.post("/getEmployeeSales", auth, getSalesListOfEmployee);
router.post("/getAllSales", orgAuth, getAllSales);
router.get("/alreadySubmitedSales", auth, alreadySubmitedSale);
router.put("/:id", auth, updateSale);
router.delete("/:id", auth, deleteSale);

export default router;
