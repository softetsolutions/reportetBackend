import { getAllZoneOptions } from "../controllers/zoneController.js";
import { orgAuth } from "../middleware/authMiddleware.js";
import express from "express";

const router = express.Router();
router.get("/getZoneOptions", orgAuth, getAllZoneOptions);
export default router;
