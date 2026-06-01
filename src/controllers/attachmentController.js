import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

import { successResponse, errorResponse } from "../utils/apiResponse.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, WEBP, GIF and PDF allowed."));
    }
  },
});

const getResourceType = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  return "raw";
};

const uploadBufferToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return reject(
        new Error(
          "Cloudinary credentials missing. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env"
        )
      );
    }

    const resourceType = getResourceType(file.mimetype);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: `${Date.now()}-${file.originalname
          .replace(/\s+/g, "-")
          .replace(/\.[^/.]+$/, "")}`,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const getProjectRole = (project, userId) => {
  const isCreator = String(project.createdBy) === String(userId);

  if (isCreator) return "admin";

  const member = project.members.find(
    (m) => String(m.user) === String(userId)
  );

  return member?.role || null;
};

export const uploadAttachment = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
      return errorResponse(res, 404, "Project not found.");
    }

    const role = getProjectRole(project, req.user._id);

    if (!role) {
      return errorResponse(res, 403, "Forbidden.");
    }

    if (role === "viewer") {
      return errorResponse(res, 403, "Viewers cannot upload attachments.");
    }

    if (!req.file) {
      return errorResponse(res, 400, "File is required.");
    }

    const task = await Task.findOne({
      _id: taskId,
      projectId,
    });

    if (!task) {
      return errorResponse(res, 404, "Task not found.");
    }

    const uploaded = await uploadBufferToCloudinary(
      req.file,
      `syncboard/projects/${projectId}/tasks/${taskId}`
    );

    const attachment = {
      fileName: req.file.originalname,
      fileUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      resourceType: uploaded.resource_type,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    };

    task.attachments = task.attachments || [];
    task.attachments.push(attachment);

    await task.save();

    const savedAttachment = task.attachments[task.attachments.length - 1];

    return successResponse(res, 201, "Attachment uploaded.", {
      attachment: savedAttachment,
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const listAttachments = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
      return errorResponse(res, 404, "Project not found.");
    }

    const role = getProjectRole(project, req.user._id);

    if (!role) {
      return errorResponse(res, 403, "Forbidden.");
    }

    const task = await Task.findOne({
      _id: taskId,
      projectId,
    }).select("attachments");

    if (!task) {
      return errorResponse(res, 404, "Task not found.");
    }

    return successResponse(res, 200, "Attachments fetched.", {
      attachments: task.attachments || [],
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const deleteAttachment = async (req, res) => {
  try {
    const { projectId, attachmentId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
      return errorResponse(res, 404, "Project not found.");
    }

    const role = getProjectRole(project, req.user._id);

    if (!role) {
      return errorResponse(res, 403, "Forbidden.");
    }

    if (role === "viewer") {
      return errorResponse(res, 403, "Viewers cannot delete attachments.");
    }

    const task = await Task.findOne({
      projectId,
      "attachments._id": attachmentId,
    });

    if (!task) {
      return errorResponse(res, 404, "Attachment not found.");
    }

    const attachment = task.attachments.id(attachmentId);

    if (!attachment) {
      return errorResponse(res, 404, "Attachment not found.");
    }

    try {
      await cloudinary.uploader.destroy(attachment.publicId, {
        resource_type: attachment.resourceType || "image",
      });
    } catch (e) {
      console.error("Cloudinary delete failed:", e.message || e);
    }

    task.attachments.pull(attachmentId);

    await task.save();

    return successResponse(res, 200, "Attachment deleted.");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};