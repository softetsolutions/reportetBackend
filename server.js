import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { startNotificationCrons } from "./Cron/index.js";

dotenv.config();

connectDB();
startNotificationCrons();
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`),
);
