import mongoose from "mongoose";
import Task from "../models/Task.js";
import ActivityLog from "../models/ActivityLog.js";
import Notification from "../models/Notification.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { getIO } from "../sockets/index.js";

const VALID_STATUS = ["todo", "in_progress", "review", "completed"];
const VALID_PRIORITY = ["low", "medium", "high", "critical"];

const emitToProject = (projectId, event, payload) => {
  const io = getIO?.();
  if (io) {
    io.to(`project:${projectId}`).emit(event, payload);
  }
};

const isAdmin = (req) => req.projectRole === "admin";
const isMember = (req) => req.projectRole === "member";
const isViewer = (req) => req.projectRole === "viewer";

const isAssignedToUser = (task, userId) => {
  return task.assignees?.some(
    (id) => String(id) === String(userId)
  );
};

const createActivity = async ({
  projectId,
  userId,
  action,
  entityId,
  metadata = {},
}) => {
  await ActivityLog.create({
    projectId,
    userId,
    action,
    entityType: "task",
    entityId,
    metadata,
  });
};

const createAssignmentNotifications = async ({
  projectId,
  actorId,
  actorName,
  task,
  assignees = [],
}) => {
  const notifications = assignees
    .filter((userId) => String(userId) !== String(actorId))
    .map((userId) => ({
      projectId,
      recipient: userId,
      actor: actorId,
      message: `${actorName || "Someone"} assigned you a task: ${task.title}`,
      data: { taskId: task._id },
    }));

  if (notifications.length) {
    await Notification.insertMany(notifications);
    emitToProject(projectId, "notification:new", {
      message: `${actorName || "Someone"} assigned task: ${task.title}`,
      taskId: task._id,
    });
  }
};

