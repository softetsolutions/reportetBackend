import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { startNotificationCrons } from "./cron/index.js";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  // Only hard-fail on vars required for the API to boot.
  // FRONTEND_URL is needed for password-reset emails — warn, don't crash mobile/API.
  const required = ["MONGO_URI", "JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `Missing required production env vars: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
  if (!process.env.FRONTEND_URL) {
    console.warn(
      "FRONTEND_URL is not set — employee password-reset links will be broken.",
    );
  }
  if (!process.env.BREVO_API_KEY) {
    console.warn(
      "BREVO_API_KEY is not set — onboarding and password-reset emails will fail.",
    );
  }
}

connectDB();
startNotificationCrons();
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`),
);
