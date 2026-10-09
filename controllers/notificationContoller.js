import Notification from "../models/Notification.js";
import { sendBirthdayMail } from "../config/mailer.js";
import Doctor from "../models/Doctor.js";
import NotificationSettings from "../models/NotificationSettings.js";

const parsePageLimit = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
    50,
  );
  return { page, limit, skip: (page - 1) * limit };
};

/** Org admin inbox — org-level alerts only (recipient is null). */
export const getNotifications = async (req, res) => {
  try {
    const { unread } = req.query;
    const { page, limit, skip } = parsePageLimit(req.query);
    const organizationId = req.organization._id;

    const filter = { organizationId, recipient: null };
    if (unread === "true") filter.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({
        organizationId,
        recipient: null,
        isRead: false,
      }),
    ]);

    res.status(200).json({ notifications, unreadCount, page, limit });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch notifications", error: err.message });
  }
};

/** Employee inbox — notifications addressed to the logged-in employee. */
export const getMyNotifications = async (req, res) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { unread } = req.query;
    const { page, limit, skip } = parsePageLimit(req.query);
    const organizationId = req.employee.organizationId;
    const recipient = req.employee._id;

    const filter = { organizationId, recipient };
    if (unread === "true") filter.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({
        organizationId,
        recipient,
        isRead: false,
      }),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: err.message,
    });
  }
};

export const markMyAsRead = async (req, res) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        organizationId: req.employee.organizationId,
        recipient: req.employee._id,
      },
      { isRead: true },
      { new: true },
    );
    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.status(200).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update notification",
      error: err.message,
    });
  }
};

export const markMyAllAsRead = async (req, res) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await Notification.updateMany(
      {
        organizationId: req.employee.organizationId,
        recipient: req.employee._id,
        isRead: false,
      },
      { isRead: true },
    );
    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update notifications",
      error: err.message,
    });
  }
};

export const deleteMyNotification = async (req, res) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.employee.organizationId,
      recipient: req.employee._id,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: err.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organization._id },
      { isRead: true },
      { new: true },
    );
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });
    res.status(200).json(notification);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update notification", error: err.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { organizationId: req.organization._id, isRead: false },
      { isRead: true },
    );
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update notifications", error: err.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.organization._id,
    });
    if (!deleted)
      return res.status(404).json({ message: "Notification not found" });
    res.status(200).json({ message: "Notification deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete notification", error: err.message });
  }
};

export const sendDoctorBirthdayGreeting = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { message, subject, template: overrideTemplate } = req.body;

    const doctor = await Doctor.findOne({
      _id: doctorId,
      organizationId: req.organization._id,
    });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    if (!doctor.email)
      return res.status(400).json({ message: "Doctor has no email on file" });

    const today = new Date().toDateString();
    if (doctor.lastBirthdayGreetingSentAt?.toDateString() === today) {
      return res
        .status(409)
        .json({ message: "A greeting was already sent to this doctor today" });
    }

    const settings = await NotificationSettings.findOne({
      organization: req.organization._id,
    });
    const savedTemplate = settings?.events?.find(
      (e) => e.eventType === "doctorBirthdayAdminAlert",
    )?.emailTemplate;

    const template = overrideTemplate || savedTemplate || { mode: "default" };
    const finalSubject = subject?.trim() || "Happy Birthday!";
    const finalMessage = message?.trim() || "";

    await sendBirthdayMail(
      finalSubject,
      doctor.name,
      finalMessage,
      doctor.email,
      template,
    );

    doctor.lastBirthdayGreetingSentAt = new Date();
    await doctor.save();

    if (req.body.notificationId) {
      await Notification.findOneAndUpdate(
        { _id: req.body.notificationId, organizationId: req.organization._id },
        { isRead: true },
      );
    }

    res.status(200).json({ message: "Birthday greeting sent" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to send birthday greeting",
      error: err.message,
    });
  }
};
