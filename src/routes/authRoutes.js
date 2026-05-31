import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  getMe,
  logout
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many requests. Try again later."
  }
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", refreshAccessToken);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);

export default router;