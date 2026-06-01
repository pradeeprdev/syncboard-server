import crypto from "crypto";
import Project from "../models/Project.js";
import Invitation from "../models/Invitation.js";
import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import emailService from "../utils/emailService.js";

const normalizeUserId = (value) => String(value?._id || value);

const createActivity = async ({ projectId, userId, action, metadata = {} }) => {
  await ActivityLog.create({
    projectId,
    userId,
    action,
    entityType: "project",
    entityId: projectId,
    metadata,
  });
};

export const createProject = async (req, res) => {
  try {
    const { name, description = "" } = req.body;

    if (!name?.trim()) {
      return errorResponse(res, 400, "Project name is required");
    }

    const project = await Project.create({
      name: name.trim(),
      description,
      createdBy: req.user._id,
      members: [
        {
          user: req.user._id,
          role: "admin",
        },
      ],
    });

    await createActivity({
      projectId: project._id,
      userId: req.user._id,
      action: "project_created",
      metadata: { name: project.name },
    });

    return successResponse(res, 201, "Project created", { project });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const listProjects = async (req, res) => {
  try {
    const userId = req.user._id;

    const projects = await Project.find({
      $or: [{ createdBy: userId }, { "members.user": userId }],
    })
      .populate("createdBy", "name email")
      .populate("members.user", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    return successResponse(res, 200, "Projects fetched", { projects });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate("createdBy", "name email")
      .populate("members.user", "name email")
      .lean();

    if (!project) {
      return errorResponse(res, 404, "Project not found");
    }

    const userId = String(req.user._id);

    const isCreator =
      normalizeUserId(project.createdBy) === userId;

    const isMember = project.members.some(
      (m) => normalizeUserId(m.user) === userId
    );

    if (!isCreator && !isMember) {
      return errorResponse(res, 403, "Forbidden");
    }

    const role = isCreator
      ? "admin"
      : project.members.find((m) => normalizeUserId(m.user) === userId)?.role;

    return successResponse(res, 200, "Project fetched", {
      project,
      role,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const updateProject = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const project = req.project;

    if (name !== undefined) project.name = name.trim();
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;

    await project.save();

    await createActivity({
      projectId: project._id,
      userId: req.user._id,
      action: "project_updated",
      metadata: { name, description, status },
    });

    return successResponse(res, 200, "Project updated", { project });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const archiveProject = async (req, res) => {
  try {
    const project = req.project;

    project.status = "archived";
    await project.save();

    await createActivity({
      projectId: project._id,
      userId: req.user._id,
      action: "project_archived",
    });

    return successResponse(res, 200, "Project archived", { project });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const inviteMember = async (req, res) => {
  try {
    const { email, role = "member" } = req.body;
    const project = req.project;

    if (!email) {
      return errorResponse(res, 400, "Email is required");
    }

    if (!["admin", "member", "viewer"].includes(role)) {
      return errorResponse(res, 400, "Invalid role");
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      const alreadyMember = project.members.some(
        (m) => String(m.user) === String(existingUser._id)
      );

      if (alreadyMember) {
        return errorResponse(res, 409, "User is already a project member");
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await Invitation.create({
      projectId: project._id,
      email: email.toLowerCase(),
      role,
      tokenHash,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    });

    await createActivity({
      projectId: project._id,
      userId: req.user._id,
      action: "member_invited",
      metadata: { email, role },
    });

    // send invitation email (best-effort)
    try {
      // include inviteRole for email rendering
      const inviteMeta = { name: project.name, inviteRole: role };
      await emailService.sendInvitationEmail(email.toLowerCase(), token, inviteMeta, req.user);
    } catch (e) {
      console.error("Failed to send invitation email:", e.message || e);
    }

    const inviteLink = `${process.env.CLIENT_URL}/accept-invite/${token}`;
    const loginLink = `${process.env.CLIENT_URL}/login`;
    const targetExists = !!existingUser;

    const message = targetExists
      ? "Invitation created and sent to existing user."
      : "Invitation created. The recipient is not registered — they should register or login and then accept the invite.";

    return successResponse(res, 201, "Invitation created", {
      inviteToken: token,
      inviteLink,
      loginLink,
      targetExists,
      message,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const invitation = await Invitation.findOne({
      tokenHash,
      expiresAt: { $gt: Date.now() },
      acceptedAt: { $exists: false },
    });

    if (!invitation) {
      return errorResponse(res, 400, "Invalid or expired invitation");
    }

    if (invitation.email !== req.user.email) {
      return errorResponse(
        res,
        403,
        "This invitation is not for your email"
      );
    }

    const project = await Project.findById(invitation.projectId);

    if (!project) {
      return errorResponse(res, 404, "Project not found");
    }

    const alreadyMember = project.members.some(
      (m) => String(m.user) === String(req.user._id)
    );

    if (!alreadyMember) {
      project.members.push({
        user: req.user._id,
        role: invitation.role,
      });
    }

    invitation.acceptedAt = new Date();

    await project.save();
    await invitation.save();

    await createActivity({
      projectId: project._id,
      userId: req.user._id,
      action: "member_joined",
      metadata: { email: req.user.email, role: invitation.role },
    });

    return successResponse(res, 200, "Invitation accepted", {
      projectId: project._id,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const getProjectActivity = async (req, res) => {
  try {
    const activity = await ActivityLog.find({
      projectId: req.params.projectId,
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return successResponse(res, 200, "Activity fetched", { activity });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const getProjectInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({
      projectId: req.params.projectId,
      acceptedAt: { $exists: false },
      expiresAt: { $gt: Date.now() },
    })
      .select("email role createdAt expiresAt")
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(res, 200, "Invitations fetched", { invitations });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};