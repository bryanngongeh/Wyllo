import type { JsonMetadataProviderDefinition, JsonMetadataRightsReview } from './json-metadata-api.js';

export function createJikanAnimeMetadataProvider(rightsReview: JsonMetadataRightsReview): JsonMetadataProviderDefinition {
  if (rightsReview.basis !== 'written-permission') {
    throw new Error('Jikan metadata requires written permission evidence because its terms could not be verified.');
  }
  return {
  id: 'jikan-anime-metadata',
  name: 'Jikan',
  mediaType: 'anime',
  baseUrl: 'https://api.jikan.moe/v4',
  allowedHosts: ['myanimelist.net'],
  searchPath: 'anime',
  detailsPath: 'anime/{id}/full',
  resultsPath: 'data',
  detailResultPath: 'data',
  queryParameter: 'q',
  searchParameters: { limit: '20', sfw: 'true' },
  minimumRequestIntervalMs: 350,
  fields: {
    id: 'mal_id',
    title: 'title',
    originalTitle: 'title_japanese',
    synopsis: 'synopsis',
    year: 'year',
    rating: 'score',
    ratingScale: 10,
    genres: 'genres',
    genreName: 'name',
    externalUrl: 'url',
    status: 'status',
    episodeCount: 'episodes'
  },
  timeoutMs: 12_000,
  maxResponseBytes: 2_000_000
  ,rightsReview
  };
}