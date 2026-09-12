import { runDoctorBirthdayCheck } from "./utils/doctorBirthdayCheck.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
await runDoctorBirthdayCheck();
process.exit(0);
