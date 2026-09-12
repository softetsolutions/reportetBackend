import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendDoctorBirthdayGreeting,
} from "../controllers/notificationContoller.js";
import { logoUpload } from "../middleware/logoUpload.js";
import {
  getSettings,
  updateEventSetting,
  toggleFeature,
  uploadEventLogo,
} from "../controllers/notificationSettingsController.js";
import { orgAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", orgAuth, getNotifications);
router.patch("/:id/read", orgAuth, markAsRead);
router.patch("/read-all", orgAuth, markAllAsRead);
router.delete("/:id", orgAuth, deleteNotification);
router.patch("/settings/toggle", orgAuth, toggleFeature);
router.post(
  "/doctors/:doctorId/birthday-greeting",
  orgAuth,
  sendDoctorBirthdayGreeting,
);
router.post("/logo", orgAuth, logoUpload.single("logo"), uploadEventLogo);
router.get("/settings", orgAuth, getSettings);
router.put("/settings/:eventType", orgAuth, updateEventSetting);

export default router;
