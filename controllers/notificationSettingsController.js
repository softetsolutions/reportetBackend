import {
  EMPLOYEE_NOTIFICATION_EVENTS,
  ensureNotificationSettings,
} from "../utils/NotificationService.js";

export const toggleFeature = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }

    const settings = await ensureNotificationSettings(organizationId);
    settings.featureEnabled = enabled;
    await settings.save();

    res.status(200).json(settings);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update feature toggle", error: err.message });
  }
};

export const getSettings = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const settings = await ensureNotificationSettings(organizationId);
    res.status(200).json(settings);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch settings", error: err.message });
  }
};

export const updateEventSetting = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { eventType } = req.params;
    const { enabled, channels, emailSubject, sendTime, emailTemplate } =
      req.body;

    const settings = await ensureNotificationSettings(organizationId);

    // Org-level alerts (e.g. doctor birthday) need the master toggle.
    // Employee events (leave / tour-plan results) can be customized anytime.
    if (
      !EMPLOYEE_NOTIFICATION_EVENTS.has(eventType) &&
      !settings.featureEnabled
    ) {
      return res.status(400).json({
        message:
          "Enable the notification feature before customizing event settings",
      });
    }

    const eventIndex = settings.events.findIndex(
      (e) => e.eventType === eventType,
    );

    const updatedFields = {
      ...(enabled !== undefined && { enabled }),
      ...(emailSubject !== undefined && { emailSubject }),
      ...(sendTime !== undefined && { sendTime }),
    };

    if (eventIndex === -1) {
      settings.events.push({
        eventType,
        ...updatedFields,
        ...(channels !== undefined && { channels }),
        ...(emailTemplate !== undefined && { emailTemplate }),
      });
    } else {
      const existing = settings.events[eventIndex].toObject();
      settings.events[eventIndex] = {
        ...existing,
        ...updatedFields,
        ...(channels !== undefined && {
          channels: { ...existing.channels, ...channels },
        }),
        ...(emailTemplate !== undefined && {
          emailTemplate: { ...existing.emailTemplate, ...emailTemplate },
        }),
      };
    }

    await settings.save();
    res.status(200).json(settings);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Invalid settings", error: err.message });
    }
    res
      .status(500)
      .json({ message: "Failed to update settings", error: err.message });
  }
};
export const uploadEventLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No logo file uploaded" });
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    res.status(200).json({ logoUrl });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to upload logo", error: err.message });
  }
};
