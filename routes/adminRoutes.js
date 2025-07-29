import express from 'express';
import {  orgAuth} from '../middleware/authMiddleware.js';
import { addLocation, addDoctor, assignMR } from '../controllers/adminController.js';

const router = express.Router();

router.post('/location',orgAuth, addLocation);
router.post('/doctor',orgAuth, addDoctor);
router.post('/assign-mr', orgAuth, assignMR);

export default router;
