import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import type { AnimeModule, MangaModule, MediaSummary, ModuleRuntimeContext, PageImage, ProviderReference, ReferenceEntity } from '@wyllo/domain';
import { createAniListMetadataModule } from '../src/modules/anilist-metadata.js';
import { createIdentityStore } from '../src/modules/identities.js';
import { loadInstalledModules } from '../src/modules/installed.js';
import { createJsonMetadataModule, createJsonMetadataModules, parseJsonMetadataProviders } from '../src/modules/json-metadata-api.js';
import { createJikanAnimeMetadataProvider } from '../src/modules/jikan-anime-metadata.js';
import { createMalAnimeModule } from '../src/modules/mal-anime-metadata.js';
import { searchOpenLibraryComics } from '../src/modules/open-library-comics.js';
import { canonicalManifestPayload, createRegistry } from '../src/modules/registry.js';

function context(fetcher: (url: URL) => Promise<Response>): ModuleRuntimeContext {
  return { signal: new AbortController().signal, identities: createIdentityStore() as never, fetch: fetcher };
}

function fixtureMedia(id: string, type: 'anime' | 'manga'): MediaSummary {
  return {
    id, type, title: type === 'anime' ? 'Fixture Film' : 'Fixture Pages', originalTitle: '',
    synopsis: 'Rights-cleared test fixture.', year: 1907, rating: 0, genres: [],
    cover: `https://images.example/${id}.jpg`, backdrop: `https://images.example/${id}-backdrop.jpg`,
    accent: '#667788', status: 'Public domain', label: 'ARCHIVE', externalUrl: `https://catalog.example/${id}`
  };
}

const moduleManifest = (id: string, mediaType: 'anime' | 'manga', capabilities: string[]) => ({
  schemaVersion: 1 as const, contractVersion: 1 as const, id, version: '1.0.0', mediaType,
  minimumAppVersion: '0.1.0', capabilities: capabilities as never, allowedHosts: ['images.example', 'media.example', 'catalog.example'],
  runtime: { timeoutMs: 2000, maxResponseBytes: 100_000 }, attribution: 'Fixture-only test content.',
  integrity: { algorithm: 'sha256' as const, entrySha256: 'a'.repeat(64) }
});

function fixtureModules(): [AnimeModule, MangaModule] {
  const animeId = 'provider-anime-id';
  const episodeId = 'provider-episode-id';
  const mangaId = 'provider-manga-id';
  const chapterId = 'provider-chapter-id';
  const anime: AnimeModule = {
    manifest: moduleManifest('fixture-anime', 'anime', ['search', 'details', 'episodes', 'sources']),
    async search() { return [fixtureMedia(animeId, 'anime')]; },
    async getDetails(id: string) { return id === animeId ? fixtureMedia(animeId, 'anime') : undefined; },
    async getEpisodes(id: string) { return id === animeId ? [{ id: episodeId, animeId, number: 1, title: 'The Film', duration: 4 }] : []; },
    async getEpisode(id: string) { return id === episodeId ? { id: episodeId, animeId, number: 1, title: 'The Film', duration: 4 } : undefined; },
    async getSources(id: string) { return id === episodeId ? [{ id: 'source', label: 'Archive', language: 'Silent', subtitles: false, resolution: '320x240', url: 'https://media.example/film.mp4' }] : []; }
  };
  const manga: MangaModule = {
    manifest: moduleManifest('fixture-manga', 'manga', ['search', 'details', 'chapters', 'pages']),
    async search() { return [fixtureMedia(mangaId, 'manga')]; },
    async getDetails(id: string) { return id === mangaId ? fixtureMedia(mangaId, 'manga') : undefined; },
    async getChapters(id: string) { return id === mangaId ? [{ id: chapterId, mangaId, number: 1, title: 'Page set', pages: 1 }] : []; },
    async getPages(id: string): Promise<PageImage[]> { return id === chapterId ? [{ number: 1, url: 'https://images.example/page.jpg' }] : []; }
  };
  return [anime, manga];
}

