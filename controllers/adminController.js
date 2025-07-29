import User from '../models/User.js';
import Location from '../models/Location.js';
import Doctor from '../models/Doctor.js';

export const addLocation = async (req, res) => {
  const { name } = req.body;
  const location = await Location.create({ name, organizationId: req.organization._id });
  res.json(location);
};

export const addDoctor = async (req, res) => {
  const { name, specialty, locationId } = req.body;
  const doctor = await Doctor.create({ name, specialty, locationId });
  res.json(doctor);
};

export const assignMR = async (req, res) => {
  const { userId, locationId } = req.body;
  const user = await User.findByIdAndUpdate(userId, {
    role: 'mr',
    assignedLocation: locationId,
    organizationId: req.user._id
  }, { new: true });
  res.json(user);
};
