import express from "express";
import {
  createSale,
  getAllSales,
  exportAllSales,
  updateSale,
  deleteSale,
  getSalesListOfEmployee,
  alreadySubmitedSale,
  getHeadQuarterSales,
} from "../controllers/saleController.js";
import {
  createSaleByAdmin,
  alreadySubmitedSaleByAdmin,
} from "../controllers/adminSaleController.js";
import { auth, orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", auth, createSale);
router.post("/getEmployeeSales", auth, getSalesListOfEmployee);
router.post("/getAllSales", orgAuth, getAllSales);
router.post("/exportAllSales", orgAuth, exportAllSales);
router.get("/alreadySubmitedSales", auth, alreadySubmitedSale);

router.post("/createSaleByAdmin", orgAuth, createSaleByAdmin);
router.get("/alreadySubmitedSalesByAdmin", orgAuth, alreadySubmitedSaleByAdmin);
router.post("/headQuarterSales/:headQuarterId", orgAuth, getHeadQuarterSales);
router.put("/:id", orgAuth, updateSale);
router.delete("/:id", orgAuth, deleteSale);

export default router;
