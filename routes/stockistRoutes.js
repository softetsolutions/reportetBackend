import express from "express";
import {
  createStockist,
  getAllStockists,
  updateStockist,
  deleteStockist,
  getStockistOptions,
} from "../controllers/stockistController.js";
import { orgAuth, auth, authOrOrg } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", orgAuth, createStockist);
router.post("/paginatedStockistList", authOrOrg, getAllStockists);
router.get("/getStockistOptions", authOrOrg, getStockistOptions);
router.put("/:id", orgAuth, updateStockist);
router.delete("/:id", orgAuth, deleteStockist);

export default router;
