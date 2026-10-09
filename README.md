# Wyllo Player

A responsive open-content manga reader with a SvelteKit BFF, Fastify API, normalized TypeScript contracts, versioned trusted provider adapters, PostgreSQL user data, Redis metadata caching, and Auth0 authorization.

## Run locally

Requirements: Node.js 20 or newer and npm for local development. Production containers and CI use Node.js 22.

```sh
npm install
npm run dev
```

Open <http://localhost:5173>. SvelteKit serves the website and same-origin `/api/v1` proxy; Fastify runs on port `4174`. Without `DATABASE_URL` or `REDIS_URL`, the API uses development-only in-memory stores. Auth0 remains disabled until its `VITE_AUTH0_*` settings are supplied.

Set `API_PORT` to change the API port. Browser and SSR calls use a same-origin `/api/v1` proxy; set the private `API_INTERNAL_URL` for the SvelteKit server when the API is not at `http://localhost:4174` (Docker Compose uses `http://api:4174`).

For Postgres/Redis-backed local development, copy `.env.example` to `.env` and run:

```sh
docker compose up --build
```

The local stack is available at <http://localhost:3000>; it publishes Postgres and Redis on loopback for local tools. Example credentials are for local use only. Override `WEB_HOST_PORT`, `API_HOST_PORT`, `POSTGRES_PORT`, or `REDIS_PORT` if those ports are occupied.

## Catalog Providers

- **AniList anime** provides default search, trending results, and details. When Jikan is enabled with its required rights-review record, it replaces AniList for anime.
- **AniList manga** provides default manga search, trending results, and details.
- **Open Library** provides comics catalog search and links to Open Library records/readers when public access is reported.
- **MyAnimeList** remains an opt-in metadata provider.

AniList, Jikan, and Open Library integrations provide catalog metadata only. Enable Jikan with `ENABLE_JIKAN_METADATA=true` and a valid `JIKAN_RIGHTS_REVIEW_JSON` only after written permission covering Wyllo's use is confirmed. Comic reader links open on Open Library; Wyllo does not embed comic pages. Anime playback and manga chapter pages remain unavailable until authorized media providers are configured. The public Consumet REST host currently redirects to its GitHub repository, so Wyllo does not depend on it. See [PROVIDER.md](PROVIDER.md) for endpoint and licensing caveats. Wyllo does not scrape arbitrary HTML pages or bypass access controls.

## Production Compose

Use `compose.production.yaml` with `compose.yaml`. Set strong URL-encoded database/Redis passwords, exact HTTPS `CORS_ORIGINS`, Auth0 tenant/API values, and a verified module catalogue public key/signature in the deployment environment. The production override does not expose Postgres, Redis, or the API on host ports; place a TLS reverse proxy in front of the web port.

Production refuses to start unless the trusted provider manifests are signed and Auth0/Postgres/Redis configuration is present. A signed catalog may contain only the provider types that are actually available; anime playback remains unavailable until an authorized source is registered.

## Validation

```sh
npm run check
npm test
npm run build
npm audit
```

The API tests cover AniList anime/manga normalization, Open Library comics mapping and access links, metadata-only capabilities, module manifests/signatures/host policy, UUID identity mapping, signed single-type production catalogs, Auth0 scope enforcement, and production configuration.

## Module Architecture

See [docs/modules.md](docs/modules.md) for adapter authoring, versioning, integrity/signature policy, host restrictions, and release flow. [PROVIDER.md](PROVIDER.md) records the verified catalog provider interfaces and their authorization/operations caveats. Wyllo uses trusted code modules registered by the server; it does not execute downloaded JavaScript in the Fastify process. Untrusted or third-party code requires an isolated worker sandbox before it can be supported.

## Remaining Go-Live Inputs

- An authorized anime video provider, if in-app anime playback is required.
- Confirmation that AniList metadata display is covered by the intended production use.
- Confirmed Open Library access from the deployment environment if the comics section is enabled there.
- Authorized anime and manga media provider contracts, if in-app playback or reading is required.
- Auth0 tenant, SPA client, API audience, callback/logout URLs, and configured permissions.
- Production Postgres/Redis endpoints, secrets, backups, monitoring, and a TLS reverse proxy.
- Production signing key and module signature, supplied through a secret manager.