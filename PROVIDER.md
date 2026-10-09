# Provider Analysis: AniList

## Provider

- **Name:** AniList
- **API endpoint:** `https://graphql.anilist.co`
- **API documentation:** [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs/)
- **Modules:** `anilist-anime-metadata` and `anilist-manga-metadata`
- **Content type:** Anime and manga catalog metadata; no video or page images

## Provider Interface

- **Authentication:** Public GraphQL requests; no API key is configured.
- **Search and browse:** `POST /` with `Page.media`, `type`, `search`, and sort. Empty search uses `TRENDING_DESC`; a query uses `SEARCH_MATCH`.
- **Details:** `POST /` with `Media(id, type)`.
- **Response fields:** `id`, `title`, `description`, `startDate.year`, `averageScore`, `genres`, `coverImage`, `siteUrl`, `episodes`, `chapters`, `format`, and `status`.
- **Wyllo mapping:** Average score is converted from AniList's 0-100 scale to Wyllo's 0-10 scale. Episode/chapter counts are informational only. The adapters declare only `search` and `details` and return no episodes, sources, chapters, or pages.
- **Manifest hosts:** `graphql.anilist.co`, `s4.anilist.co`, and `anilist.co`.
- **Live verification:** Both anime and manga GraphQL requests returned HTTP 200 during integration checks. Fixture tests cover normalization and unsupported media operations.

## Consumet Documentation Review

