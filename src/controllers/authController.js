import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken
} from "../utils/generateTokens.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import crypto from "crypto";
import emailService from "../utils/emailService.js";
import User from "../models/User.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return errorResponse(res, 400, "All fields are required.");
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return errorResponse(res, 409, "User already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // store hashed refresh token
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    user.refreshTokenHash = refreshTokenHash;
    await user.save();

    return successResponse(res, 201, "User registered successfully.", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required.");
    }

    const user = await User.findOne({ email }).select("+password +refreshTokenHash");

    if (!user) {
      return errorResponse(res, 401, "Invalid credentials.");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return errorResponse(res, 401, "Invalid credentials.");
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // store hashed refresh token
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    user.refreshTokenHash = refreshTokenHash;
    await user.save();

    return successResponse(res, 200, "Login successful.", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return errorResponse(res, 401, "Refresh token required.");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
      return errorResponse(res, 401, "Invalid or expired refresh token.");
    }

    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const user = await User.findById(decoded.userId).select("+refreshTokenHash");

    if (!user || user.refreshTokenHash !== refreshTokenHash) {
      return errorResponse(res, 401, "Invalid refresh token.");
    }

    const newAccessToken = generateAccessToken(user._id);

    return successResponse(res, 200, "Token refreshed.", {
      accessToken: newAccessToken
    });
  } catch (error) {
    return errorResponse(res, 401, "Invalid or expired refresh token.");
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 400, "Email required.");

    const user = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpiry');
    if (!user) return successResponse(res, 200, "If the email exists, a reset link was sent.");

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    // Send password reset email (best-effort). In non-production also return token.
    try {
      await emailService.sendPasswordResetEmail(user.email, token);
    } catch (e) {
      // log but don't expose internal errors
      console.error("Failed to send reset email:", e.message || e);
    }

    const payload = {};
    if (process.env.NODE_ENV !== "production") payload.resetToken = token;

    return successResponse(res, 200, "Password reset token generated.", payload);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return errorResponse(res, 400, "Token and newPassword required.");

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpiry: { $gt: Date.now() } }).select('+password +resetTokenHash +resetTokenExpiry');

    if (!user) return errorResponse(res, 400, "Invalid or expired token.");

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return successResponse(res, 200, "Password reset successful.");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const getMe = async (req, res) => {
  return successResponse(res, 200, "User fetched successfully.", {
    user: req.user
  });
};

export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+refreshTokenHash");

    user.refreshTokenHash = null;
    await user.save();

    return successResponse(res, 200, "Logout successful.");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};