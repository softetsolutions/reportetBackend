import express from "express";
import { orgAuth } from "../middleware/authMiddleware.js";
import { logoUpload } from "../middleware/logoUpload.js";
import {
  editBranding,
  getMyOrganization,
} from "../controllers/logoController.js";

const router = express.Router();

router.put("/branding", orgAuth, logoUpload.single("logo"), editBranding);
router.get("/me", orgAuth, getMyOrganization);

export default router;
