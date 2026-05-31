import request from 'supertest';
import app from '../app.js';

// Placeholder integration tests for auth flows.
// These are skipped by default; remove `.skip` to run after configuring a test database.

describe.skip('Auth integration', () => {
  it('register -> login -> me', async () => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'Password123!';

    const reg = await request(app).post('/api/auth/register').send({ name: 'Tester', email, password }).expect(201);
    expect(reg.body.data.accessToken).toBeDefined();

    const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    expect(login.body.data.accessToken).toBeDefined();

    const token = login.body.data.accessToken;
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.data.user.email).toBe(email);
  });
});
