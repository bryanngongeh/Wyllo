import { Pool } from 'pg';
import type { MediaType } from '@wyllo/domain';

export interface StoredLibraryItem {
  id: string;
  type: MediaType;
  addedAt: number;
}

export interface StoredProgress {
  key: string;
  kind: 'watch' | 'read';
  percent: number;
  updatedAt: number;
}

export interface UserDataRepository {
  getLibrary(userSub: string): Promise<StoredLibraryItem[]>;
  addLibrary(userSub: string, id: string, type: MediaType): Promise<void>;
  removeLibrary(userSub: string, id: string): Promise<void>;
  getProgress(userSub: string): Promise<StoredProgress[]>;
  saveProgress(userSub: string, key: string, kind: StoredProgress['kind'], percent: number): Promise<void>;
  check(): Promise<void>;
  close(): Promise<void>;
}

class MemoryRepository implements UserDataRepository {
  private readonly library = new Map<string, StoredLibraryItem[]>();
  private readonly progress = new Map<string, StoredProgress[]>();

  async getLibrary(userSub: string) { return this.library.get(userSub) ?? []; }
  async addLibrary(userSub: string, id: string, type: MediaType) {
    const items = this.library.get(userSub) ?? [];
    if (!items.some((item) => item.id === id)) items.push({ id, type, addedAt: Date.now() });
    this.library.set(userSub, items);
  }
  async removeLibrary(userSub: string, id: string) {
    this.library.set(userSub, (this.library.get(userSub) ?? []).filter((item) => item.id !== id));
  }
  async getProgress(userSub: string) { return this.progress.get(userSub) ?? []; }
  async saveProgress(userSub: string, key: string, kind: StoredProgress['kind'], percent: number) {
    const values = this.progress.get(userSub) ?? [];
    const next = { key, kind, percent, updatedAt: Date.now() };
    const index = values.findIndex((value) => value.key === key && value.kind === kind);
    if (index >= 0) values[index] = next;
    else values.push(next);
    this.progress.set(userSub, values);
  }
  async check() {}
  async close() {}
}

class PostgresRepository implements UserDataRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 15, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000 });
  }

  async getLibrary(userSub: string): Promise<StoredLibraryItem[]> {
    const result = await this.pool.query<{ id: string; type: MediaType; added_at: Date }>(
      'SELECT media_id AS id, media_type AS type, added_at FROM library_items WHERE user_sub = $1 ORDER BY added_at DESC', [userSub]
    );
    return result.rows.map((row) => ({ id: row.id, type: row.type, addedAt: row.added_at.getTime() }));
  }

  async addLibrary(userSub: string, id: string, type: MediaType): Promise<void> {
    await this.pool.query(
      'INSERT INTO library_items (user_sub, media_id, media_type) VALUES ($1, $2, $3) ON CONFLICT (user_sub, media_id) DO NOTHING',
      [userSub, id, type]
    );
  }

  async removeLibrary(userSub: string, id: string): Promise<void> {
    await this.pool.query('DELETE FROM library_items WHERE user_sub = $1 AND media_id = $2', [userSub, id]);
  }

  async getProgress(userSub: string): Promise<StoredProgress[]> {
    const result = await this.pool.query<{ progress_key: string; progress_kind: 'watch' | 'read'; percent: number; updated_at: Date }>(
      'SELECT progress_key, progress_kind, percent, updated_at FROM user_progress WHERE user_sub = $1 ORDER BY updated_at DESC', [userSub]
    );
    return result.rows.map((row) => ({ key: row.progress_key, kind: row.progress_kind, percent: row.percent, updatedAt: row.updated_at.getTime() }));
  }

  async saveProgress(userSub: string, key: string, kind: StoredProgress['kind'], percent: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_progress (user_sub, progress_key, progress_kind, percent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_sub, progress_kind, progress_key)
       DO UPDATE SET percent = EXCLUDED.percent, updated_at = now()`,
      [userSub, key, kind, percent]
    );
  }

  async check(): Promise<void> { await this.pool.query('SELECT 1'); }
  async close(): Promise<void> { await this.pool.end(); }
}

export async function createRepository(databaseUrl?: string): Promise<UserDataRepository> {
  if (!databaseUrl) return new MemoryRepository();
  const repository = new PostgresRepository(databaseUrl);
  await repository.check();
  return repository;
}