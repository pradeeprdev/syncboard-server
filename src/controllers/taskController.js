import Task from "../models/Task.js";
import Project from "../models/Project.js";
import ActivityLog from "../models/ActivityLog.js";
import Notification from "../models/Notification.js";
import { getIO } from "../sockets/index.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";

const ensureProjectMember = (project, userId) => {
  if (String(project.createdBy) === String(userId)) return true;
  return project.members.some(m => String(m.user) === String(userId));
};

export const listTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, priority, assignee, search, sort = "-createdAt", page = 1, limit = 20 } = req.query;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    if (!ensureProjectMember(project, req.user._id)) return errorResponse(res, 403, "Forbidden.");

    const filter = { projectId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignees = assignee;
    if (search) filter.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];

    const skip = (Number(page) - 1) * Number(limit);

    const tasks = await Task.find(filter).sort(sort).skip(skip).limit(Number(limit));

    return successResponse(res, 200, "Tasks fetched.", { tasks });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, priority, assignees, dueDate } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    if (!ensureProjectMember(project, req.user._id)) return errorResponse(res, 403, "Forbidden.");

    // admin and member can create tasks; viewer cannot
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    const isMember = member?.role === 'member' || isAdmin;
    if (!isMember) return errorResponse(res, 403, "Only admins and members can create tasks.");

    const task = await Task.create({
      projectId,
      title,
      description: description || "",
      priority: priority || "medium",
      assignees: assignees || [],
      dueDate,
      createdBy: req.user._id
    });

    // activity log
    await ActivityLog.create({ projectId, userId: req.user._id, action: 'task_created', entityType: 'task', entityId: task._id, metadata: { title: task.title } });

    // emit via socket
    const io = getIO();
    if (io) io.to(`project:${projectId}`).emit('task:created', { task });

    // create notifications for assignees
    if (Array.isArray(assignees) && assignees.length) {
      const notifs = assignees.map(a => ({ projectId, recipient: a, actor: req.user._id, message: `${req.user.name} assigned you a task: ${task.title}`, data: { taskId: task._id } }));
      await Notification.insertMany(notifs);
      if (io) notifs.forEach(n => io.to(`project:${projectId}`).emit('notification:new', { message: n.message, recipient: n.recipient }));
    }

    return successResponse(res, 201, "Task created.", { task });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const getTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    // only admins may delete tasks
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    if (!member || member.role !== 'admin') return errorResponse(res, 403, "Forbidden.");

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return errorResponse(res, 404, "Task not found.");

    return successResponse(res, 200, "Task fetched.", { task });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const updates = req.body;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    if (!ensureProjectMember(project, req.user._id)) return errorResponse(res, 403, "Forbidden.");

    // admin can edit any task; member can edit assigned tasks
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return errorResponse(res, 404, "Task not found.");
    if (!isAdmin && !task.assignees.includes(String(req.user._id))) return errorResponse(res, 403, "Only admins or assignees can edit this task.");

    Object.assign(task, updates, { updatedBy: req.user._id });
    await task.save();

      await ActivityLog.create({ projectId, userId: req.user._id, action: 'task_updated', entityType: 'task', entityId: task._id, metadata: updates });
      const io = getIO();
      if (io) io.to(`project:${projectId}`).emit('task:updated', { task });

      return successResponse(res, 200, "Task updated.", { task });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    // only admins may delete tasks
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    if (!isAdmin) return errorResponse(res, 403, "Only project admins can delete tasks.");

    const task = await Task.findOneAndDelete({ _id: taskId, projectId });
    if (!task) return errorResponse(res, 404, "Task not found.");

      await ActivityLog.create({ projectId, userId: req.user._id, action: 'task_deleted', entityType: 'task', entityId: task._id });
      const io = getIO();
      // notify project members
      const notif = await Notification.create({ projectId, recipient: project.createdBy || project.members[0]?.user, actor: req.user._id, message: `${req.user.name} deleted task: ${task.title}`, data: { taskId: task._id } });
      if (io) io.to(`project:${projectId}`).emit('task:deleted', { taskId });
      if (io) io.to(`project:${projectId}`).emit('notification:new', { message: notif.message });

      return successResponse(res, 200, "Task deleted.");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const bulkUpdateStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds, status } = req.body;

    if (!Array.isArray(taskIds) || !status) return errorResponse(res, 400, "taskIds and status required.");

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    if (!ensureProjectMember(project, req.user._id)) return errorResponse(res, 403, "Forbidden.");

    const result = await Task.updateMany({ _id: { $in: taskIds }, projectId }, { $set: { status, updatedBy: req.user._id } });

    await ActivityLog.create({ projectId, userId: req.user._id, action: 'tasks_bulk_status', metadata: { taskIds, status } });
    const io = getIO();
    if (io) io.to(`project:${projectId}`).emit('task:bulk-updated', { taskIds, status });

    return successResponse(res, 200, "Bulk update complete.", { modifiedCount: result.modifiedCount });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const bulkAssign = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds, assigneeId } = req.body;

    if (!Array.isArray(taskIds) || !assigneeId) return errorResponse(res, 400, "taskIds and assigneeId required.");

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    if (!ensureProjectMember(project, req.user._id)) return errorResponse(res, 403, "Forbidden.");

    const result = await Task.updateMany({ _id: { $in: taskIds }, projectId }, { $addToSet: { assignees: assigneeId }, $set: { updatedBy: req.user._id } });

    await ActivityLog.create({ projectId, userId: req.user._id, action: 'tasks_bulk_assign', metadata: { taskIds, assigneeId } });
    const io = getIO();
    if (io) io.to(`project:${projectId}`).emit('task:bulk-updated', { taskIds, assigneeId });

    // create notification for assignee
    const notifs = taskIds.map(tid => ({ projectId, recipient: assigneeId, actor: req.user._id, message: `${req.user.name} assigned you ${taskIds.length} tasks`, data: { taskIds } }));
    await Notification.insertMany(notifs);
    if (io) io.to(`project:${projectId}`).emit('notification:new', { message: `${req.user.name} assigned tasks` });

    return successResponse(res, 200, "Bulk assign complete.", { modifiedCount: result.modifiedCount });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const bulkDelete = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) return errorResponse(res, 400, 'taskIds required');

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    if (!isAdmin) return errorResponse(res, 403, "Only project admins can bulk delete tasks.");

    const result = await Task.deleteMany({ _id: { $in: taskIds }, projectId });
    await ActivityLog.create({ projectId, userId: req.user._id, action: 'tasks_bulk_delete', metadata: { taskIds } });
    const io2 = getIO();
    if (io2) io2.to(`project:${projectId}`).emit('task:bulk-deleted', { taskIds });

    // notify members
    await Notification.create({ projectId, recipient: project.createdBy || project.members[0]?.user, actor: req.user._id, message: `${req.user.name} deleted ${result.deletedCount} tasks`, data: { taskIds } });

    return successResponse(res, 200, 'Bulk delete complete', { deletedCount: result.deletedCount });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
