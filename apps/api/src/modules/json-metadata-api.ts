import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AnimeModule, MangaModule, MediaSummary, MediaType, ModuleCapability, ModuleRuntimeContext } from '@wyllo/domain';

const fieldPath = z.string().regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/);
const rightsReviewSchema = z.object({
  basis: z.enum(['public-domain', 'open-license', 'provider-terms', 'written-permission']),
  evidenceUrl: z.string().url(),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
}).strict();

const providerSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(100),
  mediaType: z.enum(['anime', 'manga']),
  rightsReview: rightsReviewSchema,
  baseUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.search && !url.hash;
  }, 'Provider baseUrl must be an HTTPS URL without query or hash.'),
  allowedHosts: z.array(z.string().regex(/^(?!\*\.)[a-z0-9.-]+$/)).default([]),
  searchPath: z.string().min(1).max(300),
  detailsPath: z.string().min(1).max(300),
  resultsPath: fieldPath.optional(),
  detailResultPath: fieldPath.optional(),
  queryParameter: z.string().regex(/^[A-Za-z0-9_-]+$/).default('q'),
  searchParameters: z.record(z.string().regex(/^[A-Za-z0-9_-]+$/), z.string().max(500)).default({}),
  detailsParameters: z.record(z.string().regex(/^[A-Za-z0-9_-]+$/), z.string().max(500)).default({}),
  minimumRequestIntervalMs: z.number().int().min(0).max(60_000).default(0),
  apiKeyHeader: z.string().regex(/^[A-Za-z0-9-]+$/).optional(),
  apiKeyPrefix: z.string().max(40).optional(),
  fields: z.object({
    id: fieldPath,
    title: fieldPath,
    originalTitle: fieldPath.optional(),
    synopsis: fieldPath.optional(),
    year: fieldPath.optional(),
    rating: fieldPath.optional(),
    ratingScale: z.number().positive().max(100).default(10),
    genres: fieldPath.optional(),
    genreName: fieldPath.optional(),
    cover: fieldPath.optional(),
    backdrop: fieldPath.optional(),
    externalUrl: fieldPath.optional(),
    status: fieldPath.optional(),
    contentKind: fieldPath.optional(),
    episodeCount: fieldPath.optional(),
    chapterCount: fieldPath.optional()
  }),
  timeoutMs: z.number().int().min(100).max(30_000).default(8000),
  maxResponseBytes: z.number().int().min(1024).max(16_000_000).default(2_000_000)
}).superRefine((provider, context) => {
  if (!provider.detailsPath.includes('{id}')) {
    context.addIssue({ code: 'custom', path: ['detailsPath'], message: 'detailsPath must include the {id} placeholder.' });
  }
  if (provider.fields.genreName && !provider.fields.genres) {
    context.addIssue({ code: 'custom', path: ['fields', 'genres'], message: 'genres is required when genreName is set.' });
  }
});

export type JsonMetadataProviderDefinition = z.input<typeof providerSchema>;
export type JsonMetadataRightsReview = z.infer<typeof rightsReviewSchema>;

export function parseJsonMetadataRightsReview(serialized: string): JsonMetadataRightsReview {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch { throw new Error('Rights review config must contain a JSON object.'); }
  return rightsReviewSchema.parse(value);
}

