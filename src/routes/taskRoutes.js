import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { attachProject } from "../middlewares/projectRBAC.js";
import {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  bulkUpdateStatus,
  bulkAssignTasks,
  bulkDeleteTasks,
} from "../controllers/taskController.js";

const router = express.Router();

router.use(protect);

router.get(
  "/:projectId/tasks",
  attachProject,
  listTasks
);

router.post(
  "/:projectId/tasks",
  attachProject,
  createTask
);

router.get(
  "/:projectId/tasks/:taskId",
  attachProject,
  getTask
);

router.patch(
  "/:projectId/tasks/:taskId",
  attachProject,
  updateTask
);

router.delete(
  "/:projectId/tasks/:taskId",
  attachProject,
  deleteTask
);

router.patch(
  "/:projectId/tasks/bulk/status",
  attachProject,
  bulkUpdateStatus
);

router.patch(
  "/:projectId/tasks/bulk/assign",
  attachProject,
  bulkAssignTasks
);

router.patch(
  "/:projectId/tasks/bulk/delete",
  attachProject,
  bulkDeleteTasks
);

export default router;