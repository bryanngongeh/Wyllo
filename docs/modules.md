# Wyllo Provider Modules

## Relationship to Synthetiq

The public Synthetiq Player is a privacy-first personal-media player. Its separate companion module catalog uses versioned manifests, explicit capabilities, SHA-256 artifact hashes, and signed catalogue metadata. Wyllo follows those distribution/integrity ideas, but retains its own TypeScript contracts and server-side provider boundary; it does not copy or execute the companion repository's modules.

## Contract

Each trusted module implements `AnimeModule` or `MangaModule` from `@wyllo/domain`. It returns Wyllo-owned normalized IDs and models, declares its media type/capabilities, semantic version, minimum API version, allowed HTTPS hosts, attribution, timeout/response limits, and SHA-256 entry digest.

The API registry validates manifests at startup and validates every response before returning it to the website. The website never receives provider-specific response shapes. Search results are deduplicated by Wyllo media ID. Anime modules may declare only `search` and `details` when they provide metadata but no authorized episode/video source; such modules must return no playable episodes or sources. Episode, source, chapter, and page lookups are delegated to the module contract rather than parsing provider IDs.

## Security Boundary

- Modules are trusted, reviewed code compiled with the API and registered in `apps/api/src/modules/installed.ts`.
- Never download/evaluate module JavaScript in the Fastify process. A future third-party catalog needs an isolated worker/container with restricted filesystem, process, CPU, memory, DNS, and network access.
- Module fetches must use the supplied runtime context, which enforces HTTPS, exact host allowlists, bounded timeouts/response size, GET/HEAD/POST methods, omitted credentials, and no redirects.
- The API validates module output with Zod and rejects URLs outside the declaring module's allowlist.
- Release manifests are canonicalized and verified with Ed25519. The private signing key belongs only in the release system; deploy only the public key and signature.
- Production rejects fixture modules and fails startup unless at least one installed provider is present and the exact manifest set has a valid release signature. A catalog may contain only anime or only manga modules.
- Provider credentials must stay server-side. Never bypass DRM, paywalls, authentication barriers, or source access controls.

## Registering a Provider

1. Obtain the provider's public API contract and verify Wyllo is authorized to use it.
2. Implement the appropriate interface in `apps/api/src/modules/` and normalize data into the shared domain models.
3. Declare only required HTTPS hosts/capabilities and set realistic timeout/response limits.
4. Register the trusted module in `loadInstalledModules`; development demo adapters must remain excluded in production.
5. Add fixture tests for normalization, errors, bounds, and host restrictions. Do not include copyrighted payloads in fixtures.
6. Build the exact release artifact, hash its entry, canonicalize the manifest set, and sign it with the release Ed25519 key. Test signature rejection after any artifact/manifest change.
7. Deploy the public key/signature and provider credentials through a secret manager; verify API readiness before routing traffic.

The built-in `anilist-anime-metadata` and `anilist-manga-metadata` modules use AniList's official GraphQL API for search, trending results, and title details. They declare only `search` and `details`; they do not provide playable episodes or manga pages. When `ENABLE_JIKAN_METADATA=true` and a written-permission review record is configured, the Jikan v4 preset replaces AniList for anime; AniList remains the manga catalog. Jikan scrapes MyAnimeList, and its use terms were not verified, so do not enable it until written permission covering Wyllo's use is obtained. Consumet documents similar catalog and media endpoints, but its public API host redirects to the project repository, so it is not a working runtime dependency. MAL's documented v2 API remains opt-in via `MAL_CLIENT_ID`. Other JSON metadata APIs must include a `rightsReview` record in `METADATA_PROVIDERS_JSON`. All installed modules are trusted code running in the API process; none is an isolated third-party sandbox. Review [PROVIDER.md](../PROVIDER.md) for source URLs, mappings, and authorization caveats.

The comics catalog uses a separate API route and Open Library's documented search response fields. It maps work key, title, authors, year, cover ID, and ebook access status to a comics-only domain type. Reader links are external and only exposed when Open Library reports public access; this does not embed or redistribute scanned pages.

Additional read-only JSON metadata APIs may be configured using `METADATA_PROVIDERS_JSON`, with optional server-only credentials in `METADATA_API_KEYS_JSON`; see [PROVIDER.md](../PROVIDER.md) for the supported mapping fields. Configure only source URLs and hosts verified from provider documentation, and use only APIs/data Wyllo is authorized to access. The generic adapter does not scrape HTML and does not implement chapter pages or video playback.