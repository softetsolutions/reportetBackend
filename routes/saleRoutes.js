import express from 'express';
import {
  createSale,
  getAllSales,
  updateSale,
  deleteSale
} from '../controllers/saleController.js';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', auth,createSale);
router.get('/', getAllSales);
router.put('/:id',auth, updateSale);
router.delete('/:id',auth, deleteSale);

export default router;
