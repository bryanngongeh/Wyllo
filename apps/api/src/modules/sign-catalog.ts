import { sign } from 'node:crypto';
import { loadInstalledModules } from './installed.js';
import { canonicalManifestPayload } from './registry.js';

const privateKey = process.env.MODULE_CATALOG_PRIVATE_KEY;
if (!privateKey) throw new Error('Set MODULE_CATALOG_PRIVATE_KEY in the release environment.');

const modules = await loadInstalledModules(
	process.env.MAL_CLIENT_ID,
	process.env.METADATA_PROVIDERS_JSON,
	process.env.METADATA_API_KEYS_JSON,
	process.env.ENABLE_JIKAN_METADATA === 'true',
	process.env.JIKAN_RIGHTS_REVIEW_JSON
);
if (modules.length === 0) throw new Error('No provider modules are registered for this release.');
const signature = sign(null, Buffer.from(canonicalManifestPayload(modules.map((module) => module.manifest))), privateKey);
process.stdout.write(`${signature.toString('base64')}\n`);