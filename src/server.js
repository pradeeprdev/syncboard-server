import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { initIO } from "./sockets/index.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import Project from "./models/Project.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) return next(new Error("Authentication error"));

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  socket.on("project:join", async ({ projectId }) => {
    try {
      const project = await Project.findById(projectId);
      if (!project) return socket.emit("error", { message: "Project not found." });

      const isMember = project.members.some(m => String(m.user) === String(socket.userId)) || String(project.createdBy) === String(socket.userId);
      if (!isMember) return socket.emit("error", { message: "Forbidden to join room." });

      const room = `project:${projectId}`;
      socket.join(room);
      io.to(room).emit("presence:updated", { userId: socket.userId, online: true });
    } catch (err) {
      socket.emit("error", { message: "Could not join project." });
    }
  });

  socket.on("project:leave", ({ projectId }) => {
    const room = `project:${projectId}`;
    socket.leave(room);
    io.to(room).emit("presence:updated", { userId: socket.userId, online: false });
  });

  socket.on("task:created", ({ projectId, task }) => {
    const room = `project:${projectId}`;
    io.to(room).emit("task:created", { task });
  });

  socket.on("task:updated", ({ projectId, task }) => {
    const room = `project:${projectId}`;
    io.to(room).emit("task:updated", { task });
  });

  socket.on("disconnect", () => {
    // TODO: broadcast presence changes if tracking socket-user map
  });
});

initIO(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});