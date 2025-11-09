import express from 'express';
import {
  createStockist,
  getAllStockists,
  updateStockist,
  deleteStockist
} from '../controllers/stockistController.js';
import { orgAuth,auth,authOrOrg } from '../middleware/authMiddleware.js';

const router = express.Router();

//router.use(orgAuth);
router.post('/',orgAuth, createStockist);
router.get('/',authOrOrg, getAllStockists);
//router.get('/',orgAuth, getAllStockists);
router.put('/:id',orgAuth, updateStockist);
router.delete('/:id',orgAuth, deleteStockist);

export default router;
