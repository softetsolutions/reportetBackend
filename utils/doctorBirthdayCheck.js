import Doctor from "../models/Doctor.js";
import { triggerNotification } from "./NotificationService.js";

function todayMonthDay() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function runDoctorBirthdayCheck() {
  const monthDay = todayMonthDay();
  const doctors = await Doctor.find({ birthdayMonthDay: monthDay });

  let notifCount = 0;

  for (const doctor of doctors) {
    if (!doctor.organizationId) continue;

    const result = await triggerNotification({
      organizationId: doctor.organizationId,
      eventType: "doctorBirthdayAdminAlert",
      recipient: null,
      recipientEmail: null,
      templateData: {
        doctorName: doctor.name,
        doctorId: doctor._id.toString(),
      },
      fallbackTitle: `🎂 Dr. ${doctor.name}'s Birthday`,
      fallbackMessage: `It's Dr. ${doctor.name}'s birthday today. Send them a greeting?`,
    });
    if (result) notifCount++;
  }

  console.log(
    `[doctorBirthdayCheck] ${doctors.length} doctors matched, ${notifCount} org alerts created`,
  );
}
