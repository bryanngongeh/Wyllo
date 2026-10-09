import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4174),
  CORS_ORIGINS: z.string().optional(),
  AUTH0_DOMAIN: z.string().regex(/^[a-zA-Z0-9.-]+$/).optional().or(z.literal('')),
  AUTH0_AUDIENCE: z.string().url().optional().or(z.literal('')),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  MODULE_CATALOG_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  MODULE_CATALOG_SIGNATURE: z.string().optional().or(z.literal('')),
  MAL_CLIENT_ID: z.string().trim().max(200).optional().or(z.literal('')),
  ENABLE_JIKAN_METADATA: z.enum(['true', 'false']).default('false'),
  JIKAN_RIGHTS_REVIEW_JSON: z.string().trim().max(2000).optional().or(z.literal('')),
  METADATA_PROVIDERS_JSON: z.string().trim().max(50_000).optional().or(z.literal('')),
  METADATA_API_KEYS_JSON: z.string().trim().max(20_000).optional().or(z.literal('')),
  ALLOW_DEMO_MODULES: z.enum(['true', 'false']).default('false')
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  apiPort: number;
  corsOrigins: string[];
  auth0Domain?: string;
  auth0Audience?: string;
  databaseUrl?: string;
  redisUrl?: string;
  moduleCatalogPublicKey?: string;
  moduleCatalogSignature?: string;
  malClientId?: string;
  enableJikanMetadata: boolean;
  jikanRightsReviewJson?: string;
  metadataProvidersJson?: string;
  metadataApiKeysJson?: string;
  allowDemoModules: boolean;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(source);
  if (parsed.ENABLE_JIKAN_METADATA === 'true' && !parsed.JIKAN_RIGHTS_REVIEW_JSON) {
    throw new Error('JIKAN_RIGHTS_REVIEW_JSON is required when ENABLE_JIKAN_METADATA=true.');
  }
  const corsOrigins = (parsed.CORS_ORIGINS ?? (parsed.NODE_ENV === 'development' ? 'http://localhost:5173,http://127.0.0.1:5173' : ''))
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  if (parsed.DATABASE_URL && !['postgres:', 'postgresql:'].includes(new URL(parsed.DATABASE_URL).protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }
  if (parsed.REDIS_URL && !['redis:', 'rediss:'].includes(new URL(parsed.REDIS_URL).protocol)) {
    throw new Error('REDIS_URL must use the redis or rediss protocol.');
  }
  for (const origin of corsOrigins) {
    const url = new URL(origin);
    if (url.origin !== origin || (parsed.NODE_ENV === 'production' && url.protocol !== 'https:')) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  }
  if (parsed.NODE_ENV === 'production') {
    const missing = [
      ['CORS_ORIGINS', corsOrigins.length > 0],
      ['AUTH0_DOMAIN', Boolean(parsed.AUTH0_DOMAIN)],
      ['AUTH0_AUDIENCE', Boolean(parsed.AUTH0_AUDIENCE)],
      ['DATABASE_URL', Boolean(parsed.DATABASE_URL)],
      ['REDIS_URL', Boolean(parsed.REDIS_URL)],
      ['MODULE_CATALOG_PUBLIC_KEY', Boolean(parsed.MODULE_CATALOG_PUBLIC_KEY)],
      ['MODULE_CATALOG_SIGNATURE', Boolean(parsed.MODULE_CATALOG_SIGNATURE)]
    ].filter(([, isPresent]) => !isPresent).map(([name]) => name);
    if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    apiPort: parsed.API_PORT,
    corsOrigins,
    auth0Domain: parsed.AUTH0_DOMAIN || undefined,
    auth0Audience: parsed.AUTH0_AUDIENCE || undefined,
    databaseUrl: parsed.DATABASE_URL || undefined,
    redisUrl: parsed.REDIS_URL || undefined,
    moduleCatalogPublicKey: parsed.MODULE_CATALOG_PUBLIC_KEY || undefined,
    moduleCatalogSignature: parsed.MODULE_CATALOG_SIGNATURE || undefined,
    malClientId: parsed.MAL_CLIENT_ID || undefined,
    enableJikanMetadata: parsed.ENABLE_JIKAN_METADATA === 'true',
    jikanRightsReviewJson: parsed.JIKAN_RIGHTS_REVIEW_JSON || undefined,
    metadataProvidersJson: parsed.METADATA_PROVIDERS_JSON || undefined,
    metadataApiKeysJson: parsed.METADATA_API_KEYS_JSON || undefined,
    allowDemoModules: parsed.ALLOW_DEMO_MODULES === 'true'
  };
}