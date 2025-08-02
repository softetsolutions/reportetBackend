import express from 'express';
import {
  createStockist,
  getAllStockists,
  updateStockist,
  deleteStockist
} from '../controllers/stockistController.js';
import { orgAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(orgAuth);
router.post('/', createStockist);
router.get('/', getAllStockists);
router.put('/:id', updateStockist);
router.delete('/:id', deleteStockist);

export default router;
