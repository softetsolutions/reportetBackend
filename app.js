import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import yaml from "yamljs";
import swaggerUi from "swagger-ui-express";

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
import zoneRoutes from "./routes/zoneRoutes.js";
import trackingRoutes from "./routes/tracking.routes.js";
import { requestLogger } from "./middleware/logger.js";
import notificationRoutes from "./routes/notificationsRoute.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import tourPlanRoutes from "./routes/tourPlanRoutes.js";

dotenv.config();
const app = express();
const isProd = process.env.NODE_ENV === "production";

["uploads", "uploads/logos", "uploads/exports"].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use(requestLogger);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 1000 : 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, try again later." },
  }),
);

const defaultOrigins = [
  "https://softetsolutions.com",
  "https://www.softetsolutions.com",
];
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...defaultOrigins,
  ...corsOrigins,
  ...(isProd ? [] : ["http://localhost:5173"]),
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (mobile apps, curl) with no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use("/uploads", express.static("uploads"));

if (!isProd || process.env.ENABLE_SWAGGER === "true") {
  const swaggerDocument = yaml.load("./swagger.yaml");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

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
app.use("/api/zone", zoneRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/tour-plans", tourPlanRoutes);

export default app;
