<script lang="ts">
  import { Search } from 'lucide-svelte';
  import type { MediaSummary, MediaType } from '@wyllo/domain';
  import MediaCard from '$lib/MediaCard.svelte';

  export let data: { query: string; type?: MediaType; items: MediaSummary[]; total: number; allTotal: number };
</script>

<svelte:head><title>{data.query ? `Search: ${data.query}` : 'Explore'} | Wyllo Player</title></svelte:head>

<section class="search-page page-shell">
  <p class="overline">THE WYLLO COLLECTION</p>
  <h1>Find your next<br /><em>favorite world.</em></h1>
  <form action="/search" method="GET" class="large-search">
    <Search size={19} />
    <input name="q" value={data.query} placeholder="Search titles, genres, moods..." aria-label="Search catalog" />
    {#if data.type}<input type="hidden" name="type" value={data.type} />{/if}
    <button type="submit">Search</button>
  </form>
  <div class="filter-row" aria-label="Filter media type">
    <a class:chosen={!data.type} href="/search{data.query ? `?q=${encodeURIComponent(data.query)}` : ''}">Everything <span>{data.allTotal}</span></a>
    <a class:chosen={data.type === 'anime'} href="/search?type=anime{data.query ? `&q=${encodeURIComponent(data.query)}` : ''}">Anime</a>
    <a class:chosen={data.type === 'manga'} href="/search?type=manga{data.query ? `&q=${encodeURIComponent(data.query)}` : ''}">Manga</a>
    <p>{data.query ? `Showing matches for “${data.query}”` : 'Browse connected anime and manga catalogs'}</p>
  </div>
  {#if data.items.length}
    <div class="result-grid">{#each data.items as item (item.id)}<MediaCard {item} />{/each}</div>
  {:else}
    <div class="empty-state"><Search size={28} />
      {#if data.type === 'anime'}
        <h2>No anime matches</h2><p>Anime search uses metadata only. Video playback requires a separate authorized source.</p><a href="/search?type=manga">Browse manga</a>
      {:else}
        <h2>No stories found</h2><p>Try another title or clear the type filter.</p><a href="/search">Browse everything</a>
      {/if}
    </div>
  {/if}
</section>

<style>
  .page-shell { max-width: 1440px; margin: 0 auto; padding: 56px clamp(22px, 5vw, 72px) 90px; }
  .overline { margin: 0 0 14px; color: #e8785d; font-size: 10px; font-weight: 700; letter-spacing: 0.17em; }
  h1 { margin: 0 0 30px; color: #f0efe7; font: 600 clamp(42px, 6vw, 70px)/1 'Playfair Display', Georgia, serif; }
  h1 em { color: #d0a18e; font-weight: 500; }
  .large-search { display: flex; align-items: center; gap: 13px; max-width: 720px; height: 58px; border-bottom: 1px solid #686a60; color: #9b9c91; }
  input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #f0efe7; font-size: 15px; }
  input::placeholder { color: #7d8076; }
  button { align-self: stretch; border: 0; padding: 0 19px; background: #e56348; color: white; font-size: 12px; font-weight: 700; cursor: pointer; }
  .filter-row { display: flex; align-items: center; gap: 8px; margin: 28px 0 22px; border-bottom: 1px solid #30332d; }
  .filter-row a { display: inline-flex; gap: 8px; align-items: center; border-bottom: 2px solid transparent; padding: 0 10px 12px; color: #a6a99e; font-size: 11px; text-decoration: none; }
  .filter-row a.chosen { border-color: #e56348; color: #f0efe7; }
  .filter-row a span { color: #e8785d; }
  .filter-row p { margin: 0 0 12px auto; color: #85887e; font-size: 10px; }
  .result-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px 18px; }
  .empty-state { display: grid; justify-items: center; padding: 90px 20px; color: #81847b; text-align: center; }
  .empty-state h2 { margin: 18px 0 5px; color: #f0efe7; font: 600 24px 'Playfair Display', Georgia, serif; }
  .empty-state p { font-size: 12px; }
  .empty-state a { margin-top: 15px; color: #ee8065; font-size: 12px; }
  @media (max-width: 1000px) { .result-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 700px) { .page-shell { padding: 40px 20px 100px; } .filter-row { gap: 2px; } .filter-row a { padding-inline: 7px; } .filter-row p { display: none; } .result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; } }
</style>