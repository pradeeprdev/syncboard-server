import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { acceptInvitation } from "../controllers/projectController.js";

const router = express.Router();

router.post("/:token/accept", protect, acceptInvitation);

export default router;
