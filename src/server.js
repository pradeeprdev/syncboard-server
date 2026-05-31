import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { initializeSocket } from "./sockets/index.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import Project from "./models/Project.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});