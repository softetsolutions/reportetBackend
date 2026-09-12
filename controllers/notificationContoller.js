import Notification from "../models/Notification.js";
import { sendBirthdayMail } from "../config/mailer.js";
import Doctor from "../models/Doctor.js";
import NotificationSettings from "../models/NotificationSettings.js";

export const getNotifications = async (req, res) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const organizationId = req.organization._id;

    const filter = { organizationId };
    if (unread === "true") filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({
      organizationId,
      isRead: false,
    });

    res.status(200).json({ notifications, unreadCount });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch notifications", error: err.message });
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
