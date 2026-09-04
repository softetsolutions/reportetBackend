import Notification from "../models/Notification.js";
import NotificationSettings from "../models/NotificationSettings.js";
import { sendBirthdayMail } from "../config/mailer.js";

function renderTemplate(template, data) {
  if (!template) return "";
  return template.replace(/{{(\w+)}}/g, (_, key) => data[key] ?? "");
}

export async function getEventConfig(organizationId, eventType) {
  const settingsDoc = await NotificationSettings.findOne(
    { organization: organizationId, "events.eventType": eventType },
    { "events.$": 1, featureEnabled: 1 },
  );
  if (!settingsDoc) return null;

  return {
    featureEnabled: settingsDoc.featureEnabled,
    event: settingsDoc.events?.[0] || null,
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

  if (!settings || !settings.featureEnabled) return null;
  const config = settings.event;
  if (!config || !config.enabled) return null;

  const title = fallbackTitle;
  const message = config.messageTemplate
    ? renderTemplate(config.messageTemplate, templateData)
    : fallbackMessage;

  const notification = await Notification.create({
    organizationId,
    recipient,
    eventType,
    title,
    message,
    metadata: templateData,
    channels: config.channels,
    emailStatus: config.channels.email ? "pending" : "not_applicable",
  });

  if (config.channels.email && recipientEmail) {
    try {
      const subject =
        renderTemplate(config.emailSubject, templateData) || title;
      await sendBirthdayMail(
        subject,
        templateData.doctorName || "",
        message,
        recipientEmail,
        config.emailTemplate, // now safely the design object, passed through to the HTML builder
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
  const exists = await NotificationSettings.findOne({
    organization: organizationId,
  });
  if (exists) return exists;

  return NotificationSettings.create({
    organization: organizationId,
    featureEnabled: false,
    events: [
      {
        eventType: "doctorBirthdayAdminAlert",
        enabled: true,
        channels: { email: false, inApp: true },
        emailSubject: "",
        emailTemplate:
          "It's Dr. {{doctorName}}'s birthday today. Send a greeting from the notifications panel.",
        sendTime: "09:00",
      },
    ],
  });
}
