import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

export const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

export const orgAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.organization= await Organization.findById(decoded.id);
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};



// export const checkRole = (role) => (req, res, next) => {
//   if (req.user.role !== role ) {
//     return res.status(403).json({ message: 'Forbidden' });
//   }
//   next();
// };

// export const orgcheckRole = (role) => (req, res, next) => {
//   if (req.organization.role !== role ) {
//     return res.status(403).json({ message: 'Forbidden' });
//   }
//   next();
// };
