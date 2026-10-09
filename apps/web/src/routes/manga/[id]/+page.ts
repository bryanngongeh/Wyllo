import { getJson } from '$lib/api';
import type { Chapter, MediaSummary } from '@wyllo/domain';

export const load = async ({ params, fetch }: { params: { id: string }; fetch: typeof globalThis.fetch }) =>
  getJson<{ manga: MediaSummary; chapters: Chapter[] }>(`/manga/${encodeURIComponent(params.id)}`, fetch);