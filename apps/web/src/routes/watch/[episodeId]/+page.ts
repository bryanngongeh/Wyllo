import { getJson } from '$lib/api';
import type { Episode, MediaSummary, VideoSource } from '@wyllo/domain';

export const load = async ({ params, fetch }: { params: { episodeId: string }; fetch: typeof globalThis.fetch }) => {
  const [content, sourceData] = await Promise.all([
    getJson<{ anime: MediaSummary; episode: Episode }>(`/episodes/${encodeURIComponent(params.episodeId)}`, fetch),
    getJson<{ sources: VideoSource[] }>(`/episodes/${encodeURIComponent(params.episodeId)}/sources`, fetch)
  ]);
  if (!sourceData.sources[0]) throw new Error('No authorized source is available for this archival film.');
  return { ...content, source: sourceData.sources[0] };
};