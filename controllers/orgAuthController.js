import Organization from '../models/Organization.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const generateOrgToken = (id) => {
  return jwt.sign( {id} , process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const orgRegister = async (req, res) => {
  try {
    const { organizationName, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const org = await Organization.create({ organizationName, email, password: hashed });

    const token = generateOrgToken(org._id);
    res.cookie('orgToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ message: 'Organization registered successfully' });
  } catch (error) {
    console.error('Org Register Error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

export const orgLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const org = await Organization.findOne({ email });
    if (!org || !(await bcrypt.compare(password, org.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateOrgToken(org._id);
    res.cookie('orgToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Login successful',
      token: token,
    });
  } catch (error) {
    console.error('Org Login Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
