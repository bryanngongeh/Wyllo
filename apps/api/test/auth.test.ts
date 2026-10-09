import assert from 'node:assert/strict';
import Fastify from 'fastify';
import test from 'node:test';
import { requireScopes } from '../src/auth.js';

test('scope guard permits only explicitly granted operations', async () => {
  const app = Fastify();
  app.decorateRequest('authScopes', null as unknown as Set<string>);
  app.addHook('onRequest', async (request) => { request.authScopes = new Set(['read:library']); });
  app.get('/library', { preHandler: requireScopes('read:library') }, async () => ({ allowed: true }));
  app.post('/library', { preHandler: requireScopes('write:library') }, async () => ({ allowed: true }));

  const read = await app.inject({ method: 'GET', url: '/library' });
  const write = await app.inject({ method: 'POST', url: '/library' });
  assert.equal(read.statusCode, 200);
  assert.equal(write.statusCode, 403);
  await app.close();
});