import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireProjectMember } from "../middlewares/rbacMiddleware.js";
import {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  bulkUpdateStatus,
  bulkAssign,
  bulkDelete
} from "../controllers/taskController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(requireProjectMember);

router.get("/", listTasks);
router.post("/", createTask);
router.get("/:taskId", getTask);
router.patch("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);
router.patch("/bulk/status", bulkUpdateStatus);
router.patch("/bulk/assign", bulkAssign);
router.patch("/bulk/delete", bulkDelete);

export default router;
