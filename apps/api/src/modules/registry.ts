import { createPublicKey, randomUUID, verify as verifySignature } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { z } from 'zod';
import type { AnimeModule, Chapter, ContentIdentityStore, Episode, MangaModule, MediaSummary, MediaType, ModuleManifest, ModuleRuntimeContext, PageImage, ProviderReference, ReferenceEntity, VideoSource } from '@wyllo/domain';

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  contractVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
  mediaType: z.enum(['anime', 'manga']),
  minimumAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(z.enum(['search', 'details', 'episodes', 'sources', 'chapters', 'pages'])).min(2),
  allowedHosts: z.array(z.string().regex(/^(?!\*\.)[a-z0-9.-]+$/)).min(1),
  runtime: z.object({ timeoutMs: z.number().int().min(100).max(30_000), maxResponseBytes: z.number().int().min(1024).max(16_000_000) }),
  attribution: z.string().min(1).max(500),
  integrity: z.object({ algorithm: z.literal('sha256'), entrySha256: z.string().regex(/^[a-f0-9]{64}$/) })
});

const mediaSchema = z.object({
  id: z.string().min(1).max(500), type: z.enum(['anime', 'manga']), contentKind: z.enum(['film', 'series', 'collection', 'one-shot']).optional(), title: z.string().min(1).max(300),
  originalTitle: z.string().max(300), synopsis: z.string().max(10_000), year: z.number().int().min(1800).max(2200).nullable(),
  rating: z.number().min(0).max(10), genres: z.array(z.string().max(80)).max(40), cover: z.string().url().optional(),
  backdrop: z.string().url().optional(), accent: z.string().regex(/^#[0-9a-f]{6}$/i), status: z.string().max(120), label: z.string().max(120),
  externalUrl: z.string().url().optional(), sourceName: z.string().max(120).optional(), sourceLicense: z.string().max(200).optional(),
  sourceAttribution: z.string().max(1000).optional(), episodeCount: z.number().int().nonnegative().optional(), chapterCount: z.number().int().nonnegative().optional()
});
const episodeSchema = z.object({ id: z.string().min(1).max(200), animeId: z.string().min(1).max(160), number: z.number().int().positive(), title: z.string().min(1).max(300), duration: z.number().positive() });
const chapterSchema = z.object({ id: z.string().min(1).max(200), mangaId: z.string().min(1).max(160), number: z.number().int().positive(), title: z.string().min(1).max(300), pages: z.number().int().positive() });
const pageSchema = z.object({ number: z.number().int().positive(), url: z.string().url(), sourceUrl: z.string().url().optional(), licenseName: z.string().max(100).optional(), licenseUrl: z.string().url().optional(), attribution: z.string().max(1000).optional() });
const sourceSchema = z.object({ id: z.string().min(1).max(120), label: z.string().max(120), language: z.string().max(80), subtitles: z.boolean(), resolution: z.string().max(24), url: z.string().url(), externalUrl: z.string().url().optional(), licenseName: z.string().max(100).optional(), licenseUrl: z.string().url().optional(), attribution: z.string().max(1000).optional() });

type Provider = AnimeModule | MangaModule;

function memoryIdentityStore(): ContentIdentityStore {
  const identities = new Map<string, { id: string; reference: ProviderReference }>();
  const references = new Map<string, ProviderReference>();
  return {
    async getWylloId(reference) {
      const key = `${reference.moduleId}:${reference.entity}:${reference.providerRef}`;
      const existing = identities.get(key);
      if (existing) return existing.id;
      const id = randomUUID();
      identities.set(key, { id, reference });
      references.set(`${id}:${reference.entity}`, reference);
      return id;
    },
    async getProviderReference(id, entity: ReferenceEntity) { return references.get(`${id}:${entity}`); },
    async check() {},
    async close() { identities.clear(); references.clear(); }
  };
}

function assertHost(url: string, manifest: ModuleManifest): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !manifest.allowedHosts.includes(parsed.hostname)) {
    throw new Error(`Module ${manifest.id} returned a URL outside its HTTPS host allowlist.`);
  }
}

async function assertPublicHost(url: string, manifest: ModuleManifest): Promise<void> {
  assertHost(url, manifest);
  const hostname = new URL(url).hostname;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => {
    return ipaddr.parse(address).range() !== 'unicast';
  })) {
    throw new Error(`Module ${manifest.id} resolved to a private or reserved network address.`);
  }
}

