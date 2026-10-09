import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AnimeModule, MangaModule, MediaSummary, MediaType, ModuleCapability, ModuleRuntimeContext } from '@wyllo/domain';

const apiUrl = 'https://graphql.anilist.co';
const titleSchema = z.object({
  romaji: z.string().nullish(),
  english: z.string().nullish(),
  native: z.string().nullish()
});
const mediaSchema = z.object({
  id: z.number().int().positive(),
  title: titleSchema,
  description: z.string().nullish(),
  startDate: z.object({ year: z.number().int().nullish() }).nullish(),
  averageScore: z.number().min(0).max(100).nullish(),
  genres: z.array(z.string()).nullish(),
  coverImage: z.object({ extraLarge: z.string().url().nullish(), large: z.string().url().nullish() }).nullish(),
  siteUrl: z.string().url().nullish(),
  episodes: z.number().int().nonnegative().nullish(),
  chapters: z.number().int().nonnegative().nullish(),
  format: z.string().nullish(),
  status: z.string().nullish()
});
const searchResponseSchema = z.object({ data: z.object({ Page: z.object({ media: z.array(mediaSchema) }) }) });
const detailsResponseSchema = z.object({ data: z.object({ Media: mediaSchema.nullish() }) });

const fields = `id format status startDate { year } episodes chapters averageScore genres description(asHtml: false) siteUrl title { romaji english native } coverImage { extraLarge large }`;

function normalize(record: z.infer<typeof mediaSchema>, mediaType: MediaType): MediaSummary {
  const title = record.title.english || record.title.romaji || record.title.native || `AniList ${mediaType} ${record.id}`;
  const originalTitle = record.title.native || record.title.romaji || title;
  const description = (record.description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    id: String(record.id),
    type: mediaType,
    contentKind: mediaType === 'anime'
      ? record.format === 'MOVIE' ? 'film' : 'series'
      : record.format === 'ONE_SHOT' ? 'one-shot' : 'series',
    title,
    originalTitle,
    synopsis: description,
    year: record.startDate?.year && record.startDate.year >= 1800 && record.startDate.year <= 2200 ? record.startDate.year : null,
    rating: (record.averageScore ?? 0) / 10,
    genres: (record.genres ?? []).slice(0, 40),
    cover: record.coverImage?.extraLarge || record.coverImage?.large || undefined,
    accent: '#526b73',
    status: record.status?.replaceAll('_', ' ') ?? 'Status not listed',
    label: `ANILIST · ${mediaType.toLocaleUpperCase()} METADATA`,
    externalUrl: record.siteUrl ?? `https://anilist.co/${mediaType}/${record.id}`,
    sourceName: 'AniList',
    episodeCount: mediaType === 'anime' && record.episodes ? record.episodes : undefined,
    chapterCount: mediaType === 'manga' && record.chapters ? record.chapters : undefined
  };
}

async function request<T>(context: ModuleRuntimeContext, query: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const response = await context.fetch(new URL(apiUrl), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error(`AniList API returned ${response.status}.`);
  return schema.parse(await response.json());
}

export async function createAniListMetadataModule(mediaType: MediaType): Promise<AnimeModule | MangaModule> {
  const entrySha256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  const type = mediaType.toLocaleUpperCase();
  const manifest = {
    schemaVersion: 1 as const,
    contractVersion: 1 as const,
    id: `anilist-${mediaType}-metadata`,
    version: '1.0.0',
    mediaType,
    minimumAppVersion: '0.1.0',
    capabilities: ['search', 'details'] as ModuleCapability[],
    allowedHosts: ['graphql.anilist.co', 's4.anilist.co', 'anilist.co'],
    runtime: { timeoutMs: 10_000, maxResponseBytes: 2_000_000 },
    attribution: `Catalog metadata from AniList for ${mediaType}. No media files are provided.`,
    integrity: { algorithm: 'sha256' as const, entrySha256 }
  };
  const search = async (query: string, context: ModuleRuntimeContext): Promise<MediaSummary[]> => {
    const graphQuery = `query ($type: MediaType!, $sort: [MediaSort!]!, $search: String) { Page(page: 1, perPage: 20) { media(type: $type, sort: $sort, search: $search) { ${fields} } } }`;
    const result = await request(context, graphQuery, {
      type,
      sort: [query.trim() ? 'SEARCH_MATCH' : 'TRENDING_DESC'],
      search: query.trim() || undefined
    }, searchResponseSchema);
    return result.data.Page.media.map((record) => normalize(record, mediaType));
  };
  const getDetails = async (id: string, context: ModuleRuntimeContext): Promise<MediaSummary | undefined> => {
    if (!/^\d+$/.test(id)) return undefined;
    const graphQuery = `query ($id: Int!, $type: MediaType!) { Media(id: $id, type: $type) { ${fields} } }`;
    const result = await request(context, graphQuery, { id: Number(id), type }, detailsResponseSchema);
    return result.data.Media ? normalize(result.data.Media, mediaType) : undefined;
  };

  if (mediaType === 'anime') {
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