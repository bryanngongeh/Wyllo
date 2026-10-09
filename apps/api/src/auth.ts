import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { AppConfig } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    authSubject: string | null;
    authScopes: Set<string>;
  }
}

export function createAuthGuard(config: AppConfig): preHandlerHookHandler {
  const issuer = config.auth0Domain ? `https://${config.auth0Domain}/` : undefined;
  const jwks = config.auth0Domain
    ? createRemoteJWKSet(new URL(`https://${config.auth0Domain}/.well-known/jwks.json`), { timeoutDuration: 5000 })
    : undefined;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token && config.nodeEnv !== 'production') {
      request.authSubject = 'local-development-user';
      request.authScopes = new Set(['read:library', 'write:library', 'read:progress', 'write:progress']);
      return;
    }
    if (!token || !jwks || !issuer || !config.auth0Audience) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: config.auth0Audience,
        algorithms: ['RS256'],
        clockTolerance: 5
      });
      if (typeof payload.sub !== 'string' || payload.sub.length > 255) {
        return reply.code(401).send({ error: 'Invalid access token.' });
      }
      request.authSubject = payload.sub;
      request.authScopes = new Set([
        ...(typeof payload.scope === 'string' ? payload.scope.split(' ') : []),
        ...(Array.isArray(payload.permissions) ? payload.permissions.filter((item): item is string => typeof item === 'string') : [])
      ]);
    } catch {
      return reply.code(401).send({ error: 'Invalid access token.' });
    }
  };
}

export function requireScopes(...requiredScopes: string[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requiredScopes.every((scope) => request.authScopes?.has(scope))) {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
  };
}