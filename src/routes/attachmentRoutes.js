import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireProjectMember } from "../middlewares/rbacMiddleware.js";
import { uploadMiddleware, uploadAttachment, listAttachments, deleteAttachment } from "../controllers/attachmentController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(requireProjectMember);

router.post("/:taskId/attachments", uploadMiddleware.single("file"), uploadAttachment);
router.get("/:taskId/attachments", listAttachments);
router.delete("/:taskId/attachments/:attachmentId", deleteAttachment);

export default router;
