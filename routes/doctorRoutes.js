import express from 'express';
import multer from 'multer';
import { orgAuth } from '../middleware/authMiddleware.js';
import { addDoctor, getDoctorsByAreaId, getAllDoctors, assignDoctorToMR,importDoctorsFromExcel , getDoctorByMrId } from '../controllers/doctorController.js';


const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.use(orgAuth);
router.post('/add', addDoctor);
router.get('/getAll', getAllDoctors);
router.get('/getByAreaId/:areaId', getDoctorsByAreaId);
router.post('/assignToMR', assignDoctorToMR);
router.get('/mr/:mrId', getDoctorByMrId);
router.post('/import', upload.single('file'), importDoctorsFromExcel);

export default router;
