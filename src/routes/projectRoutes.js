import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  attachProject,
  requireProjectRole,
} from "../middlewares/projectRBAC.js";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject,
  inviteMember,
  acceptInvitation,
  getProjectActivity,
  getProjectInvitations,
} from "../controllers/projectController.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(listProjects)
  .post(createProject);

router.post("/invitations/:token/accept", acceptInvitation);

router.route("/:projectId")
  .get(getProject)
  .patch(
    attachProject,
    requireProjectRole("admin"),
    updateProject
  )
  .delete(
    attachProject,
    requireProjectRole("admin"),
    archiveProject
  );

router.post(
  "/:projectId/invitations",
  attachProject,
  requireProjectRole("admin"),
  inviteMember
);

router.get(
  "/:projectId/activity",
  attachProject,
  getProjectActivity
);

router.get(
  "/:projectId/invitations",
  attachProject,
  requireProjectRole("admin"),
  getProjectInvitations
);

export default router;