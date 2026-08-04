import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import mongoose from "mongoose";
// import { middleware } from "visualize-et";

import authRoutes from "./routes/authRoutes.js";
import orgRoutes from "./routes/orgAuthRoutes.js";
import stockistRoutes from "./routes/stockistRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import dailyVisitRoutes from "./routes/daily-visit.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import areaRouts from "./routes/areaRoutes.js";
import headQuarterRoutes from "./routes/headQuarterRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import brandingRoutes from "./routes/logoRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import budgetRoutes from "./routes/headQuarterBudgetRoutes.js";
import swaggerUi from "swagger-ui-express";
import yaml from "yamljs";

dotenv.config();
const app = express();

["uploads", "uploads/logos"].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: [
      "https://softetsolutions.com",
      "https://www.softetsolutions.com",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);
app.use("/uploads", express.static("uploads"));

const swaggerDocument = yaml.load("./swagger.yaml");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// app.use("/schema-viz", middleware(mongoose));

app.get("/ping", (req, res) => {
  res.json({
    status: "success",
    message: "Successfully pinged",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/orgauth", orgRoutes);
app.use("/api/area", areaRouts);
app.use("/api/daily-visit", dailyVisitRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/stockists", stockistRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/headQuarter", headQuarterRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/logo", brandingRoutes);
app.use("/api/budget", budgetRoutes);

export default app;