export const listTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    const {
      status,
      priority,
      assignee,
      search,
      sort = "-createdAt",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { projectId };

    if (status) {
      if (!VALID_STATUS.includes(status)) {
        return errorResponse(res, 400, "Invalid status");
      }
      filter.status = status;
    }

    if (priority) {
      if (!VALID_PRIORITY.includes(priority)) {
        return errorResponse(res, 400, "Invalid priority");
      }
      filter.priority = priority;
    }

    if (assignee) {
      if (!mongoose.Types.ObjectId.isValid(assignee)) {
        return errorResponse(res, 400, "Invalid assignee id");
      }
      filter.assignees = assignee;
    }

    if (search?.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(Math.max(Number(limit), 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const allowedSorts = [
      "createdAt",
      "-createdAt",
      "dueDate",
      "-dueDate",
      "priority",
      "-priority",
      "status",
      "-status",
    ];

    const sortValue = allowedSorts.includes(sort) ? sort : "-createdAt";

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .populate("assignees", "name email")
        .sort(sortValue)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Task.countDocuments(filter),
    ]);

    return successResponse(res, 200, "Tasks fetched", {
      tasks,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (isViewer(req)) {
      return errorResponse(res, 403, "Viewers cannot create tasks");
    }

    const {
      title,
      description = "",
      status = "todo",
      priority = "medium",
      assignees = [],
      dueDate,
    } = req.body;

    if (!title?.trim()) {
      return errorResponse(res, 400, "Task title is required");
    }

    if (!VALID_STATUS.includes(status)) {
      return errorResponse(res, 400, "Invalid status");
    }

    if (!VALID_PRIORITY.includes(priority)) {
      return errorResponse(res, 400, "Invalid priority");
    }

    const task = await Task.create({
      projectId,
      title: title.trim(),
      description,
      status,
      priority,
      assignees,
      dueDate: dueDate || undefined,
      createdBy: req.user._id,
    });

    const populatedTask = await Task.findById(task._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("assignees", "name email")
      .lean();

    await createActivity({
      projectId,
      userId: req.user._id,
      action: "task_created",
      entityId: task._id,
      metadata: { title: task.title },
    });

    await createAssignmentNotifications({
      projectId,
      actorId: req.user._id,
      actorName: req.user.name,
      task,
      assignees,
    });

    emitToProject(projectId, "task:created", {
      task: populatedTask,
    });

    return successResponse(res, 201, "Task created", {
      task: populatedTask,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const getTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, projectId })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("assignees", "name email")
      .lean();

    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }

    return successResponse(res, 200, "Task fetched", { task });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    if (isViewer(req)) {
      return errorResponse(res, 403, "Viewers cannot update tasks");
    }

    const task = await Task.findOne({ _id: taskId, projectId });

    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }

    if (!isAdmin(req) && !isAssignedToUser(task, req.user._id)) {
      return errorResponse(
        res,
        403,
        "Team members can update only assigned tasks"
      );
    }

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "assignees",
      "dueDate",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    }

    if (task.status && !VALID_STATUS.includes(task.status)) {
      return errorResponse(res, 400, "Invalid status");
    }

    if (task.priority && !VALID_PRIORITY.includes(task.priority)) {
      return errorResponse(res, 400, "Invalid priority");
    }

    task.updatedBy = req.user._id;
    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("assignees", "name email")
      .lean();

    await createActivity({
      projectId,
      userId: req.user._id,
      action: "task_updated",
      entityId: task._id,
      metadata: req.body,
    });

    if (Array.isArray(req.body.assignees)) {
      await createAssignmentNotifications({
        projectId,
        actorId: req.user._id,
        actorName: req.user.name,
        task,
        assignees: req.body.assignees,
      });
    }

    emitToProject(projectId, "task:updated", {
      task: populatedTask,
    });

    return successResponse(res, 200, "Task updated", {
      task: populatedTask,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    if (!isAdmin(req)) {
      return errorResponse(res, 403, "Only project admins can delete tasks");
    }

    const task = await Task.findOneAndDelete({ _id: taskId, projectId });

    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }

    await createActivity({
      projectId,
      userId: req.user._id,
      action: "task_deleted",
      entityId: task._id,
      metadata: { title: task.title },
    });

    emitToProject(projectId, "task:deleted", {
      taskId,
    });

    return successResponse(res, 200, "Task deleted");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const bulkUpdateStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds, status } = req.body;

    if (isViewer(req)) {
      return errorResponse(res, 403, "Viewers cannot update tasks");
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return errorResponse(res, 400, "taskIds are required");
    }

    if (!VALID_STATUS.includes(status)) {
      return errorResponse(res, 400, "Invalid status");
    }

    const filter = {
      _id: { $in: taskIds },
      projectId,
    };

    if (!isAdmin(req)) {
      filter.assignees = req.user._id;
    }

    const result = await Task.updateMany(filter, {
      $set: {
        status,
        updatedBy: req.user._id,
      },
    });

    await createActivity({
      projectId,
      userId: req.user._id,
      action: "tasks_bulk_status_updated",
      metadata: { taskIds, status },
    });

    emitToProject(projectId, "task:bulk-updated", {
      taskIds,
      status,
    });

    return successResponse(res, 200, "Bulk status updated", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const bulkAssignTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds, assigneeIds } = req.body;

    if (!isAdmin(req)) {
      return errorResponse(res, 403, "Only admins can bulk assign tasks");
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return errorResponse(res, 400, "taskIds are required");
    }

    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return errorResponse(res, 400, "assigneeIds are required");
    }

    const result = await Task.updateMany(
      {
        _id: { $in: taskIds },
        projectId,
      },
      {
        $addToSet: {
          assignees: { $each: assigneeIds },
        },
        $set: {
          updatedBy: req.user._id,
        },
      }
    );

    await createActivity({
      projectId,
      userId: req.user._id,
      action: "tasks_bulk_assigned",
      metadata: { taskIds, assigneeIds },
    });

    const notifications = assigneeIds
      .filter((id) => String(id) !== String(req.user._id))
      .map((id) => ({
        projectId,
        recipient: id,
        actor: req.user._id,
        message: `${req.user.name} assigned you ${taskIds.length} task(s)`,
        data: { taskIds },
      }));

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    emitToProject(projectId, "task:bulk-updated", {
      taskIds,
      assigneeIds,
    });

    emitToProject(projectId, "notification:new", {
      message: `${req.user.name} assigned tasks`,
    });

    return successResponse(res, 200, "Bulk assign completed", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const bulkDeleteTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds } = req.body;

    if (!isAdmin(req)) {
      return errorResponse(res, 403, "Only admins can bulk delete tasks");
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return errorResponse(res, 400, "taskIds are required");
    }

    const result = await Task.deleteMany({
      _id: { $in: taskIds },
      projectId,
    });

    await createActivity({
      projectId,
      userId: req.user._id,
      action: "tasks_bulk_deleted",
      metadata: { taskIds },
    });

    emitToProject(projectId, "task:bulk-deleted", {
      taskIds,
    });

    return successResponse(res, 200, "Bulk delete completed", {
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};