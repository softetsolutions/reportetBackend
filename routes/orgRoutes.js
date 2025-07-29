import express from 'express';
import { orgRegister, orgLogin } from '../controllers/orgAuthController.js';

const router = express.Router();

router.post('/register', orgRegister);
router.post('/login', orgLogin);

export default router;
