import { z } from 'zod';
import type { ComicSummary } from '@wyllo/domain';

const apiUrl = 'https://openlibrary.org/search.json';
const responseSchema = z.object({
  docs: z.array(z.unknown())
});
const comicSchema = z.object({
  key: z.string().regex(/^\/works\/OL\d+W$/),
  title: z.string().min(1).max(500),
  author_name: z.array(z.string().max(200)).optional(),
  first_publish_year: z.number().int().optional(),
  cover_i: z.number().int().positive().optional(),
  ebook_access: z.string().optional(),
  public_scan_b: z.boolean().optional()
});

const maxResponseBytes = 2_000_000;

export async function searchOpenLibraryComics(query: string, fetcher: typeof fetch = fetch): Promise<ComicSummary[]> {
  const url = new URL(apiUrl);
  url.searchParams.set('q', query.trim() ? `subject:comics ${query.trim()}` : 'subject:comics');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,ebook_access,public_scan_b');
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', '24');
  const response = await fetcher(url, {
    headers: { accept: 'application/json', 'user-agent': 'WylloPlayer/0.1 (comics catalog)' },
    signal: AbortSignal.timeout(5000),
    redirect: 'manual',
    credentials: 'omit'
  });
  if (!response.ok) throw new Error(`Open Library returned ${response.status}.`);
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxResponseBytes) throw new Error('Open Library response exceeded the size limit.');
  const text = await response.text();
  if (Buffer.byteLength(text) > maxResponseBytes) throw new Error('Open Library response exceeded the size limit.');
  const parsed = responseSchema.parse(JSON.parse(text));
  return parsed.docs.flatMap((record) => {
    const result = comicSchema.safeParse(record);
    if (!result.success) return [];
    const comic = result.data;
    const access = comic.public_scan_b || comic.ebook_access === 'public'
      ? 'public'
      : comic.ebook_access === 'borrowable' || comic.ebook_access === 'printdisabled' || comic.ebook_access === 'restricted' || comic.ebook_access === 'no_ebook'
        ? comic.ebook_access
        : 'unknown';
    const detailUrl = `https://openlibrary.org${comic.key}`;
    return [{
      id: comic.key.slice('/works/'.length),
      title: comic.title,
      authors: (comic.author_name ?? []).slice(0, 5),
      firstPublishYear: comic.first_publish_year,
      coverUrl: comic.cover_i ? `https://covers.openlibrary.org/b/id/${comic.cover_i}-M.jpg` : undefined,
      detailUrl,
      readUrl: access === 'public' ? detailUrl : undefined,
      access
    }];
  });
}