<script lang="ts">
  import { Search } from 'lucide-svelte';
  import type { ComicSummary } from '@wyllo/domain';
  import ComicCard from '$lib/ComicCard.svelte';

  export let data: { query: string; items: ComicSummary[]; unavailable: boolean };
</script>

<svelte:head>
  <title>{data.query ? `Comics: ${data.query}` : 'Comics'} | Wyllo Player</title>
  <meta name="description" content="Search comic catalog records and open available reads at Open Library." />
</svelte:head>

<section class="comics-page">
  <header class="catalog-heading">
    <p class="eyebrow">OPEN LIBRARY CATALOG</p>
    <h1>Comics</h1>
    <p class="description">Browse comic catalog records. Reading availability is provided by Open Library.</p>
    <form action="/comics" method="GET" class="comic-search">
      <Search size={18} />
      <input name="q" value={data.query} placeholder="Search comic titles or authors" aria-label="Search comics" />
      <button type="submit">Search</button>
    </form>
  </header>

  {#if data.unavailable}
    <div class="empty-state"><h2>Comics catalog unavailable</h2><p>Open Library could not be reached. Try again shortly.</p></div>
  {:else if data.items.length}
    <div class="comic-grid">{#each data.items as comic (comic.id)}<ComicCard {comic} />{/each}</div>
  {:else}
    <div class="empty-state"><h2>{data.query ? 'No comics found' : 'No comic records available'}</h2><p>Try another search term.</p></div>
  {/if}
</section>

<style>
  .comics-page { max-width: 1440px; margin: 0 auto; padding: 50px clamp(22px, 5vw, 72px) 90px; }
  .catalog-heading { max-width: 720px; margin-bottom: 30px; }
  .eyebrow { margin: 0 0 10px; color: #e8785d; font-size: 9px; font-weight: 700; }
  h1 { margin: 0; font: 600 42px/1.1 'Playfair Display', Georgia, serif; }
  .description { margin: 10px 0 20px; color: #a6a99e; font-size: 12px; line-height: 1.6; }
  .comic-search { display: flex; align-items: center; gap: 12px; height: 48px; border-bottom: 1px solid #686a60; color: #999b91; }
  .comic-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #f0efe7; font-size: 13px; }
  .comic-search button { min-height: 34px; border: 0; padding: 0 15px; background: #e56348; color: white; font-size: 10px; cursor: pointer; }
  .comic-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 26px 18px; }
  .empty-state { border-top: 1px solid #30332d; padding: 44px 0; }
  .empty-state h2 { font: 600 22px 'Playfair Display', Georgia, serif; }
  .empty-state p { color: #a6a99e; font-size: 11px; }
  @media (max-width: 1100px) { .comic-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 800px) { .comic-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .comics-page { padding: 36px 20px 90px; } h1 { font-size: 34px; } .comic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; } }
</style>