import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { loadInstalledModules } from './modules/installed.js';
import { createRegistry } from './modules/registry.js';
import { createAuthGuard, requireScopes } from './auth.js';
import { createApiCache } from './cache.js';
import { loadConfig } from './config.js';
import { createRepository } from './persistence.js';
import { createIdentityStore } from './modules/identities.js';
import { searchOpenLibraryComics } from './modules/open-library-comics.js';

const config = loadConfig();
const app = Fastify({
	bodyLimit: 1_000_000,
	logger: { redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' } }
});
app.decorateRequest('authSubject', null);
app.decorateRequest('authScopes', null as unknown as Set<string>);
await app.register(helmet);
await app.register(cors, { origin: config.corsOrigins, credentials: false });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
const identities = await createIdentityStore(config.databaseUrl);
const modules = createRegistry(await loadInstalledModules(config.malClientId, config.metadataProvidersJson, config.metadataApiKeysJson, config.enableJikanMetadata, config.jikanRightsReviewJson), {
	environment: config.nodeEnv,
	publicKey: config.moduleCatalogPublicKey,
	signature: config.moduleCatalogSignature,
	allowDemoModules: config.allowDemoModules
}, identities);
const requireAuth = createAuthGuard(config);
const repository = await createRepository(config.databaseUrl);
const cache = await createApiCache(config.redisUrl);

app.get('/api/v1/health', async () => ({ status: 'ok', service: 'wyllo-api' }));
app.get('/api/v1/modules', async () => ({ contractVersion: 1, modules: modules.manifests() }));
app.get('/api/v1/health/ready', async (_request, reply) => {
	try { await Promise.all([repository.check(), cache.check(), identities.check()]); return { status: 'ready' }; }
	catch { return reply.code(503).send({ status: 'unavailable' }); }
});

app.get('/api/v1/home', async () => cache.getOrLoad('home:v5', 120, async () => {
	const [anime, manga] = await Promise.all([modules.search('', 'anime'), modules.search('', 'manga')]);
	return { featured: anime[0] ?? manga[0] ?? null, anime, manga };
}));

app.get('/api/v1/search', async (request, reply) => {
	const query = z.object({
		q: z.string().trim().max(80).optional().default(''),
		type: z.enum(['anime', 'manga']).optional()
	}).safeParse(request.query);
	if (!query.success) return reply.code(400).send({ error: 'Invalid search query.' });
	const cacheKey = `search:v5:${query.data.type ?? 'all'}:${query.data.q.toLocaleLowerCase()}`;
	return cache.getOrLoad(cacheKey, 60, async () => {
		const items = await modules.search(query.data.q, query.data.type);
		const allItems = query.data.type ? await modules.search(query.data.q) : items;
		return { items, total: items.length, allTotal: allItems.length };
	});
});

app.get('/api/v1/comics', async (request, reply) => {
	const query = z.object({ q: z.string().trim().max(80).optional().default('') }).safeParse(request.query);
	if (!query.success) return reply.code(400).send({ error: 'Invalid comics search query.' });
	const cacheKey = `comics:v1:${query.data.q.toLocaleLowerCase()}`;
	try {
		return await cache.getOrLoad(cacheKey, 300, async () => ({ items: await searchOpenLibraryComics(query.data.q) }));
	} catch {
		return reply.code(502).send({ error: 'The comics catalog is temporarily unavailable.' });
	}
});

app.get<{ Params: { id: string } }>('/api/v1/anime/:id', async (request, reply) => {
	const result = await cache.getOrLoad(`anime:v5:${request.params.id}`, 300, async () => {
		const anime = await modules.getAnime(request.params.id);
		return anime ? { anime, episodes: await modules.getEpisodes(anime.id) } : null;
	});
	if (!result) return reply.code(404).send({ error: 'Anime not found.' });
	return result;
});

app.get<{ Params: { id: string } }>('/api/v1/anime/:id/episodes', async (request, reply) => {
	const episodes = await cache.getOrLoad(`episodes:v5:${request.params.id}`, 300, () => modules.getEpisodes(request.params.id));
	if (!episodes.length) return reply.code(404).send({ error: 'Anime not found.' });
	return { episodes };
});

app.get<{ Params: { id: string } }>('/api/v1/episodes/:id/sources', async (request, reply) => {
	const sources = await modules.getSources(request.params.id);
	if (!sources.length) return reply.code(404).send({ error: 'Episode not found.' });
	return { sources };
});

app.get<{ Params: { id: string } }>('/api/v1/episodes/:id', async (request, reply) => {
	const result = await modules.getEpisode(request.params.id);
	if (!result) return reply.code(404).send({ error: 'Episode not found.' });
	return result;
});

app.get<{ Params: { id: string } }>('/api/v1/manga/:id', async (request, reply) => {
	const result = await cache.getOrLoad(`manga:v5:${request.params.id}`, 300, async () => {
		const manga = await modules.getManga(request.params.id);
		return manga ? { manga, chapters: await modules.getChapters(manga.id) } : null;
	});
	if (!result) return reply.code(404).send({ error: 'Manga not found.' });
	return result;
});

app.get<{ Params: { id: string } }>('/api/v1/manga/:id/chapters', async (request, reply) => {
	const chapters = await cache.getOrLoad(`chapters:v5:${request.params.id}`, 300, () => modules.getChapters(request.params.id));
	if (!chapters.length) return reply.code(404).send({ error: 'Manga not found.' });
	return { chapters };
});

app.get<{ Params: { id: string } }>('/api/v1/chapters/:id', async (request, reply) => {
	const result = await modules.getChapter(request.params.id);
	if (!result) return reply.code(404).send({ error: 'Chapter not found.' });
	return result;
});

app.get<{ Params: { id: string } }>('/api/v1/chapters/:id/pages', async (request, reply) => {
	const pages = await modules.getPages(request.params.id);
	if (!pages.length) return reply.code(404).send({ error: 'Chapter not found.' });
	return { pages };
});

app.get('/api/v1/library', { preHandler: [requireAuth, requireScopes('read:library')] }, async (request) => ({
	items: await repository.getLibrary(request.authSubject!)
}));

app.post('/api/v1/library', { preHandler: [requireAuth, requireScopes('write:library')] }, async (request, reply) => {
	const body = z.object({ id: z.string().min(1).max(160), type: z.enum(['anime', 'manga']) }).safeParse(request.body);
	if (!body.success) return reply.code(400).send({ error: 'Invalid library item.' });
	const item = body.data.type === 'anime' ? await modules.getAnime(body.data.id) : await modules.getManga(body.data.id);
	if (!item) return reply.code(404).send({ error: 'Title not found.' });
	await repository.addLibrary(request.authSubject!, body.data.id, body.data.type);
	return reply.code(201).send({ saved: true });
});

app.delete<{ Params: { id: string } }>('/api/v1/library/:id', { preHandler: [requireAuth, requireScopes('write:library')] }, async (request, reply) => {
	const id = z.string().min(1).max(160).safeParse(request.params.id);
	if (!id.success) return reply.code(400).send({ error: 'Invalid library item id.' });
	await repository.removeLibrary(request.authSubject!, id.data);
	return reply.code(204).send();
});

app.get('/api/v1/progress', { preHandler: [requireAuth, requireScopes('read:progress')] }, async (request) => ({
	items: await repository.getProgress(request.authSubject!)
}));

app.put<{ Params: { kind: string } }>('/api/v1/progress/:kind', { preHandler: [requireAuth, requireScopes('write:progress')] }, async (request, reply) => {
	const kind = z.enum(['watch', 'read']).safeParse(request.params.kind);
	const body = z.object({ key: z.string().min(1).max(200), percent: z.number().int().min(0).max(100) }).safeParse(request.body);
	if (!kind.success || !body.success) return reply.code(400).send({ error: 'Invalid progress update.' });
	await repository.saveProgress(request.authSubject!, body.data.key, kind.data, body.data.percent);
	return reply.code(204).send();
});

app.addHook('onClose', async () => Promise.all([repository.close(), cache.close(), identities.close()]));

await app.listen({ host: '0.0.0.0', port: config.apiPort });