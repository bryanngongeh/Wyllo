import type { AnimeModule, MangaModule } from '@wyllo/domain';
import { createAniListMetadataModule } from './anilist-metadata.js';
import { createJsonMetadataModule, createJsonMetadataModules, parseJsonMetadataRightsReview } from './json-metadata-api.js';
import { createJikanAnimeMetadataProvider } from './jikan-anime-metadata.js';

export async function loadInstalledModules(malClientId?: string, metadataProvidersJson?: string, metadataApiKeysJson?: string, enableJikanMetadata = false, jikanRightsReviewJson?: string): Promise<Array<AnimeModule | MangaModule>> {
  const modules: Array<AnimeModule | MangaModule> = [await createAniListMetadataModule('manga')];
  if (malClientId) modules.push(await import('./mal-anime-metadata.js').then((module) => module.createMalAnimeModule(malClientId)));
  if (enableJikanMetadata) {
    if (!jikanRightsReviewJson) throw new Error('JIKAN_RIGHTS_REVIEW_JSON is required to enable Jikan metadata.');
    modules.push(await createJsonMetadataModule(createJikanAnimeMetadataProvider(parseJsonMetadataRightsReview(jikanRightsReviewJson))));
  } else modules.push(await createAniListMetadataModule('anime'));
  modules.push(...await createJsonMetadataModules(metadataProvidersJson, metadataApiKeysJson));
  return modules;
}