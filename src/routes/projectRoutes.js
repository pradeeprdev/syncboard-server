import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject
  ,inviteMember, getActivity
} from "../controllers/projectController.js";

const router = express.Router();

router.use(protect);

router.post("/", createProject);
router.get("/", listProjects);
router.get("/:projectId", getProject);
router.patch("/:projectId", updateProject);
router.delete("/:projectId", archiveProject);
router.post("/:projectId/invitations", inviteMember);
router.get("/:projectId/activity", getActivity);


export default router;
