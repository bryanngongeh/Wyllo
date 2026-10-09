import { getJson } from '$lib/api';
import type { MediaSummary } from '@wyllo/domain';

export const load = async ({ fetch }: { fetch: typeof globalThis.fetch }) =>
	getJson<{ items: MediaSummary[]; total: number }>('/search', fetch);