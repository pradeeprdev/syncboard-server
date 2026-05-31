import Project from "../models/Project.js";

export const attachProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const userId = String(req.user._id);

    const member = project.members.find(
      (m) => String(m.user) === userId
    );

    const isCreator = String(project.createdBy) === userId;

    if (!member && !isCreator) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this project",
      });
    }

    req.project = project;
    req.projectRole = isCreator ? "admin" : member.role;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireProjectRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.projectRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this action",
      });
    }

    next();
  };
};