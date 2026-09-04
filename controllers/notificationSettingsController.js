import NotificationSettings from "../models/NotificationSettings.js";
import { seedDefaultNotificationSettings } from "../utils/NotificationService.js";

export const toggleFeature = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }

    let settings = await NotificationSettings.findOne({
      organization: organizationId,
    });
    if (!settings) {
      settings = await seedDefaultNotificationSettings(organizationId);
    }

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
    let settings = await NotificationSettings.findOne({
      organization: organizationId,
    });

    if (!settings) {
      settings = await seedDefaultNotificationSettings(organizationId);
    }

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

    let settings = await NotificationSettings.findOne({
      organization: organizationId,
    });
    if (!settings) {
      settings = await seedDefaultNotificationSettings(organizationId);
    }

    if (!settings.featureEnabled) {
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
