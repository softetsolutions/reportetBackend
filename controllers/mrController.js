import Doctor from '../models/Doctor.js';

export const getAssignedDoctors = async (req, res) => {
  const doctors = await Doctor.find({ locationId: req.user.assignedLocation });
  res.json(doctors);
};

export const addRemark = async (req, res) => {
  const { doctorId, text } = req.body;
  const doctor = await Doctor.findById(doctorId);
  doctor.remarks.push({ mrId: req.user._id, text });
  await doctor.save();
  res.json({ message: 'Remark added' });
};
