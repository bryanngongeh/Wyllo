import { getJson } from '$lib/api';
import type { ComicSummary } from '@wyllo/domain';

export const load = async ({ fetch, url }: { fetch: typeof globalThis.fetch; url: URL }) => {
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  try {
    const result = await getJson<{ items: ComicSummary[] }>(`/comics?q=${encodeURIComponent(query)}`, fetch);
    return { query, items: result.items, unavailable: false };
  } catch {
    return { query, items: [], unavailable: true };
  }
};