import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import mrRoutes from './routes/mrRoutes.js';
import orgRoutes from './routes/orgRoutes.js';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mr', mrRoutes);
app.use('/api/orgauth', orgRoutes);


export default app;