function valueAt(record: unknown, path?: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function stringAt(record: unknown, path?: string): string | undefined {
  const value = valueAt(record, path);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberAt(record: unknown, path?: string): number | undefined {
  const value = valueAt(record, path);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function normalizeYear(value: unknown): number | null {
  const candidate = typeof value === 'number' ? value : typeof value === 'string' ? Number(/^\d{4}/.exec(value)?.[0]) : NaN;
  return Number.isInteger(candidate) && candidate >= 1800 && candidate <= 2200 ? candidate : null;
}

function normalizeGenres(record: unknown, path?: string, namePath?: string): string[] {
  const values = valueAt(record, path);
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const name = namePath ? stringAt(value, namePath) : typeof value === 'string' ? value.trim() : undefined;
    return name ? [name.slice(0, 80)] : [];
  }).slice(0, 40);
}

function createSummary(record: unknown, provider: z.infer<typeof providerSchema>): MediaSummary {
  const title = stringAt(record, provider.fields.title);
  const providerId = valueAt(record, provider.fields.id);
  if (!title || (typeof providerId !== 'string' && typeof providerId !== 'number')) {
    throw new Error(`Provider ${provider.id} returned a record without the configured id/title fields.`);
  }
  const rating = numberAt(record, provider.fields.rating);
  const contentKind = stringAt(record, provider.fields.contentKind);
  return {
    id: String(providerId),
    type: provider.mediaType,
    contentKind: contentKind === 'film' || contentKind === 'series' || contentKind === 'collection' || contentKind === 'one-shot' ? contentKind : undefined,
    title,
    originalTitle: stringAt(record, provider.fields.originalTitle) ?? title,
    synopsis: stringAt(record, provider.fields.synopsis) ?? '',
    year: normalizeYear(valueAt(record, provider.fields.year)),
    rating: rating === undefined ? 0 : Math.max(0, Math.min(10, rating * 10 / provider.fields.ratingScale)),
    genres: normalizeGenres(record, provider.fields.genres, provider.fields.genreName),
    cover: stringAt(record, provider.fields.cover),
    backdrop: stringAt(record, provider.fields.backdrop),
    accent: '#526b73',
    status: stringAt(record, provider.fields.status) ?? 'Metadata only',
    label: `${provider.name} · METADATA`.toLocaleUpperCase(),
    externalUrl: stringAt(record, provider.fields.externalUrl),
    sourceName: provider.name,
    episodeCount: numberAt(record, provider.fields.episodeCount),
    chapterCount: numberAt(record, provider.fields.chapterCount)
  };
}

function endpoint(baseUrl: string, path: string): URL {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/+$/, '');
  base.pathname = `${basePath}/${path.replace(/^\/+/, '')}`;
  base.search = '';
  base.hash = '';
  return base;
}

