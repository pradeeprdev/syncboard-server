import Project from "../models/Project.js";

export const requireProjectMember = (req, res, next) => {
  const { projectId } = req.params;
  if (!projectId) return res.status(400).json({ success: false, message: "ProjectId required." });

  Project.findById(projectId)
    .then((project) => {
      if (!project) return res.status(404).json({ success: false, message: "Project not found." });

      const isMember = String(project.createdBy) === String(req.user._id) || project.members.some(m => String(m.user) === String(req.user._id));
      if (!isMember) return res.status(403).json({ success: false, message: "Forbidden." });

      // attach role
      const member = project.members.find(m => String(m.user) === String(req.user._id));
      req.projectRole = member ? member.role : (String(project.createdBy) === String(req.user._id) ? 'admin' : null);
      req.project = project;
      next();
    })
    .catch((err) => next(err));
};

export const requireRole = (allowed = []) => (req, res, next) => {
  if (!allowed.length) return next();
  const role = req.projectRole;
  if (!role || !allowed.includes(role)) return res.status(403).json({ success: false, message: "Forbidden." });
  next();
};
