import cron from "node-cron";
import { runDoctorBirthdayCheck } from "../utils/doctorBirthdayCheck.js";

export function startNotificationCrons() {
  cron.schedule("0 9 * * *", async () => {
    try {
      await runDoctorBirthdayCheck();
    } catch (err) {
      console.error("Doctor birthday cron failed:", err);
    }
  });

  console.log("Notification crons started");
}
