import express from "express";
import {
  createSale,
  getAllSales,
  exportAllSales,
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
router.post("/exportAllSales", orgAuth, exportAllSales);
router.get("/alreadySubmitedSales", auth, alreadySubmitedSale);
router.put("/:id", orgAuth, updateSale);
router.delete("/:id", orgAuth, deleteSale);

export default router;
