import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { startNotificationCrons } from "./cron/index.js";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  const required = ["MONGO_URI", "JWT_SECRET", "FRONTEND_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `Missing required production env vars: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}

connectDB();
startNotificationCrons();
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`),
);