function createContext(manifest: ModuleManifest, identities: ContentIdentityStore): ModuleRuntimeContext {
  const signal = AbortSignal.timeout(manifest.runtime.timeoutMs);
  return {
    signal,
    identities,
    async fetch(input, init = {}) {
      const url = new URL(input);
      await assertPublicHost(url.toString(), manifest);
      const method = (init.method ?? 'GET').toUpperCase();
      if (!['GET', 'HEAD', 'POST'].includes(method)) throw new Error(`Module ${manifest.id} requested a disallowed HTTP method.`);
      const response = await fetch(url, { ...init, method, signal: AbortSignal.any([signal, init.signal].filter((item): item is AbortSignal => Boolean(item))), redirect: 'manual', credentials: 'omit' });
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > manifest.runtime.maxResponseBytes) throw new Error(`Module ${manifest.id} response exceeded its size limit.`);
      if (response.status >= 300 && response.status < 400) throw new Error(`Module ${manifest.id} redirects are disabled.`);
      const reader = response.body?.getReader();
      if (!reader) return response;
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > manifest.runtime.maxResponseBytes) {
          await reader.cancel();
          throw new Error(`Module ${manifest.id} response exceeded its size limit.`);
        }
        chunks.push(value);
      }
      const body = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(response.status === 204 || response.status === 205 ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
  };
}

function assertSize(value: unknown, manifest: ModuleManifest): void {
  if (Buffer.byteLength(JSON.stringify(value) ?? 'null') > manifest.runtime.maxResponseBytes) {
    throw new Error(`Module ${manifest.id} output exceeded its size limit.`);
  }
}

