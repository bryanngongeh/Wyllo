<script lang="ts">
  import { Bookmark, SlidersHorizontal } from 'lucide-svelte';
  import type { MediaSummary, MediaType } from '@wyllo/domain';
  import MediaCard from '$lib/MediaCard.svelte';
  import { getProgress, library } from '$lib/library';

  export let data: { items: MediaSummary[]; total: number };
  let filter: 'all' | MediaType = 'all';
  let sort: 'recent' | 'title' = 'recent';
  $: savedItems = $library.filter((entry) => filter === 'all' || entry.type === filter)
    .map((entry) => ({ entry, item: data.items.find((item) => item.id === entry.id) }))
    .filter((value): value is { entry: (typeof $library)[number]; item: MediaSummary } => Boolean(value.item))
    .sort((left, right) => sort === 'recent' ? right.entry.addedAt - left.entry.addedAt : left.item.title.localeCompare(right.item.title));
</script>

<svelte:head><title>My library | Wyllo Player</title></svelte:head>

<section class="library-page">
  <div class="library-heading"><div><p class="overline">KEPT CLOSE</p><h1>Your library</h1><p class="subtitle">Your saved anime and manga, all in one place.</p></div><div class="library-count"><strong>{$library.length.toString().padStart(2, '0')}</strong><span>STORIES</span></div></div>
  <div class="library-controls"><div class="filter-tabs"><button class:active={filter === 'all'} onclick={() => filter = 'all'}>Everything</button><button class:active={filter === 'anime'} onclick={() => filter = 'anime'}>Anime</button><button class:active={filter === 'manga'} onclick={() => filter = 'manga'}>Manga</button></div><label><SlidersHorizontal size={14} /><span>Sort</span><select bind:value={sort} aria-label="Sort library"><option value="recent">Recently added</option><option value="title">Title A-Z</option></select></label></div>
  {#if savedItems.length}
    <div class="library-grid">{#each savedItems as saved (saved.entry.id)}<MediaCard item={saved.item} progress={getProgress(saved.item.id)} />{/each}</div>
  {:else}
    <div class="library-empty"><Bookmark size={27} /><h2>Nothing saved just yet</h2><p>Bookmark an anime or manga and it will be waiting here.</p><a href="/search">Explore the collection</a></div>
  {/if}
</section>

<style>
  .library-page { max-width: 1380px; margin: 0 auto; padding: 54px clamp(22px, 5vw, 72px) 100px; }
  .library-heading { display: flex; justify-content: space-between; align-items: end; border-bottom: 1px solid #34372f; padding-bottom: 25px; }
  .overline { margin: 0 0 10px; color: #e8785d; font-size: 9px; font-weight: 700; letter-spacing: 0.15em; }
  h1 { margin: 0; font: 600 48px/1.05 'Playfair Display', Georgia, serif; }
  .subtitle { margin: 10px 0 0; color: #a2a49a; font-size: 12px; }
  .library-count { display: grid; gap: 3px; justify-items: end; color: #8a8c82; font-size: 8px; letter-spacing: 0.11em; }
  .library-count strong { color: #e8785d; font: 500 32px 'Playfair Display', Georgia, serif; letter-spacing: 0; }
  .library-controls { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 0; }
  .filter-tabs { display: flex; gap: 4px; }
  .filter-tabs button { border: 1px solid transparent; padding: 8px 11px; background: transparent; color: #999c91; font-size: 10px; cursor: pointer; }
  .filter-tabs button.active { border-color: #484b41; color: #f0efe7; }
  .library-controls label { display: flex; align-items: center; gap: 7px; color: #a2a49a; font-size: 10px; }
  select { border: 0; background: #181a16; color: #d9d9d0; font-size: 10px; }
  .library-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 25px 18px; }
  .library-empty { display: grid; justify-items: center; padding: 100px 18px; color: #777a70; text-align: center; }
  .library-empty h2 { margin: 17px 0 5px; color: #f0efe7; font: 600 25px 'Playfair Display', Georgia, serif; }
  .library-empty p { color: #a0a197; font-size: 11px; }
  .library-empty a { margin-top: 13px; color: #ed8064; font-size: 11px; }
  @media (max-width: 1000px) { .library-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 700px) { .library-page { padding: 38px 20px 100px; } h1 { font-size: 39px; } .library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; } .library-controls label span { display: none; } }
</style>