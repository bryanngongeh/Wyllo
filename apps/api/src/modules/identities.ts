import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { ContentIdentityStore, ProviderReference, ReferenceEntity } from '@wyllo/domain';

class MemoryIdentityStore implements ContentIdentityStore {
  private readonly byProvider = new Map<string, { id: string; reference: ProviderReference }>();
  private readonly byWyllo = new Map<string, ProviderReference>();

  async getWylloId(reference: ProviderReference): Promise<string> {
    const key = `${reference.moduleId}:${reference.entity}:${reference.providerRef}`;
    const existing = this.byProvider.get(key);
    if (existing) {
      if (existing.reference.mediaType !== reference.mediaType) throw new Error('Provider reference media type changed.');
      return existing.id;
    }
    const id = randomUUID();
    this.byProvider.set(key, { id, reference });
    this.byWyllo.set(`${id}:${reference.entity}`, reference);
    return id;
  }

  async getProviderReference(wylloId: string, entity: ReferenceEntity) {
    return this.byWyllo.get(`${wylloId}:${entity}`);
  }

  async check() {}
  async close() { this.byProvider.clear(); this.byWyllo.clear(); }
}

class PostgresIdentityStore implements ContentIdentityStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000 });
  }

  async getWylloId(reference: ProviderReference): Promise<string> {
    const id = randomUUID();
    const result = await this.pool.query<{ wyllo_id: string; media_type: ProviderReference['mediaType'] }>(
      `INSERT INTO provider_references (wyllo_id, module_id, entity_type, provider_ref, parent_provider_ref, media_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (module_id, entity_type, provider_ref)
       DO UPDATE SET parent_provider_ref = COALESCE(EXCLUDED.parent_provider_ref, provider_references.parent_provider_ref)
       RETURNING wyllo_id, media_type`,
      [id, reference.moduleId, reference.entity, reference.providerRef, reference.parentProviderRef ?? null, reference.mediaType]
    );
    const row = result.rows[0];
    if (row.media_type !== reference.mediaType) throw new Error('Provider reference media type changed.');
    return row.wyllo_id;
  }

  async getProviderReference(wylloId: string, entity: ReferenceEntity): Promise<ProviderReference | undefined> {
    const result = await this.pool.query<{ module_id: string; entity_type: ReferenceEntity; provider_ref: string; parent_provider_ref: string | null; media_type: ProviderReference['mediaType'] }>(
      'SELECT module_id, entity_type, provider_ref, parent_provider_ref, media_type FROM provider_references WHERE wyllo_id = $1 AND entity_type = $2',
      [wylloId, entity]
    );
    const row = result.rows[0];
    return row && { moduleId: row.module_id, entity: row.entity_type, providerRef: row.provider_ref, parentProviderRef: row.parent_provider_ref ?? undefined, mediaType: row.media_type };
  }

  async check(): Promise<void> { await this.pool.query('SELECT 1'); }
  async close(): Promise<void> { await this.pool.end(); }
}

export async function createIdentityStore(databaseUrl?: string): Promise<ContentIdentityStore> {
  if (!databaseUrl) return new MemoryIdentityStore();
  const store = new PostgresIdentityStore(databaseUrl);
  await store.check();
  return store;
}