Consumet documents catalog, episode-stream, manga-chapter, and page routes at [docs.consumet.org](https://docs.consumet.org/). Its examples use `https://api.consumet.org`, but live requests to that host currently redirect to the Consumet GitHub repository rather than returning API data. Wyllo therefore uses AniList's official GraphQL API for catalog metadata instead of depending on the unavailable public Consumet host.

Consumet's HiAnime stream and MangaDex page endpoints return externally hosted media URLs. Wyllo does not register those operations: the documentation does not establish distribution rights for the returned titles, and the adapters do not verify per-title authorization. Configure episode or chapter-page providers only when their licenses/terms explicitly authorize this app's use.

## Authorization and Limitations

AniList metadata is displayed with source attribution and a link to the title's AniList page. Confirm that the intended production use complies with AniList's current terms. AniList metadata does not grant rights to stream anime or redistribute manga pages. The title counts do not imply that playable episodes or readable chapters are available in Wyllo.

---

---

# Provider Analysis: MyAnimeList

## Provider

- **Name:** MyAnimeList (MAL)
- **Verified API base URL:** `https://api.myanimelist.net/v2`
- **Official API documentation:** [MyAnimeList API v2 references](https://myanimelist.net/apiconfig/references/api/v2)
- **Module:** `myanimelist-anime-metadata`
- **Content type:** Anime title metadata only; no episodes or playable media

## Provider Interface

- **Authentication:** The official API docs permit the `X-MAL-CLIENT-ID` header for requests that do not require user login. Wyllo reads the optional `MAL_CLIENT_ID` setting and passes it to the module; the module does not read process environment variables.
- **Search endpoint:** `GET https://api.myanimelist.net/v2/anime?q={query}&limit=20&fields=...`.
- **Browse endpoint:** `GET https://api.myanimelist.net/v2/anime/ranking?ranking_type=all&limit=20&fields=...` when the search query is empty.
- **Details endpoint:** `GET https://api.myanimelist.net/v2/anime/{anime_id}?fields=...`.
- **Episodes endpoint:** Not used. The API metadata's `num_episodes` is displayed as a reported count only; it is not an episode list.
- **Media endpoint:** None. MAL API does not provide playable streams to this module.
- **Response format:** JSON list uses `{ data: [{ node: ... }] }`; detail endpoint returns an anime object. Fields used are `id`, `title`, `main_picture`, `alternative_titles`, `synopsis`, `start_date`, `mean`, `genres`, `num_episodes`, `media_type`, and `status`.
- **Browser bridge:** Not required; direct HTTP via `context.fetch` is sufficient.
- **Live verification status:** API host, endpoint forms, API key header, and response shapes are documented by MAL. Live response behavior is fixture-tested; no live request was run because `MAL_CLIENT_ID` is not configured.

## Authorization and Limitations

The user authorized Wyllo to proceed with this integration. MAL's current [Terms of Use](https://myanimelist.net/about/terms_of_use) also describe a personal, noncommercial service license and restrict aggregation of service content for use elsewhere; the public API reference does not itself clarify a separate reuse grant. **Confirm that the authorization the user has covers third-party display/aggregation before production use.**

This module is metadata-only. MAL is not a video provider and this integration must not be presented as granting anime playback rights. The UI links to MAL's title page and does not create episode rows or stream URLs.

## Wyllo Mapping

| MAL operation/data | Wyllo handler | Behavior |
| --- | --- | --- |
| `GET /v2/anime` | `search` | Normalizes MAL search results to Wyllo anime summaries. |
| `GET /v2/anime/ranking` | `search` with empty query | Provides a documented metadata browse list. |
| `GET /v2/anime/{anime_id}` | `getDetails` | Normalizes one metadata record and links to its MAL title page. |
| `num_episodes` | `MediaSummary.episodeCount` | Informational count only; does not populate playable Wyllo episodes. |
| Episode/stream handlers | `getEpisodes`, `getEpisode`, `getSources` | Return no playable data. |

The MAL adapter is registered only when `MAL_CLIENT_ID` is set. AniList anime and manga metadata modules are registered by default, whether or not MAL is configured.

---

# Provider Analysis: Jikan

## Provider

- **Name:** Jikan (unofficial MyAnimeList API)
- **Verified API base URL:** `https://api.jikan.moe/v4`
- **OpenAPI specification:** [Jikan REST API OpenAPI](https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json)
- **Module preset:** `jikan-anime-metadata`
- **Content type:** Anime metadata only

## Verified Operations

- `GET /anime?q={query}&limit=20&sfw=true` returns `{ data: [...] }`.
- `GET /anime/{id}/full` returns `{ data: ... }`.
- The preset maps `mal_id`, `title`, `title_japanese`, `synopsis`, `year`, `score`, `genres[].name`, `url`, `status`, and `episodes`.
- The official Jikan docs state a limit of 3 requests/second and 60/minute; preset requests are spaced by at least 350 ms.
- Search is filtered with `sfw=true`. Jikan's response image host is not configured until its exact URL is verified, so Wyllo renders the metadata fallback rather than inventing a CDN allowlist.
- Jikan documents `GET /anime/{id}/episodes`, but this preset intentionally does not create playable episode records. Jikan does not supply video streams.

## Authorization Caveat

Jikan says it is an unofficial API that scrapes MyAnimeList. Its official docs link to `https://jikan.moe/terms`, which returned 404 during verification. **UNKNOWN / REQUIRES VERIFICATION:** whether the current Jikan/MAL terms permit Wyllo to display or aggregate this metadata. The preset remains disabled by default; do not enable it until written permission covering this use is confirmed.

Set `ENABLE_JIKAN_METADATA=true` only after obtaining written permission that covers Wyllo's use and adding its evidence URL/date to `JIKAN_RIGHTS_REVIEW_JSON`. The API refuses to load Jikan if the declared review basis is not `written-permission`. When enabled, Jikan replaces AniList for anime; AniList manga remains registered. Jikan requires no API key. The module is metadata-only and does not grant rights to stream anime or display full video. Live Jikan requests timed out from the current environment during this switch, so runtime availability remains unverified here.

---

# Configurable JSON Metadata APIs

Wyllo can register multiple metadata-only JSON API adapters through `METADATA_PROVIDERS_JSON`. Each array entry describes one provider; there is no default or guessed provider URL. Obtain the exact URL, paths, response contract, API key requirements, and permitted use from the provider's official documentation or written authorization before adding an entry.

Each entry supports:

- `id`, `name`, and `mediaType` (`anime` or `manga`)
- Required `rightsReview`: `basis` (`public-domain`, `open-license`, `provider-terms`, or `written-permission`), an `evidenceUrl`, and `reviewedAt` date. This is an operator audit record, not legal validation by the application.
- `baseUrl`, which must be the verified HTTPS API base
- `allowedHosts`, exact additional HTTPS hosts needed for returned images or source links
- `searchPath`, `detailsPath` (must contain `{id}`), optional `resultsPath` and `detailResultPath`
- `queryParameter` for the user's search text, plus optional fixed `searchParameters` and `detailsParameters`
- `fields` mappings for `id`, `title`, and optional `originalTitle`, `synopsis`, `year`, `rating`, `ratingScale`, `genres`, `genreName`, `cover`, `backdrop`, `externalUrl`, `status`, `contentKind`, `episodeCount`, and `chapterCount`
- Optional `apiKeyHeader` and `apiKeyPrefix`; the key value is supplied separately in `METADATA_API_KEYS_JSON`, keyed by the provider `id`. Never put credentials in `METADATA_PROVIDERS_JSON`, source code, or a client bundle.
- Optional `minimumRequestIntervalMs` to space requests to a provider's published rate limit.
- Optional `timeoutMs` and `maxResponseBytes`

The adapter makes GET requests only, supports top-level JSON arrays or configured array/object response paths, maps configured JSON field paths into Wyllo's normalized metadata model, and declares only `search` and `details`. It never creates chapter/page records or playable episodes/streams. Returned URLs are checked against the provider's exact host allowlist. The module integrity hash includes the normalized provider definition, so the exact metadata config must be present when signing the production manifest set.

This is not an arbitrary web scraper: it does not parse HTML, run JavaScript, follow redirects, use browser bridges, or bypass anti-bot/access controls. A provider that only exposes HTML needs a separately reviewed adapter and explicit permission for that access pattern. Metadata API access alone is not a license to redistribute underlying anime or manga media.

Set `METADATA_PROVIDERS_JSON` and `METADATA_API_KEYS_JSON` in the API environment (for local Compose, in the ignored `.env` file). Keep their provider URLs and paths sourced from the provider's documentation. Configure secrets in a secret manager in production; the example env files leave both values blank intentionally because Wyllo has no additional verified JSON API provider configured.

---

# Comics Catalog: Open Library

## Provider Interface

- **API:** `GET https://openlibrary.org/search.json`
- **Search query:** `q=subject:comics` with the requested title appended for text searches.
- **Requested fields:** `key`, `title`, `author_name`, `first_publish_year`, `cover_i`, `ebook_access`, and `public_scan_b`.
- **Cover images:** `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg`.
- **Source record:** `https://openlibrary.org/works/{workId}`.
- **Access handling:** Wyllo exposes an external reader link only when `ebook_access` is `public` or `public_scan_b` is true. `borrowable`, `printdisabled`, and other statuses do not become Wyllo-readable pages.
- **Wyllo behavior:** `/api/v1/comics` returns metadata records. Reading stays on Open Library; Wyllo does not fetch or embed comic page images.
- **Limits:** Requests time out after five seconds and responses are bounded to 2 MB. Search is limited to 24 results.

Open Library's public search endpoint could not be reached from the current development environment during verification, so the mapping is fixture-tested but live catalog results remain unverified. Check connectivity and the current [Open Library Search API](https://openlibrary.org/dev/docs/api/search) documentation before deployment.

## Consumet Comics Review

Consumet's [GetComics search documentation](https://docs.consumet.org/rest-api/Comics/getcomics/search) describes `comicTitle` and `page` query parameters, returning `id`, `title`, `image`, and `url`. The adjacent info page does not currently define a response schema or chapter/reader routes. Requests to the documented `https://api.consumet.org/comics/getcomics` host redirect to the Consumet GitHub repository. Wyllo therefore does not rely on that runtime or present its metadata as a license to read the listed comics.

## Anime Playback and Manga Reading

The default AniList modules provide metadata only. Consumet's documented HiAnime stream and MangaDex chapter-page responses contain external media URLs, but their docs do not grant Wyllo rights to stream or redistribute those titles. Those endpoints are not registered. Provide an authorized provider API contract before enabling in-app anime playback or manga page rendering.