async function requestJson(context: ModuleRuntimeContext, url: URL, provider: z.infer<typeof providerSchema>, apiKey?: string): Promise<unknown> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (apiKey && provider.apiKeyHeader) headers[provider.apiKeyHeader] = `${provider.apiKeyPrefix ?? ''}${apiKey}`;
  const response = await context.fetch(url, { headers });
  if (!response.ok) throw new Error(`Provider ${provider.id} returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

function unwrapItems(response: unknown, resultsPath?: string): unknown[] {
  if (Array.isArray(response) && !resultsPath) return response;
  const items = valueAt(response, resultsPath);
  if (!Array.isArray(items)) throw new Error('Configured metadata search response path must resolve to an array.');
  return items;
}

export function parseJsonMetadataProviders(serialized: string): JsonMetadataProviderDefinition[] {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch { throw new Error('METADATA_PROVIDERS_JSON must contain a valid JSON array.'); }
  const providers = z.array(providerSchema).max(20).parse(value);
  if (new Set(providers.map((provider) => provider.id)).size !== providers.length) {
    throw new Error('METADATA_PROVIDERS_JSON must use unique provider ids.');
  }
  return providers;
}

export async function createJsonMetadataModule(definition: JsonMetadataProviderDefinition, apiKey?: string): Promise<AnimeModule | MangaModule> {
  const provider = providerSchema.parse(definition);
  if (provider.apiKeyHeader && !apiKey) throw new Error(`Provider ${provider.id} requires an API key in METADATA_API_KEYS_JSON.`);
  if (apiKey && !provider.apiKeyHeader) throw new Error(`Provider ${provider.id} received a key without an apiKeyHeader mapping.`);
  const baseHost = new URL(provider.baseUrl).hostname;
  const allowedHosts = [...new Set([baseHost, ...provider.allowedHosts])];
  const entrySha256 = createHash('sha256')
    .update(await readFile(fileURLToPath(import.meta.url)))
    .update('\0')
    .update(JSON.stringify(provider))
    .digest('hex');
  let requestQueue = Promise.resolve();
  let lastRequestAt = 0;
  const fetchProviderJson = async (context: ModuleRuntimeContext, url: URL): Promise<unknown> => {
    if (provider.minimumRequestIntervalMs === 0) return requestJson(context, url, provider, apiKey);
    let release: () => void = () => {};
    const turn = new Promise<void>((resolve) => { release = resolve; });
    const previous = requestQueue;
    requestQueue = previous.then(() => turn);
    await previous;
    try {
      const waitMs = Math.max(0, provider.minimumRequestIntervalMs - (Date.now() - lastRequestAt));
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastRequestAt = Date.now();
      return await requestJson(context, url, provider, apiKey);
    } finally {
      release();
    }
  };
  const manifest = {
    schemaVersion: 1 as const,
    contractVersion: 1 as const,
    id: provider.id,
    version: '1.0.0',
    mediaType: provider.mediaType,
    minimumAppVersion: '0.1.0',
    capabilities: ['search', 'details'] as ModuleCapability[],
    allowedHosts,
    runtime: { timeoutMs: provider.timeoutMs, maxResponseBytes: provider.maxResponseBytes },
    attribution: `Metadata provided by ${provider.name}; rights basis ${provider.rightsReview.basis}; evidence ${provider.rightsReview.evidenceUrl}; reviewed ${provider.rightsReview.reviewedAt}.`,
    integrity: { algorithm: 'sha256' as const, entrySha256 }
  };
  const search = async (query: string, context: ModuleRuntimeContext) => {
    const url = endpoint(provider.baseUrl, provider.searchPath);
    for (const [key, value] of Object.entries(provider.searchParameters)) url.searchParams.set(key, value);
    if (query.trim()) url.searchParams.set(provider.queryParameter, query.trim());
    const response = await fetchProviderJson(context, url);
    return unwrapItems(response, provider.resultsPath).map((record) => createSummary(record, provider));
  };
  const getDetails = async (id: string, context: ModuleRuntimeContext) => {
    const url = endpoint(provider.baseUrl, provider.detailsPath.replaceAll('{id}', encodeURIComponent(id)));
    for (const [key, value] of Object.entries(provider.detailsParameters)) url.searchParams.set(key, value);
    const response = await fetchProviderJson(context, url);
    return createSummary(valueAt(response, provider.detailResultPath) ?? response, provider);
  };

  if (provider.mediaType === 'anime') {
    return {
      manifest: { ...manifest, mediaType: 'anime' }, search, getDetails,
      async getEpisodes() { return []; },
      async getEpisode() { return undefined; },
      async getSources() { return []; }
    };
  }
  return {
    manifest: { ...manifest, mediaType: 'manga' }, search, getDetails,
    async getChapters() { return []; },
    async getPages() { return []; }
  };
}

export function createJsonMetadataModules(serialized: string | undefined, serializedKeys?: string): Promise<Array<AnimeModule | MangaModule>> {
  if (!serialized?.trim()) return Promise.resolve([]);
  const definitions = parseJsonMetadataProviders(serialized);
  let keys: Record<string, string> = {};
  if (serializedKeys?.trim()) {
    try { keys = z.record(z.string().min(1), z.string().min(1).max(2000)).parse(JSON.parse(serializedKeys)); }
    catch { throw new Error('METADATA_API_KEYS_JSON must be a JSON object mapping provider ids to API keys.'); }
  }
  const providerIds = new Set(definitions.map((provider) => provider.id));
  const unknownKeyIds = Object.keys(keys).filter((providerId) => !providerIds.has(providerId));
  if (unknownKeyIds.length) throw new Error(`METADATA_API_KEYS_JSON contains unknown provider id: ${unknownKeyIds[0]}.`);
  return Promise.all(definitions.map((definition) => createJsonMetadataModule(definition, keys[definition.id])));
}