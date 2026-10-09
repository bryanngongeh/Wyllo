<script lang="ts">
  import { Bookmark, Star } from 'lucide-svelte';
  import type { MediaSummary } from '@wyllo/domain';
  import { hasInLibrary, toggleLibrary } from '$lib/library';

  export let item: MediaSummary;
  export let progress = 0;
  let saved = hasInLibrary(item.id);

  function bookmark(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    saved = toggleLibrary(item.id, item.type);
  }
</script>

<article class="media-card">
  <div class="poster-art" style="--poster-accent: {item.accent}">
    <a class="poster-link" href="/{item.type}/{item.id}" aria-label="Open {item.title}">
      {#if item.cover}<img src={item.cover} alt="" loading="lazy" />{:else}<span class="poster-fallback"><strong>{item.title}</strong><small>{item.sourceName ?? item.type}</small></span>{/if}
    </a>
    <span class="poster-label">{item.contentKind === 'film' ? 'FILM' : item.type === 'manga' ? 'MANGA' : 'SERIES'}</span>
    <button class:active={saved} class="save-button" type="button" aria-label={saved ? 'Remove from library' : 'Add to library'} onclick={bookmark}>
      <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
    </button>
    {#if progress > 0}<span class="card-progress" style="--progress: {progress}%"></span>{/if}
  </div>
  <div class="media-meta">
    <div class="media-title-line"><a href="/{item.type}/{item.id}"><h3>{item.title}</h3></a>{#if item.rating > 0}<span class="rating"><Star size={12} fill="currentColor" />{item.rating.toFixed(1)}</span>{/if}</div>
    <p>{item.year ?? 'Year not listed'} <span>·</span> {item.sourceLicense ?? (item.sourceName === 'MyAnimeList' ? 'MyAnimeList metadata' : item.genres.slice(0, 2).join(' / '))}</p>
  </div>
</article>

<style>
  .poster-link { position: absolute; inset: 0; display: block; text-decoration: none; }
  .poster-art { position: relative; aspect-ratio: 0.76; overflow: hidden; background: var(--poster-accent); isolation: isolate; }
  .poster-art::after { position: absolute; inset: 45% 0 0; z-index: 1; content: ''; background: linear-gradient(transparent, rgb(12 14 11 / 48%)); pointer-events: none; }
  .poster-art img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform 400ms ease; }
  .poster-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 18px; background: linear-gradient(145deg, color-mix(in srgb, var(--poster-accent), white 18%), var(--poster-accent) 58%, #20251f); color: #f5f1e8; }
  .poster-fallback strong { max-width: 15ch; font: 600 19px/1.2 'Playfair Display', Georgia, serif; }
  .poster-fallback small { color: rgb(245 241 232 / 75%); font-size: 9px; }
  .poster-art:hover img { transform: scale(1.045); }
  .poster-label { position: absolute; z-index: 2; bottom: 12px; left: 12px; color: white; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; }
  .save-button { position: absolute; z-index: 3; top: 10px; right: 10px; display: grid; width: 34px; aspect-ratio: 1; place-items: center; border: 1px solid rgb(255 255 255 / 35%); background: rgb(15 17 14 / 65%); color: white; cursor: pointer; }
  .save-button.active { color: #f17d63; }
  .card-progress { position: absolute; z-index: 3; right: 0; bottom: 0; left: 0; height: 3px; background: linear-gradient(to right, #ec7255 var(--progress), rgb(255 255 255 / 28%) var(--progress)); }
  .media-meta { padding-top: 11px; }
  .media-meta a { min-width: 0; text-decoration: none; }
  .media-title-line { display: flex; align-items: baseline; justify-content: space-between; gap: 7px; }
  h3 { overflow: hidden; margin: 0; color: #f0efe7; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .rating { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; color: #e6bb7e; font-size: 11px; }
  p { margin: 6px 0 0; color: #999b90; font-size: 11px; }
  p span { margin: 0 4px; color: #60635b; }
</style>