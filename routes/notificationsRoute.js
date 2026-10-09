import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendDoctorBirthdayGreeting,
  getMyNotifications,
  markMyAsRead,
  markMyAllAsRead,
  deleteMyNotification,
} from "../controllers/notificationContoller.js";
import { logoUpload } from "../middleware/logoUpload.js";
import {
  getSettings,
  updateEventSetting,
  toggleFeature,
  uploadEventLogo,
} from "../controllers/notificationSettingsController.js";
import { auth, orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Employee self-service (must be before /:id routes)
router.get("/me", auth, getMyNotifications);
router.patch("/me/read-all", auth, markMyAllAsRead);
router.patch("/me/:id/read", auth, markMyAsRead);
router.delete("/me/:id", auth, deleteMyNotification);

// Org admin inbox + settings
router.get("/", orgAuth, getNotifications);
router.patch("/read-all", orgAuth, markAllAsRead);
router.get("/settings", orgAuth, getSettings);
router.patch("/settings/toggle", orgAuth, toggleFeature);
router.put("/settings/:eventType", orgAuth, updateEventSetting);
router.post("/logo", orgAuth, logoUpload.single("logo"), uploadEventLogo);
router.post(
  "/doctors/:doctorId/birthday-greeting",
  orgAuth,
  sendDoctorBirthdayGreeting,
);
router.patch("/:id/read", orgAuth, markAsRead);
router.delete("/:id", orgAuth, deleteNotification);

export default router;
