import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET
      );

      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
      };

      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket Connected: ${socket.user.name}`
    );

    socket.on("project:join", ({ projectId }) => {
      socket.join(`project:${projectId}`);

      console.log(
        `${socket.user.name} joined project:${projectId}`
      );
    });

    socket.on("project:leave", ({ projectId }) => {
      socket.leave(`project:${projectId}`);

      console.log(
        `${socket.user.name} left project:${projectId}`
      );
    });

    socket.on("disconnect", () => {
      console.log(
        `Socket disconnected: ${socket.user.name}`
      );
    });
  });

  return io;
};

export const getIO = () => io;