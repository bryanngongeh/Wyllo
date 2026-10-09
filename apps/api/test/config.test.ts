import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

test('empty optional Auth0 placeholders stay disabled in development', () => {
  const config = loadConfig({ NODE_ENV: 'development', AUTH0_DOMAIN: '', AUTH0_AUDIENCE: '', DATABASE_URL: '', REDIS_URL: '' });
  assert.equal(config.auth0Domain, undefined);
  assert.equal(config.databaseUrl, undefined);
  assert.equal(config.enableJikanMetadata, false);
  assert.deepEqual(config.corsOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
});

test('production refuses to start without Auth0, persistence, cache, and signed catalogue configuration', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /Missing required production configuration/);
});

test('production configuration rejects insecure browser origins', () => {
  assert.throws(() => loadConfig({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'http://app.example.com',
    AUTH0_DOMAIN: 'tenant.example.auth0.com',
    AUTH0_AUDIENCE: 'https://api.example.com',
    DATABASE_URL: 'postgres://app:pass@db.example.com/wyllo',
    REDIS_URL: 'rediss://cache.example.com:6380',
    MODULE_CATALOG_PUBLIC_KEY: 'ed25519 public key',
    MODULE_CATALOG_SIGNATURE: 'signature'
  }), /Invalid CORS origin/);
});

test('production accepts complete secure service configuration', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com',
    AUTH0_DOMAIN: 'tenant.example.auth0.com',
    AUTH0_AUDIENCE: 'https://api.example.com',
    DATABASE_URL: 'postgres://app:pass@db.example.com/wyllo',
    REDIS_URL: 'rediss://cache.example.com:6380',
    MODULE_CATALOG_PUBLIC_KEY: 'ed25519 public key',
    MODULE_CATALOG_SIGNATURE: 'signature'
  });
  assert.equal(config.nodeEnv, 'production');
  assert.deepEqual(config.corsOrigins, ['https://app.example.com']);
  assert.equal(config.allowDemoModules, false);
});

test('Jikan cannot be enabled without an explicit rights-review record', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'development', ENABLE_JIKAN_METADATA: 'true' }), /JIKAN_RIGHTS_REVIEW_JSON is required/);
  const config = loadConfig({
    NODE_ENV: 'development',
    ENABLE_JIKAN_METADATA: 'true',
    JIKAN_RIGHTS_REVIEW_JSON: JSON.stringify({
      basis: 'written-permission', evidenceUrl: 'https://example.org/permission', reviewedAt: '2026-10-09'
    })
  });
  assert.equal(config.enableJikanMetadata, true);
});