test('AniList anime metadata supports search, details, and trend browsing without playback claims', async () => {
  const module = await createAniListMetadataModule('anime');
  const requests: Array<{ url: URL; body: { query: string; variables: Record<string, unknown> } }> = [];
  const api = context(async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    requests.push({ url, body });
    if (body.query.includes('Page(')) {
      return Response.json({ data: { Page: { media: [{
        id: 5114, format: 'TV', status: 'FINISHED', startDate: { year: 2009 }, episodes: 64,
        averageScore: 91, genres: ['Action', 'Adventure'], description: 'Two brothers search for a stone.',
        siteUrl: 'https://anilist.co/anime/5114', title: { romaji: 'Hagane no Renkinjutsushi', english: 'Fullmetal Alchemist: Brotherhood', native: '鋼の錬金術師' },
        coverImage: { large: 'https://s4.anilist.co/anime.jpg' }
      }] } } });
    }
    return Response.json({ data: { Media: {
      id: 5114, title: { romaji: 'Hagane no Renkinjutsushi', english: 'Fullmetal Alchemist: Brotherhood', native: '鋼の錬金術師' },
      description: 'Two brothers search for a stone.', siteUrl: 'https://anilist.co/anime/5114'
    } } });
  });
  const [anime] = await module.search('Fullmetal', api);
  assert.equal(anime.title, 'Fullmetal Alchemist: Brotherhood');
  assert.equal(anime.year, 2009);
  assert.equal(anime.rating, 9.1);
  assert.equal(anime.episodeCount, 64);
  assert.equal(anime.cover, 'https://s4.anilist.co/anime.jpg');
  assert.equal((await module.getDetails('5114', api))?.id, '5114');
  assert.equal(requests[0].url.hostname, 'graphql.anilist.co');
  assert.equal(requests[0].body.variables.type, 'ANIME');
  assert.deepEqual(requests[1].body.variables, { id: 5114, type: 'ANIME' });
  assert.deepEqual(module.manifest.capabilities, ['search', 'details']);
  assert.deepEqual(await module.getEpisodes('5114', api), []);
  assert.deepEqual(await module.getSources('5114:1', api), []);
});

test('AniList manga metadata supports catalog search without chapter-page access', async () => {
  const module = await createAniListMetadataModule('manga');
  const api = context(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { variables: Record<string, unknown> };
    assert.equal(body.variables.type, 'MANGA');
    return Response.json({ data: { Page: { media: [{
      id: 30013, format: 'MANGA', status: 'RELEASING', startDate: { year: 1997 }, chapters: null,
      averageScore: 90, genres: ['Action'], description: 'A pirate adventure.', siteUrl: 'https://anilist.co/manga/30013',
      title: { romaji: 'ONE PIECE', english: 'One Piece', native: 'ONE PIECE' }, coverImage: { large: 'https://s4.anilist.co/manga.jpg' }
    }] } } });
  });
  const [manga] = await module.search('One Piece', api);
  assert.equal(manga.type, 'manga');
  assert.equal(manga.title, 'One Piece');
  assert.equal(manga.chapterCount, undefined);
  assert.deepEqual(await module.getChapters(manga.id, api), []);
  assert.deepEqual(await module.getPages('chapter-id', api), []);
});

test('Open Library comics search maps public catalog metadata and only links public scans to reading', async () => {
  let requestedUrl: URL | undefined;
  const comics = await searchOpenLibraryComics('Spider-Man', async (input) => {
    requestedUrl = new URL(input);
    return Response.json({ docs: [
      { key: '/works/OL123W', title: 'Spider-Man: Public Edition', author_name: ['A. Author'], first_publish_year: 1963, cover_i: 456, ebook_access: 'public' },
      { key: '/works/OL124W', title: 'Spider-Man: Borrowable Edition', ebook_access: 'borrowable' },
      { key: '/works/not-a-work', title: 'Invalid result' }
    ] });
  });
  assert.equal(requestedUrl?.hostname, 'openlibrary.org');
  assert.equal(requestedUrl?.searchParams.get('q'), 'subject:comics Spider-Man');
  assert.deepEqual(comics.map((comic) => comic.title), ['Spider-Man: Public Edition', 'Spider-Man: Borrowable Edition']);
  assert.equal(comics[0].coverUrl, 'https://covers.openlibrary.org/b/id/456-M.jpg');
  assert.equal(comics[0].readUrl, 'https://openlibrary.org/works/OL123W');
  assert.equal(comics[1].readUrl, undefined);
  assert.equal(comics[1].access, 'borrowable');
});

