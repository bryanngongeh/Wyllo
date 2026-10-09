export type MediaType = 'anime' | 'manga';

export interface ComicSummary {
  id: string;
  title: string;
  authors: string[];
  firstPublishYear?: number;
  coverUrl?: string;
  detailUrl: string;
  readUrl?: string;
  access: 'public' | 'borrowable' | 'printdisabled' | 'restricted' | 'no_ebook' | 'unknown';
}

export interface MediaSummary {
  id: string;
  providerRef?: string;
  type: MediaType;
  contentKind?: 'film' | 'series' | 'collection' | 'one-shot';
  title: string;
  originalTitle: string;
  synopsis: string;
  year: number | null;
  rating: number;
  genres: string[];
  cover?: string;
  backdrop?: string;
  accent: string;
  status: string;
  label: string;
  externalUrl?: string;
  sourceName?: string;
  sourceLicense?: string;
  sourceAttribution?: string;
  episodeCount?: number;
  chapterCount?: number;
}

export interface Episode {
  id: string;
  providerRef?: string;
  animeId: string;
  number: number;
  title: string;
  duration: number;
}

export interface Chapter {
  id: string;
  providerRef?: string;
  mangaId: string;
  number: number;
  title: string;
  pages: number;
}

export interface PageImage {
  number: number;
  url: string;
  sourceUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  attribution?: string;
}

export interface VideoSource {
  id: string;
  label: string;
  language: string;
  subtitles: boolean;
  resolution: string;
  url: string;
  externalUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  attribution?: string;
}

export type ModuleCapability =
  | 'search'
  | 'details'
  | 'episodes'
  | 'sources'
  | 'chapters'
  | 'pages';

export interface ModuleManifest {
  schemaVersion: 1;
  contractVersion: 1;
  id: string;
  version: string;
  mediaType: MediaType;
  minimumAppVersion: string;
  capabilities: ModuleCapability[];
  allowedHosts: string[];
  runtime: {
    timeoutMs: number;
    maxResponseBytes: number;
  };
  attribution: string;
  integrity: {
    algorithm: 'sha256';
    entrySha256: string;
  };
}

export interface ModuleRuntimeContext {
  signal: AbortSignal;
  identities: ContentIdentityStore;
  fetch(url: string | URL, init?: RequestInit): Promise<Response>;
}

export type ReferenceEntity = 'media' | 'episode' | 'chapter';

export interface ProviderReference {
  moduleId: string;
  entity: ReferenceEntity;
  mediaType: MediaType;
  providerRef: string;
  parentProviderRef?: string;
}

export interface ContentIdentityStore {
  getWylloId(reference: ProviderReference): Promise<string>;
  getProviderReference(wylloId: string, entity: ReferenceEntity): Promise<ProviderReference | undefined>;
  check(): Promise<void>;
  close(): Promise<void>;
}

export interface AnimeModule {
  manifest: ModuleManifest & { mediaType: 'anime' };
  search(query: string, context: ModuleRuntimeContext): Promise<MediaSummary[]>;
  getDetails(id: string, context: ModuleRuntimeContext): Promise<MediaSummary | undefined>;
  getEpisodes(id: string, context: ModuleRuntimeContext): Promise<Episode[]>;
  getEpisode(episodeId: string, context: ModuleRuntimeContext): Promise<Episode | undefined>;
  getSources(episodeId: string, context: ModuleRuntimeContext): Promise<VideoSource[]>;
}

export interface MangaModule {
  manifest: ModuleManifest & { mediaType: 'manga' };
  search(query: string, context: ModuleRuntimeContext): Promise<MediaSummary[]>;
  getDetails(id: string, context: ModuleRuntimeContext): Promise<MediaSummary | undefined>;
  getChapters(id: string, context: ModuleRuntimeContext): Promise<Chapter[]>;
  getPages(chapterId: string, context: ModuleRuntimeContext): Promise<PageImage[]>;
}