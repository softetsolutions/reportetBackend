import Notification from "../models/Notification.js";
import NotificationSettings from "../models/NotificationSettings.js";
import { sendBirthdayMail } from "../config/mailer.js";

/** Events delivered to employees — not gated by the org master feature toggle. */
export const EMPLOYEE_NOTIFICATION_EVENTS = new Set([
  "leaveActionResult",
  "tourPlanActionResult",
]);

export const DEFAULT_NOTIFICATION_EVENTS = [
  {
    eventType: "doctorBirthdayAdminAlert",
    enabled: true,
    channels: { email: false, inApp: true },
    emailSubject: "",
    emailTemplate: {
      mode: "default",
      bodyMessage:
        "It's Dr. {{doctorName}}'s birthday today. Send them a greeting from the notifications panel.",
    },
    sendTime: "09:00",
  },
  {
    eventType: "leaveActionResult",
    enabled: true,
    channels: { email: false, inApp: true },
    emailSubject: "",
    emailTemplate: { mode: "default" },
    sendTime: "09:00",
  },
  {
    eventType: "tourPlanActionResult",
    enabled: true,
    channels: { email: false, inApp: true },
    emailSubject: "",
    emailTemplate: { mode: "default" },
    sendTime: "09:00",
  },
];

function renderTemplate(template, data) {
  if (!template) return "";
  return String(template).replace(/{{(\w+)}}/g, (_, key) => data[key] ?? "");
}

export async function ensureNotificationSettings(organizationId) {
  let settings = await NotificationSettings.findOne({
    organization: organizationId,
  });

  if (!settings) {
    return NotificationSettings.create({
      organization: organizationId,
      featureEnabled: false,
      events: DEFAULT_NOTIFICATION_EVENTS,
    });
  }

  const existingTypes = new Set(settings.events.map((e) => e.eventType));
  let changed = false;
  for (const def of DEFAULT_NOTIFICATION_EVENTS) {
    if (!existingTypes.has(def.eventType)) {
      settings.events.push(def);
      changed = true;
    }
  }
  if (changed) await settings.save();
  return settings;
}

export async function getEventConfig(organizationId, eventType) {
  const settingsDoc = await ensureNotificationSettings(organizationId);
  const event = settingsDoc.events.find((e) => e.eventType === eventType) || null;

  return {
    featureEnabled: settingsDoc.featureEnabled,
    event,
  };
}

export async function triggerNotification({
  organizationId,
  eventType,
  recipient,
  recipientEmail,
  templateData = {},
  fallbackTitle,
  fallbackMessage,
}) {
  const settings = await getEventConfig(organizationId, eventType);
  if (!settings?.event) return null;

  const isEmployeeEvent = EMPLOYEE_NOTIFICATION_EVENTS.has(eventType);
  if (!isEmployeeEvent && !settings.featureEnabled) return null;

  const config = settings.event;
  if (!config.enabled) return null;

  const title = fallbackTitle;
  const templateSource =
    config.messageTemplate ||
    config.emailTemplate?.bodyMessage ||
    "";
  const message = templateSource
    ? renderTemplate(templateSource, templateData)
    : fallbackMessage;

  const notification = await Notification.create({
    organizationId,
    recipient: recipient || null,
    eventType,
    title,
    message,
    metadata: templateData,
    channels: config.channels,
    emailStatus: config.channels?.email ? "pending" : "not_applicable",
  });

  if (config.channels?.email && recipientEmail) {
    try {
      const subject =
        renderTemplate(config.emailSubject, templateData) || title;
      await sendBirthdayMail(
        subject,
        templateData.doctorName || "",
        message,
        recipientEmail,
        config.emailTemplate,
      );
      notification.emailStatus = "sent";
    } catch (err) {
      notification.emailStatus = "failed";
      console.error(
        `Email failed for notification ${notification._id}:`,
        err.message,
      );
    }
    await notification.save();
  }

  return notification;
}

export async function seedDefaultNotificationSettings(organizationId) {
  return ensureNotificationSettings(organizationId);
}