async function invoke<T>(module: Provider, action: () => Promise<T>, validate: (value: unknown) => T): Promise<T> {
  const manifest = manifestSchema.parse(module.manifest);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: T;
  try {
    result = await Promise.race([
      action(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Module ${manifest.id} timed out.`)), manifest.runtime.timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  assertSize(result, manifest);
  const checked = validate(result);
  const values = Array.isArray(checked) ? checked : [checked];
  for (const item of values) {
    if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') assertHost(item.url, manifest);
    if (item && typeof item === 'object' && 'cover' in item) {
      if (typeof item.cover === 'string') assertHost(item.cover, manifest);
      if (typeof (item as { backdrop?: unknown }).backdrop === 'string') assertHost((item as { backdrop: string }).backdrop, manifest);
    }
    if (item && typeof item === 'object' && 'sourceUrl' in item && typeof item.sourceUrl === 'string') assertHost(item.sourceUrl, manifest);
    if (item && typeof item === 'object' && 'externalUrl' in item && typeof item.externalUrl === 'string') assertHost(item.externalUrl, manifest);
    if (item && typeof item === 'object' && 'licenseUrl' in item && typeof item.licenseUrl === 'string' && new URL(item.licenseUrl).protocol !== 'https:') {
      throw new Error(`Module ${manifest.id} returned a non-HTTPS license link.`);
    }
    if (item && typeof item === 'object' && 'type' in item && item.type !== manifest.mediaType) {
      throw new Error(`Module ${manifest.id} returned the wrong media type.`);
    }
  }
  return checked;
}

export function canonicalManifestPayload(manifests: ModuleManifest[]): string {
  return JSON.stringify([...manifests].sort((left, right) => left.id.localeCompare(right.id)));
}

export interface RegistrySecurityOptions {
  environment?: string;
  publicKey?: string;
  signature?: string;
  allowDemoModules?: boolean;
}

function verifyCatalog(manifests: ModuleManifest[], options: RegistrySecurityOptions): void {
  const production = options.environment === 'production';
  if (production && !options.allowDemoModules && manifests.some((manifest) => manifest.id.startsWith('demo-'))) {
    throw new Error('Demo modules are disabled in production. Configure a licensed provider module.');
  }
  if (!options.signature && !options.publicKey) {
    if (production) throw new Error('A signed module catalogue is required in production.');
    return;
  }
  if (!options.signature || !options.publicKey) throw new Error('Both module catalogue signature and public key are required.');
  const valid = verifySignature(null, Buffer.from(canonicalManifestPayload(manifests)), createPublicKey(options.publicKey), Buffer.from(options.signature, 'base64'));
  if (!valid) throw new Error('Module catalogue signature verification failed.');
}

export interface ModuleRegistry {
  manifests(): ModuleManifest[];
  search(query: string, type?: MediaType): Promise<MediaSummary[]>;
  getAnime(id: string): Promise<MediaSummary | undefined>;
  getEpisodes(id: string): Promise<Episode[]>;
  getEpisode(id: string): Promise<{ anime: MediaSummary; episode: Episode } | undefined>;
  getSources(id: string): Promise<VideoSource[]>;
  getManga(id: string): Promise<MediaSummary | undefined>;
  getChapters(id: string): Promise<Chapter[]>;
  getChapter(id: string): Promise<{ manga: MediaSummary; chapter: Chapter; chapters: Chapter[] } | undefined>;
  getPages(id: string): Promise<PageImage[]>;
}

async function mapChapter(
  module: MangaModule,
  chapter: Chapter,
  mangaId: string,
  parentProviderRef: string,
  identityStore: ContentIdentityStore
): Promise<Chapter> {
  return {
    ...chapter,
    id: await identityStore.getWylloId({ moduleId: module.manifest.id, entity: 'chapter', mediaType: 'manga', providerRef: chapter.id, parentProviderRef }),
    mangaId
  };
}

export function createRegistry(modules: Provider[], security: RegistrySecurityOptions = {}, identityStore: ContentIdentityStore = memoryIdentityStore()): ModuleRegistry {
  const manifests = modules.map((module) => manifestSchema.parse(module.manifest) as ModuleManifest);
  if (new Set(manifests.map((manifest) => manifest.id)).size !== manifests.length) throw new Error('Module ids must be unique.');
  const currentVersion = [0, 1, 0];
  for (const manifest of manifests) {
    const expected = ['search', 'details'];
    if (!expected.every((capability) => manifest.capabilities.includes(capability as ModuleManifest['capabilities'][number]))) {
      throw new Error(`Module ${manifest.id} does not declare all required capabilities.`);
    }
    const minimumVersion = manifest.minimumAppVersion.split('.').map(Number);
    if (minimumVersion.some((part, index) => part > currentVersion[index] && minimumVersion.slice(0, index).every((value, prior) => value === currentVersion[prior]))) {
      throw new Error(`Module ${manifest.id} requires a newer Wyllo API version.`);
    }
  }
  verifyCatalog(manifests, security);
  if (security.environment === 'production' && modules.length === 0) {
    throw new Error('Production requires at least one registered provider module.');
  }
  const animeModules = modules.filter((module): module is AnimeModule => module.manifest.mediaType === 'anime');
  const mangaModules = modules.filter((module): module is MangaModule => module.manifest.mediaType === 'manga');

  return {
    manifests: () => manifests,
    async search(query, type) {
      const selected = type ? (type === 'anime' ? animeModules : mangaModules) : modules;
      const results = await Promise.all(selected.map(async (module) => {
        const context = createContext(module.manifest, identityStore);
        const items = await invoke(module, () => module.search(query, context), (value) => z.array(mediaSchema).parse(value));
        return { module, items };
      }));
      const normalized = await Promise.all(results.flatMap(({ module, items }) => items.map(async (item) => {
        const id = await identityStore.getWylloId({ moduleId: module.manifest.id, entity: 'media', mediaType: item.type, providerRef: item.id });
        return { ...item, id };
      })));
      return [...new Map(normalized.map((item) => [item.id, item])).values()];
    },
    async getAnime(id) {
      const reference = await identityStore.getProviderReference(id, 'media');
      if (!reference || reference.mediaType !== 'anime') return undefined;
      for (const module of animeModules) {
        if (module.manifest.id !== reference.moduleId) continue;
        const context = createContext(module.manifest, identityStore);
        const item = await invoke(module, () => module.getDetails(reference.providerRef, context), (value) => value === undefined ? undefined : mediaSchema.parse(value));
        return item ? { ...item, id } : undefined;
      }
      return undefined;
    },
    async getEpisodes(id) {
      const reference = await identityStore.getProviderReference(id, 'media');
      const module = reference && animeModules.find((candidate) => candidate.manifest.id === reference.moduleId);
      if (!reference || reference.mediaType !== 'anime' || !module) return [];
      const context = createContext(module.manifest, identityStore);
      const episodes = await invoke(module, () => module.getEpisodes(reference.providerRef, context), (value) => z.array(episodeSchema).parse(value));
      return Promise.all(episodes.map(async (episode) => ({
        ...episode,
        id: await identityStore.getWylloId({ moduleId: module.manifest.id, entity: 'episode', mediaType: 'anime', providerRef: episode.id }),
        animeId: id
      })));
    },
    async getEpisode(id) {
      const reference = await identityStore.getProviderReference(id, 'episode');
      const module = reference && animeModules.find((candidate) => candidate.manifest.id === reference.moduleId);
      if (!reference || !module) return undefined;
      const context = createContext(module.manifest, identityStore);
      const episode = await invoke(module, () => module.getEpisode(reference.providerRef, context), (value) => value === undefined ? undefined : episodeSchema.parse(value));
      if (!episode) return undefined;
      const animeId = await identityStore.getWylloId({ moduleId: module.manifest.id, entity: 'media', mediaType: 'anime', providerRef: episode.animeId });
      const animeData = await invoke(module, () => module.getDetails(episode.animeId, context), (value) => value === undefined ? undefined : mediaSchema.parse(value));
      if (!animeData) return undefined;
      return { anime: { ...animeData, id: animeId }, episode: { ...episode, id, animeId } };
    },
    async getSources(id) {
      const reference = await identityStore.getProviderReference(id, 'episode');
      const module = reference && animeModules.find((candidate) => candidate.manifest.id === reference.moduleId);
      if (!reference || !module) return [];
      const context = createContext(module.manifest, identityStore);
      return invoke(module, () => module.getSources(reference.providerRef, context), (value) => z.array(sourceSchema).parse(value));
    },
    async getManga(id) {
      const reference = await identityStore.getProviderReference(id, 'media');
      if (!reference || reference.mediaType !== 'manga') return undefined;
      for (const module of mangaModules) {
        if (module.manifest.id !== reference.moduleId) continue;
        const context = createContext(module.manifest, identityStore);
        const item = await invoke(module, () => module.getDetails(reference.providerRef, context), (value) => value === undefined ? undefined : mediaSchema.parse(value));
        return item ? { ...item, id } : undefined;
      }
      return undefined;
    },
    async getChapters(id) {
      const reference = await identityStore.getProviderReference(id, 'media');
      const module = reference && mangaModules.find((candidate) => candidate.manifest.id === reference.moduleId);
      if (!reference || reference.mediaType !== 'manga' || !module) return [];
      const context = createContext(module.manifest, identityStore);
      const chapters = await invoke(module, () => module.getChapters(reference.providerRef, context), (value) => z.array(chapterSchema).parse(value));
      return Promise.all(chapters.map((chapter) => mapChapter(module, chapter, id, reference.providerRef, identityStore)));
    },
    async getChapter(id) {
      const reference = await identityStore.getProviderReference(id, 'chapter');
      if (!reference?.parentProviderRef) return undefined;
      const module = mangaModules.find((candidate) => candidate.manifest.id === reference.moduleId);
      if (!module) return undefined;
      const context = createContext(module.manifest, identityStore);
      const [mangaData, chapters] = await Promise.all([
        invoke(module, () => module.getDetails(reference.parentProviderRef!, context), (value) => value === undefined ? undefined : mediaSchema.parse(value)),
        invoke(module, () => module.getChapters(reference.parentProviderRef!, context), (value) => z.array(chapterSchema).parse(value))
      ]);
      if (!mangaData) return undefined;
      const mangaId = await identityStore.getWylloId({ moduleId: module.manifest.id, entity: 'media', mediaType: 'manga', providerRef: reference.parentProviderRef });
      const mappedChapters = await Promise.all(chapters.map((chapter) => mapChapter(module, chapter, mangaId, reference.parentProviderRef!, identityStore)));
      const chapter = mappedChapters.find((item) => item.id === id);
      return chapter ? { manga: { ...mangaData, id: mangaId }, chapter, chapters: mappedChapters } : undefined;
    },
    async getPages(id) {
      const reference = await identityStore.getProviderReference(id, 'chapter');
      const module = reference && mangaModules.find((candidate) => candidate.manifest.id === reference.moduleId);
      if (!reference || !module) return [];
      const context = createContext(module.manifest, identityStore);
      return invoke(module, () => module.getPages(reference.providerRef, context), (value) => z.array(pageSchema).parse(value));
    }
  };
}