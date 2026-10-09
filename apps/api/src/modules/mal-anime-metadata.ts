import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AnimeModule, MediaSummary, ModuleRuntimeContext } from '@wyllo/domain';

const moduleId = 'myanimelist-anime-metadata';
const apiBaseUrl = 'https://api.myanimelist.net/v2';
const fields = 'alternative_titles,synopsis,start_date,mean,genres,num_episodes,media_type,status';

const animeRecordSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  alternative_titles: z.object({ ja: z.string().optional() }).optional(),
  synopsis: z.string().optional(),
  start_date: z.string().optional(),
  mean: z.number().min(0).max(10).nullable().optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  num_episodes: z.number().int().nonnegative().nullable().optional(),
  media_type: z.string().optional(),
  status: z.string().optional()
});

const animeListSchema = z.object({ data: z.array(z.unknown()) });

function yearFromDate(date?: string): number | null {
  const match = /^(\d{4})(?:-|$)/.exec(date ?? '');
  return match ? Number(match[1]) : null;
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'currently_airing': return 'Currently airing';
    case 'finished_airing': return 'Finished airing';
    case 'not_yet_aired': return 'Not yet aired';
    default: return 'Status not listed';
  }
}

function normalize(record: z.infer<typeof animeRecordSchema>): MediaSummary {
  const mediaUrl = `https://myanimelist.net/anime/${record.id}`;
  return {
    id: String(record.id),
    type: 'anime',
    contentKind: record.media_type === 'movie' ? 'film' : 'series',
    title: record.title,
    originalTitle: record.alternative_titles?.ja || record.title,
    synopsis: record.synopsis ?? '',
    year: yearFromDate(record.start_date),
    rating: record.mean ?? 0,
    genres: (record.genres ?? []).map((genre) => genre.name).slice(0, 40),
    accent: '#526b73',
    status: statusLabel(record.status),
    label: 'MYANIMELIST · METADATA',
    externalUrl: mediaUrl,
    sourceName: 'MyAnimeList',
    episodeCount: record.num_episodes && record.num_episodes > 0 ? record.num_episodes : undefined
  };
}

async function fetchJson(context: ModuleRuntimeContext, url: URL, clientId: string): Promise<unknown> {
  const response = await context.fetch(url, {
    headers: { accept: 'application/json', 'X-MAL-CLIENT-ID': clientId }
  });
  if (!response.ok) throw new Error(`MyAnimeList API returned ${response.status}.`);
  return response.json() as Promise<unknown>;
}

function parseListResponse(value: unknown): z.infer<typeof animeRecordSchema>[] {
  const rows = animeListSchema.parse(value).data;
  return rows.map((row) => {
    const candidate = typeof row === 'object' && row !== null && 'node' in row
      ? (row as { node: unknown }).node
      : row;
    return animeRecordSchema.parse(candidate);
  });
}

export async function createMalAnimeModule(clientId: string): Promise<AnimeModule> {
  const entrySha256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  return {
    manifest: {
      schemaVersion: 1,
      contractVersion: 1,
      id: moduleId,
      version: '1.0.0',
      mediaType: 'anime',
      minimumAppVersion: '0.1.0',
      capabilities: ['search', 'details'],
      allowedHosts: ['api.myanimelist.net', 'myanimelist.net'],
      runtime: { timeoutMs: 8000, maxResponseBytes: 2_000_000 },
      attribution: 'Anime metadata from the official MyAnimeList API. No video streams are provided.',
      integrity: { algorithm: 'sha256', entrySha256 }
    },
    async search(query, context) {
      const url = new URL(query.trim() ? `${apiBaseUrl}/anime` : `${apiBaseUrl}/anime/ranking`);
      if (query.trim()) url.searchParams.set('q', query.trim());
      else url.searchParams.set('ranking_type', 'all');
      url.searchParams.set('limit', '20');
      url.searchParams.set('fields', fields);
      return parseListResponse(await fetchJson(context, url, clientId)).map(normalize);
    },
    async getDetails(id, context) {
      if (!/^\d+$/.test(id)) return undefined;
      const url = new URL(`${apiBaseUrl}/anime/${id}`);
      url.searchParams.set('fields', fields);
      const record = animeRecordSchema.parse(await fetchJson(context, url, clientId));
      return normalize(record);
    },
    async getEpisodes() { return []; },
    async getEpisode() { return undefined; },
    async getSources() { return []; }
  };
}