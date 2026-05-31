import request from 'supertest';
import app from '../app.js';

// Placeholder notifications + RBAC tests
// Skipped by default; enable when a test DB is configured.

describe.skip('Notifications & RBAC', () => {
  it('project admin can create project and invite -> members receive notifications', async () => {
    const email = `admin+${Date.now()}@example.com`;
    const pass = 'Password123!';

    const r = await request(app).post('/api/auth/register').send({ name: 'Admin', email, password: pass }).expect(201);
    const token = r.body.data.accessToken;

    const project = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`).send({ name: 'Test Project' }).expect(201);
    const projectId = project.body.data.project._id;

    // invite a user (we don't create that user here) — API should create invitation and notify members
    await request(app).post(`/api/projects/${projectId}/invitations`).set('Authorization', `Bearer ${token}`).send({ email: 'invitee@example.com', role: 'member' }).expect(201);
  });
});
