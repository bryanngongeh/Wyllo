import { getJson } from '$lib/api';
import type { Chapter, MediaSummary, PageImage } from '@wyllo/domain';

export const load = async ({ params, fetch }: { params: { chapterId: string }; fetch: typeof globalThis.fetch }) => {
  const [chapterData, pageData] = await Promise.all([
    getJson<{ manga: MediaSummary; chapter: Chapter; chapters: Chapter[] }>(`/chapters/${encodeURIComponent(params.chapterId)}`, fetch),
    getJson<{ pages: PageImage[] }>(`/chapters/${encodeURIComponent(params.chapterId)}/pages`, fetch)
  ]);
  return { ...chapterData, pages: pageData.pages };
};