import express from 'express';
import { orgRegister, orgLogin, orgLogout } from '../controllers/orgAuthController.js';

const router = express.Router();

router.post('/register', orgRegister);
router.post('/login', orgLogin);
router.post('/logout', orgLogout);

export default router;
