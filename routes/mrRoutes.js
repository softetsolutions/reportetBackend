import express from 'express';
import { auth,  } from '../middleware/authMiddleware.js';
import { getAssignedDoctors, addRemark } from '../controllers/mrController.js';

const router = express.Router();
router.use(auth, );
router.get('/doctors', getAssignedDoctors);
router.post('/remark', addRemark);

export default router;
