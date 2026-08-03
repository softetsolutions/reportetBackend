import express from "express";
import { orgAuth } from "../middleware/authMiddleware.js";
import { logoUpload } from "../middleware/logoUpload.js";
import { editBranding } from "../controllers/logoController.js";

const router = express.Router();

router.put("/branding", orgAuth, logoUpload.single("logo"), editBranding);

export default router;
