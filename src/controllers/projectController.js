import Project from "../models/Project.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import Invitation from "../models/Invitation.js";
import crypto from "crypto";
import ActivityLog from "../models/ActivityLog.js";
import Notification from "../models/Notification.js";
import { getIO } from "../sockets/index.js";

export const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) return errorResponse(res, 400, "Project name is required.");

    const project = await Project.create({
      name,
      description: description || "",
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: "admin" }]
    });

    return successResponse(res, 201, "Project created.", { project });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const listProjects = async (req, res) => {
  try {
    const userId = req.user._id;

    const projects = await Project.find({
      $or: [{ createdBy: userId }, { "members.user": userId }]
    }).lean();

    return successResponse(res, 200, "Projects fetched.", { projects });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const getProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate("members.user", "name email");

    if (!project) return errorResponse(res, 404, "Project not found.");

    return successResponse(res, 200, "Project fetched.", { project });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");

    // Only admins can update project metadata — check membership
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    if (!isAdmin) return errorResponse(res, 403, "Only project admins can update the project.");

    if (updates.name) project.name = updates.name;
    if (typeof updates.description !== "undefined") project.description = updates.description;
    if (updates.status) project.status = updates.status;

    await project.save();

    return successResponse(res, 200, "Project updated.", { project });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const archiveProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) return errorResponse(res, 404, "Project not found.");

    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    if (!isAdmin) return errorResponse(res, 403, "Only project admins can archive the project.");

    project.status = "archived";
    await project.save();

    return successResponse(res, 200, "Project archived.", { project });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const getActivity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const activity = await ActivityLog.find({ projectId }).sort({ createdAt: -1 }).limit(200).lean();
    return successResponse(res, 200, 'Activity fetched.', { activity });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const inviteMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email, role = 'member' } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, 'Project not found.');

    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isAdmin = String(project.createdBy) === String(req.user._id) || member?.role === 'admin';
    if (!isAdmin) return errorResponse(res, 403, 'Only project admins can invite members.');

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await Invitation.create({
      projectId,
      email,
      role,
      tokenHash,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 // 24h
    });

    // In real app send email. Return token for testing.
    await ActivityLog.create({ projectId, userId: req.user._id, action: 'member_invited', metadata: { email, role } });

    // create notifications for existing project members (except actor)
    const recipients = project.members.map(m => String(m.user)).filter(id => id !== String(req.user._id));
    const notifications = recipients.map(r => ({ projectId, recipient: r, actor: req.user._id, message: `${req.user.name} invited ${email} as ${role}` }));
    if (notifications.length) await Notification.insertMany(notifications);

    const io = getIO();
    if (io) io.to(`project:${projectId}`).emit('notification:new', { message: `${req.user.name} invited ${email}` });

    return successResponse(res, 201, 'Invitation created.', { token });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash, expiresAt: { $gt: Date.now() } });
    if (!invitation) return errorResponse(res, 400, 'Invalid or expired invitation.');

    const project = await Project.findById(invitation.projectId);
    if (!project) return errorResponse(res, 404, 'Project not found.');

    // add user as member
    const already = project.members.some(m => m.email === invitation.email || String(m.user) === String(req.user._id));
    if (!already) project.members.push({ user: req.user._id, role: invitation.role });

    invitation.acceptedAt = new Date();
    await invitation.save();
    await project.save();

    return successResponse(res, 200, 'Invitation accepted.');
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
