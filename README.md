# SyncBoard Backend

## Overview

SyncBoard Backend is a scalable real-time project management API built using Node.js, Express.js, MongoDB, and Socket.io.

The system supports:

* JWT Authentication
* Refresh Tokens
* Role Based Access Control (RBAC)
* Multi-tenant Project Management
* Real-time Collaboration
* File Uploads with Cloudinary
* Project Invitations
* Activity Tracking
* Notifications
* Secure REST APIs

---

## Tech Stack

* Node.js
* Express.js
* MongoDB Atlas
* Mongoose
* Socket.io
* JWT
* bcrypt
* Cloudinary
* Multer
* Express Validator
* Helmet
* Express Rate Limit

---

## Features

### Authentication

* User Registration
* User Login
* JWT Access Token
* Refresh Token Flow
* Password Hashing using bcrypt
* Protected Routes
* Role-Based Authorization

### Project Management

* Create Projects
* Update Projects
* Archive Projects
* Invite Members
* Assign Roles
* Activity Logs

### Task Management

* Create Task
* Update Task
* Delete Task
* Bulk Actions
* Search Tasks
* Filter Tasks
* Sort Tasks

### Real-Time Features

* Socket.io Integration
* Live Task Updates
* Real-time Notifications
* Project Rooms
* Connection Recovery

### File Management

* Cloudinary Upload
* Secure Access
* File Validation
* Progress Tracking
* Download Support

---

## Project Structure

src/

├── controllers/

├── services/

├── models/

├── routes/

├── middlewares/

├── sockets/

├── utils/

├── config/

└── server.js

---

## Environment Variables

Create a .env file:

PORT=5050
MONGO_URI=mongodb+srv://pradeep:pradeep@cluster0.lrrs3vq.mongodb.net/?appName=Cluster0
JWT_ACCESS_SECRET=syncboard_access_2026_7f4k9xP2mQ8nL5rT1vY6zA3cD
JWT_REFRESH_SECRET=syncboard_refresh_2026_K8mN2pQ7xR4tV9yL6cA1dF5zB
CLIENT_URL=http://localhost:5173

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=pradeepthakur8401@gmail.com
EMAIL_PASS=jpvi ybzh zryr dsqc
EMAIL_FROM="SyncBoard <pradeepthakur8401@gmail.com>"

# Cloudinary
CLOUDINARY_CLOUD_NAME=dfzgu9mpg
CLOUDINARY_API_KEY=755499582431273
CLOUDINARY_API_SECRET=APx0VT5qOfHiN9ujiHRKkNzToI0

---

## Installation

npm install

npm run dev

---

## Production Build

npm start

---

## API Documentation

### Auth

POST /api/auth/register

POST /api/auth/login

POST /api/auth/refresh

POST /api/auth/logout

### Projects

GET /api/projects

POST /api/projects

GET /api/projects/:projectId

PATCH /api/projects/:projectId

DELETE /api/projects/:projectId

### Tasks

GET /api/projects/:projectId/tasks

POST /api/projects/:projectId/tasks

PATCH /api/projects/:projectId/tasks/:taskId

DELETE /api/projects/:projectId/tasks/:taskId

### Attachments

POST /api/projects/:projectId/tasks/:taskId/attachments

GET /api/projects/:projectId/tasks/:taskId/attachments

DELETE /api/projects/:projectId/attachments/:attachmentId

---

## Security

* Helmet Enabled
* Rate Limiting
* Password Hashing
* JWT Authentication
* Input Validation
* File Validation
* RBAC Enforcement

---

## Deployment

Backend deployed on Render.

Database hosted on MongoDB Atlas.

File storage handled by Cloudinary.

---

## Architecture Decisions

* Service Layer Architecture
* Socket.io Rooms for Project Collaboration
* JWT + Refresh Tokens for Security
* Cloudinary for Scalable File Storage
* MongoDB Indexing for Performance
* Role-Based Permissions enforced at API level