test('MyAnimeList module normalizes metadata and does not invent playable sources', async () => {
  const module = await createMalAnimeModule('fixture-client-id');
  const requests: Array<{ url: URL; headers: Headers }> = [];
  const api = context(async (url, init) => {
    requests.push({ url, headers: new Headers(init?.headers) });
    return Response.json({
      data: [{ node: {
        id: 5114,
        title: 'Fullmetal Alchemist: Brotherhood',
        main_picture: { large: 'https://cdn.myanimelist.net/images/anime/1223/96541.jpg' },
        alternative_titles: { ja: '鋼の錬金術師 FULLMETAL ALCHEMIST' },
        synopsis: 'Two brothers search for the Philosopher’s Stone.',
        start_date: '2009-04-05',
        mean: 9.1,
        genres: [{ name: 'Action' }, { name: 'Adventure' }],
        num_episodes: 64,
        media_type: 'tv',
        status: 'finished_airing'
      } }]
    });
  });
  const [anime] = await module.search('Fullmetal Alchemist', api);
  assert.equal(anime.title, 'Fullmetal Alchemist: Brotherhood');
  assert.equal(anime.originalTitle, '鋼の錬金術師 FULLMETAL ALCHEMIST');
  assert.equal(anime.year, 2009);
  assert.equal(anime.episodeCount, 64);
  assert.equal(anime.cover, undefined);
  assert.equal(anime.backdrop, undefined);
  assert.equal(anime.sourceName, 'MyAnimeList');
  assert.equal(anime.externalUrl, 'https://myanimelist.net/anime/5114');
  assert.equal(requests[0].url.origin, 'https://api.myanimelist.net');
  assert.equal(requests[0].url.pathname, '/v2/anime');
  assert.equal(requests[0].url.searchParams.get('q'), 'Fullmetal Alchemist');
  assert.equal(requests[0].headers.get('X-MAL-CLIENT-ID'), 'fixture-client-id');
  assert.deepEqual(await module.getEpisodes(anime.id, api), []);
  assert.deepEqual(await module.getSources('5114:1', api), []);
});

test('MyAnimeList metadata module declares no episode or stream capability', async () => {
  const module = await createMalAnimeModule('fixture-client-id');
  createRegistry([module]);
  assert.deepEqual(module.manifest.capabilities, ['search', 'details']);
});

test('Jikan preset maps documented anime metadata and remains metadata-only', async () => {
  const module = await createJsonMetadataModule(createJikanAnimeMetadataProvider({
    basis: 'written-permission', evidenceUrl: 'https://example.org/jikan-permission', reviewedAt: '2026-10-09'
  }));
  const requests: URL[] = [];
  const api = context(async (url) => {
    requests.push(url);
    if (url.pathname.endsWith('/full')) {
      return Response.json({ data: {
        mal_id: 5114, title: 'Fullmetal Alchemist: Brotherhood', title_japanese: '鋼の錬金術師',
        synopsis: 'Two brothers search for the Philosopher Stone.', year: 2009, score: 9.1,
        genres: [{ name: 'Action' }], episodes: 64, url: 'https://myanimelist.net/anime/5114', status: 'Finished Airing'
      } });
    }
    return Response.json({ data: [{
      mal_id: 5114, title: 'Fullmetal Alchemist: Brotherhood', title_japanese: '鋼の錬金術師',
      synopsis: 'Two brothers search for the Philosopher Stone.', year: 2009, score: 9.1,
      genres: [{ name: 'Action' }], episodes: 64, url: 'https://myanimelist.net/anime/5114', status: 'Finished Airing'
    }] });
  });
  const [anime] = await module.search('Fullmetal', api);
  assert.equal(anime.id, '5114');
  assert.equal(anime.title, 'Fullmetal Alchemist: Brotherhood');
  assert.equal(anime.year, 2009);
  assert.equal(anime.rating, 9.1);
  assert.equal(anime.episodeCount, 64);
  assert.equal(anime.cover, undefined);
  assert.equal(anime.externalUrl, 'https://myanimelist.net/anime/5114');
  assert.equal(requests[0].origin, 'https://api.jikan.moe');
  assert.equal(requests[0].pathname, '/v4/anime');
  assert.equal(requests[0].searchParams.get('sfw'), 'true');
  assert.equal((await module.getDetails('5114', api))?.id, '5114');
  assert.deepEqual(module.manifest.capabilities, ['search', 'details']);
  assert.deepEqual(await module.getEpisodes('5114', api), []);
  assert.deepEqual(await module.getSources('5114:1', api), []);
});

