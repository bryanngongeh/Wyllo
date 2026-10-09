import { getJson } from '$lib/api';
import type { MediaSummary } from '@wyllo/domain';

export const load = async ({ fetch }: { fetch: typeof globalThis.fetch }) =>
  getJson<{ featured: MediaSummary | null; anime: MediaSummary[]; manga: MediaSummary[] }>('/home', fetch);