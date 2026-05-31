import Notification from "../models/Notification.js";
import Project from "../models/Project.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";

export const listNotifications = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");

    // only project members can fetch
    const isMember = String(project.createdBy) === String(req.user._id) || project.members.some(m => String(m.user) === String(req.user._id));
    if (!isMember) return errorResponse(res, 403, "Forbidden.");

    const notifications = await Notification.find({ projectId, recipient: req.user._id }).sort({ createdAt: -1 }).limit(200);

    return successResponse(res, 200, "Notifications fetched.", { notifications });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { projectId, notificationId } = req.params;

    const notification = await Notification.findOne({ _id: notificationId, projectId, recipient: req.user._id });
    if (!notification) return errorResponse(res, 404, "Notification not found.");

    notification.read = true;
    await notification.save();

    return successResponse(res, 200, "Notification marked read.", { notification });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