test('Jikan preset refuses terms-only review without written permission', () => {
  assert.throws(() => createJikanAnimeMetadataProvider({
    basis: 'provider-terms', evidenceUrl: 'https://jikan.moe/terms', reviewedAt: '2026-10-09'
  }), /written permission evidence/);
});

test('enabling Jikan replaces AniList anime metadata while retaining AniList manga metadata', async () => {
  const defaultModules = await loadInstalledModules();
  assert.deepEqual(defaultModules.map((module) => module.manifest.id), ['anilist-manga-metadata', 'anilist-anime-metadata']);
  const rightsReview = JSON.stringify({ basis: 'written-permission', evidenceUrl: 'https://example.org/permission', reviewedAt: '2026-10-09' });
  const jikanModules = await loadInstalledModules(undefined, undefined, undefined, true, rightsReview);
  assert.deepEqual(jikanModules.map((module) => module.manifest.id), ['anilist-manga-metadata', 'jikan-anime-metadata']);
});

test('configured JSON metadata API normalizes manga and registers without chapter claims', async () => {
  const [definition] = parseJsonMetadataProviders(JSON.stringify([{
    id: 'catalog-manga',
    name: 'Verified Catalog',
    mediaType: 'manga',
    rightsReview: { basis: 'provider-terms', evidenceUrl: 'https://catalog.example/terms', reviewedAt: '2026-10-09' },
    baseUrl: 'https://catalog.example/v1',
    allowedHosts: ['images.example'],
    searchPath: 'manga/search',
    detailsPath: 'manga/{id}',
    resultsPath: 'results',
    queryParameter: 'title',
    searchParameters: { language: 'en' },
    fields: {
      id: 'slug', title: 'name', synopsis: 'description', year: 'published', rating: 'score',
      ratingScale: 5, genres: 'tags', cover: 'image', externalUrl: 'url'
    }
  } ]));
  const module = await createJsonMetadataModule(definition);
  const requests: URL[] = [];
  const api = context(async (url) => {
    requests.push(url);
    return Response.json({ results: [{
      slug: 'winter-archive', name: 'Winter Archive', description: 'A metadata adapter fixture.',
      published: '2021-11-05', score: 4, tags: ['Drama', 'Slice of Life'],
      image: 'https://images.example/winter.jpg', url: 'https://catalog.example/manga/winter-archive'
    }] });
  });
  const animeModule = await createJsonMetadataModule({
    ...definition,
    id: 'catalog-anime',
    name: 'Another Verified Catalog',
    mediaType: 'anime',
    baseUrl: 'https://anime-catalog.example/v1',
    searchPath: 'anime/search',
    detailsPath: 'anime/{id}'
  });
  const registry = createRegistry([module, animeModule]);
  assert.deepEqual(registry.manifests().map((manifest) => manifest.id), ['catalog-manga', 'catalog-anime']);
  const [manga] = await module.search('Winter', api);
  assert.equal(manga.title, 'Winter Archive');
  assert.equal(manga.year, 2021);
  assert.equal(manga.rating, 8);
  assert.equal(manga.cover, 'https://images.example/winter.jpg');
  assert.equal(manga.sourceName, 'Verified Catalog');
  assert.equal((await module.getChapters(manga.id, api)).length, 0);
  assert.deepEqual(module.manifest.capabilities, ['search', 'details']);
  assert.equal(requests[0].origin, 'https://catalog.example');
  assert.equal(requests[0].pathname, '/v1/manga/search');
  assert.equal(requests[0].searchParams.get('title'), 'Winter');
  assert.equal(requests[0].searchParams.get('language'), 'en');
});

