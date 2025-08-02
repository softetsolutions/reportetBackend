import express from "express";
import multer from "multer";
import { orgAuth } from "../middleware/authMiddleware.js";
import { addArea, assignAreaToMR, getAreas, getAreaById, importAreasFromExcel } from "../controllers/areaController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.use(orgAuth);

router.post("/add", addArea);
router.post("/assign", assignAreaToMR);
router.get("/", getAreas);
router.get("/:id", getAreaById);
router.post("/import", upload.single("file"), importAreasFromExcel);

export default router;
