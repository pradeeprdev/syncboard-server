# syncboard-server

This is the backend for the SyncBoard real-time project management platform.

Quick start

1. Copy `.env.example` to `.env` and set these required values:

	- `PORT` (default 5050)
	- `MONGO_URI` (MongoDB connection string)
	- `JWT_ACCESS_SECRET`
	- `JWT_REFRESH_SECRET`
	- `CLOUDINARY_*` (if using Cloudinary uploads)

2. Install and run in development:

```bash
cd syncboard-server
npm install
# make sure nothing else is listening on PORT (5050)
npm run dev
```

If port 5050 is already in use (nodemon will crash with EADDRINUSE), free it with:

```bash
lsof -i tcp:5050
# then
kill -9 <PID>
```

Testing

Basic test scaffolding is present in `src/tests`. Tests are skipped by default to avoid requiring a running test DB.
To enable tests locally, set `MONGO_URI` to a test database or configure an in-memory MongoDB, then remove the `.skip` markers in the test files and run:

```bash
npm test
```

Endpoints (high-level)

- `POST /api/auth/register` - register
- `POST /api/auth/login` - login
- `POST /api/auth/refresh` - refresh access token
- `POST /api/auth/logout` - logout
- `POST /api/auth/forgot-password` - request reset
- `POST /api/auth/reset-password` - reset password

- `GET /api/projects` - list
- `POST /api/projects` - create
- `GET /api/projects/:projectId` - get
- `PATCH /api/projects/:projectId` - update (admin only)
- `DELETE /api/projects/:projectId` - archive (admin only)
- `POST /api/projects/:projectId/invitations` - invite

- `GET /api/projects/:projectId/tasks` - list tasks
- `POST /api/projects/:projectId/tasks` - create task
- `PATCH /api/projects/:projectId/tasks/:taskId` - update task
- `DELETE /api/projects/:projectId/tasks/:taskId` - delete task (admin only)
- `PATCH /api/projects/:projectId/tasks/bulk/status` - bulk status update
- `PATCH /api/projects/:projectId/tasks/bulk/assign` - bulk assign
- `PATCH /api/projects/:projectId/tasks/bulk/delete` - bulk delete (admin only)

- `GET /api/projects/:projectId/activity` - activity log
- `GET /api/projects/:projectId/notifications` - notifications (project members only)
- `POST /api/projects/:projectId/notifications/:notificationId/read` - mark read

Notes & next steps

- Tests: a few integration test placeholders were added under `src/tests`. Enable and extend them to cover critical flows.
- RBAC: project-level admin/member/viewer checks are enforced on sensitive endpoints; consider auditing all controllers for missing checks.
- Deployment: use MongoDB Atlas and Railway/Render for the server; Vercel/Netlify for the frontend.
