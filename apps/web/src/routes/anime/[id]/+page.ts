import { getJson } from '$lib/api';
import type { Episode, MediaSummary } from '@wyllo/domain';

export const load = async ({ params, fetch }: { params: { id: string }; fetch: typeof globalThis.fetch }) =>
  getJson<{ anime: MediaSummary; episodes: Episode[] }>(`/anime/${encodeURIComponent(params.id)}`, fetch);