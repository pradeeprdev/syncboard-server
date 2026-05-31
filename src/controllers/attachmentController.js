import multer from "multer";
import cloudinary from "cloudinary";
import streamifier from "streamifier";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type."));
  }
});

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const uploadAttachment = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");

    // viewers cannot upload; admins and members can
    const member = project.members.find(m => String(m.user) === String(req.user._id));
    const isCreator = String(project.createdBy) === String(req.user._id);
    const isViewer = member?.role === 'viewer';
    if (isViewer && !isCreator) return errorResponse(res, 403, "Viewers cannot upload attachments.");
    if (!member && !isCreator) return errorResponse(res, 403, "Forbidden.");

    if (!req.file) return errorResponse(res, 400, "File is required.");

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, { folder: `syncboard/projects/${projectId}` });

    // attach to task record minimally
    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return errorResponse(res, 404, "Task not found.");

    const attachment = {
      fileName: req.file.originalname,
      fileUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    };

    // store attachments in task document for simplicity
    task.attachments = task.attachments || [];
    task.attachments.push(attachment);
    await task.save();

    return successResponse(res, 201, "Attachment uploaded.", { attachment });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const listAttachments = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");

    const isMember = project.members.some(m => String(m.user) === String(req.user._id)) || String(project.createdBy) === String(req.user._id);
    if (!isMember) return errorResponse(res, 403, "Forbidden.");

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return errorResponse(res, 404, "Task not found.");

    return successResponse(res, 200, "Attachments fetched.", { attachments: task.attachments || [] });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const deleteAttachment = async (req, res) => {
  try {
    const { projectId, attachmentId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return errorResponse(res, 404, "Project not found.");

    const isMember = project.members.some(m => String(m.user) === String(req.user._id)) || String(project.createdBy) === String(req.user._id);
    if (!isMember) return errorResponse(res, 403, "Forbidden.");

    // find task containing attachment
    const task = await Task.findOne({ projectId, "attachments._id": attachmentId });
    if (!task) return errorResponse(res, 404, "Attachment not found.");

    const att = task.attachments.id(attachmentId);
    if (!att) return errorResponse(res, 404, "Attachment not found.");

    // remove from cloud
    try {
      await cloudinary.v2.uploader.destroy(att.publicId);
    } catch (e) {
      // log but continue
      console.error('Cloudinary delete failed', e.message || e);
    }

    att.remove();
    await task.save();

    return successResponse(res, 200, 'Attachment deleted.');
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
