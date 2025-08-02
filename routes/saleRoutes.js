import express from 'express';
import {
  createSale,
  getAllSales,
  updateSale,
  deleteSale
} from '../controllers/saleController.js';

const router = express.Router();

router.post('/', createSale);
router.get('/', getAllSales);
router.put('/:id', updateSale);
router.delete('/:id', deleteSale);

export default router;
