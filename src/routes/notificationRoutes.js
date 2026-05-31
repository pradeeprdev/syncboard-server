import express from "express";
import { listNotifications, markNotificationRead } from "../controllers/notificationController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/notifications
router.get("/", protect, listNotifications);

// POST /api/projects/:projectId/notifications/:notificationId/read
router.post("/:notificationId/read", protect, markNotificationRead);

export default router;
