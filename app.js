import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import mrRoutes from "./routes/mrRoutes.js";
import orgRoutes from "./routes/orgAuthRoutes.js";
import stockistRoutes from "./routes/stockistRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import dailyVisitRoutes from "./routes/daily-visit.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import areaRouts from "./routes/areaRoutes.js";
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());
const allowedOrigins = ["http://localhost:5173", "http://localhost:8081"];

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true); // allow Postman / mobile
    if(allowedOrigins.indexOf(origin) === -1){
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );


const swaggerDocument = yaml.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/auth", authRoutes);
app.use("/api/orgauth", orgRoutes);
app.use("/api/area", areaRouts);
app.use("/api/mr", mrRoutes);
app.use("/api/daily-visit", dailyVisitRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/stockists", stockistRoutes);
app.use("/api/sales", saleRoutes);

export default app;