test('configured JSON metadata APIs require a parameterized detail path', () => {
  assert.throws(() => parseJsonMetadataProviders(JSON.stringify([{
    id: 'unconfigured-detail-path', name: 'Catalog', mediaType: 'anime',
    rightsReview: { basis: 'provider-terms', evidenceUrl: 'https://catalog.example/terms', reviewedAt: '2026-10-09' },
    baseUrl: 'https://catalog.example/v1', searchPath: 'search', detailsPath: 'details',
    fields: { id: 'id', title: 'title' }
  }])), /detailsPath/);
});

test('configured JSON metadata APIs require rights evidence', () => {
  assert.throws(() => parseJsonMetadataProviders(JSON.stringify([{
    id: 'unreviewed-catalog', name: 'Catalog', mediaType: 'anime',
    baseUrl: 'https://catalog.example/v1', searchPath: 'search', detailsPath: 'anime/{id}',
    fields: { id: 'id', title: 'title' }
  }])), /rightsReview/);
});

test('configured JSON provider key is sent only in its header and excluded from the manifest', async () => {
  const definition = {
    id: 'secured-anime-catalog', name: 'Secured Catalog', mediaType: 'anime',
    rightsReview: { basis: 'written-permission', evidenceUrl: 'https://secured-catalog.example/permission', reviewedAt: '2026-10-09' },
    baseUrl: 'https://secured-catalog.example/v1', searchPath: 'anime/search', detailsPath: 'anime/{id}',
    resultsPath: 'results', apiKeyHeader: 'X-Client-Key', fields: { id: 'id', title: 'title' }
  };
  const serialized = JSON.stringify([definition]);
  const [module] = await createJsonMetadataModules(serialized, JSON.stringify({ 'secured-anime-catalog': 'fixture-secret' }));
  const headers: Headers[] = [];
  const api = context(async (_url, init) => {
    headers.push(new Headers(init?.headers));
    return Response.json({ results: [{ id: 42, title: 'Fixture Anime' }] });
  });
  await module.search('fixture', api);
  assert.equal(headers[0].get('X-Client-Key'), 'fixture-secret');
  assert.equal(JSON.stringify(module.manifest).includes('fixture-secret'), false);
});

test('registry replaces provider IDs with persistent Wyllo identities across media flows', async () => {
  const [anime, manga] = fixtureModules();
  const identities = await createIdentityStore();
  const registry = createRegistry([anime, manga], {}, identities);
  const results = await registry.search('fixture');
  const animeRecord = results.find((item) => item.type === 'anime');
  const mangaRecord = results.find((item) => item.type === 'manga');
  assert.ok(animeRecord && mangaRecord);
  assert.notEqual(animeRecord.id, 'provider-anime-id');
  assert.notEqual(mangaRecord.id, 'provider-manga-id');
  const episode = (await registry.getEpisodes(animeRecord.id))[0];
  assert.notEqual(episode.id, 'provider-episode-id');
  assert.equal((await registry.getEpisode(episode.id))?.anime.id, animeRecord.id);
  assert.equal((await registry.getSources(episode.id))[0].url, 'https://media.example/film.mp4');
  const chapter = (await registry.getChapters(mangaRecord.id))[0];
  assert.notEqual(chapter.id, 'provider-chapter-id');
  const chapterContext = await registry.getChapter(chapter.id);
  assert.equal(chapterContext?.manga.id, mangaRecord.id);
  assert.equal(chapterContext?.chapter.id, chapter.id);
  assert.equal((await registry.getPages(chapter.id))[0].url, 'https://images.example/page.jpg');
  await identities.close();
});

test('production registry accepts a signed manga-only provider catalog', async () => {
  const manga = await createAniListMetadataModule('manga');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const signature = sign(null, Buffer.from(canonicalManifestPayload([manga.manifest])), privateKey).toString('base64');
  const registry = createRegistry([manga], {
    environment: 'production',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    signature
  });
  assert.deepEqual(registry.manifests().map((manifest) => manifest.id), ['anilist-manga-metadata']);
});