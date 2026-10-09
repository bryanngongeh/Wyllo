import { getJson } from '$lib/api';
import type { MediaSummary, MediaType } from '@wyllo/domain';

export const load = async ({ url, fetch }: { url: URL; fetch: typeof globalThis.fetch }) => {
  const query = url.searchParams.get('q')?.trim() ?? '';
  const requestedType = url.searchParams.get('type');
  const type: MediaType | undefined = requestedType === 'anime' || requestedType === 'manga' ? requestedType : undefined;
  const params = new URLSearchParams({ q: query });
  if (type) params.set('type', type);
  return { query, type, ...(await getJson<{ items: MediaSummary[]; total: number; allTotal: number }>(`/search?${params}`, fetch)) };
};