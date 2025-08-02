import express from 'express';
import { orgAuth } from '../middleware/authMiddleware.js';
import { getAllMrs,createMr,getMrByAreaId } from '../controllers/mrController.js';

const router = express.Router();
router.use(orgAuth);
router.get('/getall', getAllMrs);
router.post('/create', createMr);
router.get('/getByAreaId/:areaId', getMrByAreaId);

export default router;
