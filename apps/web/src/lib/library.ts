import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { MediaType } from '@wyllo/domain';
import { authState } from '$lib/auth';
import { apiRequest } from '$lib/api';

export interface LibraryEntry {
  id: string;
  type: MediaType;
  addedAt: number;
}

function storagePrefix(): string {
  const subject = get(authState).user?.sub;
  return `wyllo:${subject ? encodeURIComponent(subject) : 'guest'}`;
}

function loadLibrary(): LibraryEntry[] {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(`${storagePrefix()}:library`) ?? '[]') as LibraryEntry[];
  } catch {
    return [];
  }
}

export const library = writable<LibraryEntry[]>(loadLibrary());

export function hasInLibrary(id: string): boolean {
  return loadLibrary().some((item) => item.id === id);
}

export function toggleLibrary(id: string, type: MediaType): boolean {
  let added = false;
  library.update((current) => {
    const exists = current.some((item) => item.id === id);
    added = !exists;
    const next = exists
      ? current.filter((item) => item.id !== id)
      : [...current, { id, type, addedAt: Date.now() }];
    if (browser) {
      localStorage.setItem(`${storagePrefix()}:library`, JSON.stringify(next));
      if (get(authState).isAuthenticated) {
        const operation = exists
          ? apiRequest(`/library/${encodeURIComponent(id)}`, { method: 'DELETE' })
          : apiRequest('/library', { method: 'POST', body: JSON.stringify({ id, type }) });
        void operation.catch(() => undefined);
      }
    }
    return next;
  });
  return added;
}

function readProgress(key: string, kind: 'watch' | 'read'): number {
  if (!browser) return 0;
  const value = Number(localStorage.getItem(`${storagePrefix()}:progress:${kind}:${key}`) ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

export function getProgress(key: string, kind?: 'watch' | 'read'): number {
  return kind ? readProgress(key, kind) : Math.max(readProgress(key, 'watch'), readProgress(key, 'read'));
}

export function saveProgress(key: string, percent: number, kind: 'watch' | 'read' = 'watch'): void {
  if (!browser) return;
  const bounded = Math.max(0, Math.min(100, Math.round(percent)));
  localStorage.setItem(`${storagePrefix()}:progress:${kind}:${key}`, String(bounded));
  if (get(authState).isAuthenticated) {
    void apiRequest(`/progress/${kind}`, { method: 'PUT', body: JSON.stringify({ key, percent: bounded }) }).catch(() => undefined);
  }
}

export async function syncPersonalData(): Promise<void> {
  if (!browser || !get(authState).isAuthenticated) return;
  try {
    const [saved, progress] = await Promise.all([
      apiRequest<{ items: LibraryEntry[] }>('/library'),
      apiRequest<{ items: Array<{ key: string; kind: 'watch' | 'read'; percent: number }> }>('/progress')
    ]);
    library.set(saved.items);
    localStorage.setItem(`${storagePrefix()}:library`, JSON.stringify(saved.items));
    for (const item of progress.items) {
      localStorage.setItem(`${storagePrefix()}:progress:${item.kind}:${item.key}`, String(item.percent));
    }
  } catch {
    library.set(loadLibrary());
  }
}