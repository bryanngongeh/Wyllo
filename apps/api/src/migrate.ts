import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { z } from 'zod';

const databaseUrl = z.string().url().parse(process.env.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  for (const migrationName of ['001_user_library_progress.sql', '002_provider_references.sql', '003_provider_reference_parent.sql']) {
    const migration = await readFile(resolve(process.cwd(), 'migrations', migrationName), 'utf8');
    await pool.query(migration);
    process.stdout.write(`Applied ${migrationName}\n`);
  }
} finally {
  await pool.end();
}