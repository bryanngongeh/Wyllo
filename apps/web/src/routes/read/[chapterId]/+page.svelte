<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, ArrowLeftRight, ArrowRight, Minus, Plus, Rows3, Square } from 'lucide-svelte';
  import type { Chapter, MediaSummary, PageImage } from '@wyllo/domain';
  import { getProgress, saveProgress } from '$lib/library';

  export let data: { manga: MediaSummary; chapter: Chapter; chapters: Chapter[]; pages: PageImage[] };
  let pageIndex = 0;
  let mode: 'single' | 'continuous' = 'single';
  let direction: 'ltr' | 'rtl' = 'rtl';
  let zoom = 100;

  $: step = direction === 'rtl' ? -1 : 1;
  $: visibleIndex = pageIndex;
  $: currentPage = data.pages[visibleIndex];

  function setPage(next: number) {
    pageIndex = Math.max(0, Math.min(data.pages.length - 1, next));
    saveProgress(data.manga.id, Math.round(pageIndex / Math.max(data.pages.length - 1, 1) * 100), 'read');
    const neighbor = data.pages[visibleIndex + step];
    if (neighbor) { const image = new Image(); image.src = neighbor.url; }
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') setPage(pageIndex + step);
    if (event.key === 'ArrowLeft') setPage(pageIndex - step);
  }

  function previousPage() { setPage(pageIndex - step); }
  function nextPage() { setPage(pageIndex + step); }

  onMount(() => {
    const progress = getProgress(data.manga.id);
    pageIndex = progress > 0
      ? Math.round(progress / 100 * (data.pages.length - 1))
      : direction === 'rtl' ? data.pages.length - 1 : 0;
    if (currentPage) { const image = new Image(); image.src = currentPage.url; }
  });
</script>

<svelte:head><title>{data.manga.title} · {data.chapter.title} | Wyllo Reader</title></svelte:head>
<svelte:window onkeydown={handleKey} />

<section class="reader">
  <header class="reader-bar">
    <a class="reader-back" href="/manga/{data.manga.id}" aria-label="Back to manga"><ArrowLeft size={17} /></a>
    <div class="reader-title"><strong>{data.manga.title}</strong><span>{data.chapter.title}</span></div>
    <div class="reader-tools">
      <div class="segmented" aria-label="Reading mode"><button class:active={mode === 'single'} aria-label="Single page" onclick={() => mode = 'single'}><Square size={15} /></button><button class:active={mode === 'continuous'} aria-label="Continuous pages" onclick={() => mode = 'continuous'}><Rows3 size={16} /></button></div>
      <button class="tool-button direction-button" aria-label="Change reading direction" title="Change reading direction" onclick={() => { direction = direction === 'rtl' ? 'ltr' : 'rtl'; pageIndex = data.pages.length - 1 - pageIndex; }}><ArrowLeftRight size={16} /><span>{direction.toUpperCase()}</span></button>
      <div class="zoom-tools"><button class="tool-button" aria-label="Zoom out" onclick={() => zoom = Math.max(60, zoom - 10)}><Minus size={15} /></button><span>{zoom}%</span><button class="tool-button" aria-label="Zoom in" onclick={() => zoom = Math.min(150, zoom + 10)}><Plus size={15} /></button></div>
    </div>
  </header>

  <div class:continuous={mode === 'continuous'} class="page-stage" dir={direction}>
    {#if mode === 'single'}
      <img class="manga-page" style="--zoom: {zoom}%" src={currentPage?.url} alt="Manga page {visibleIndex + 1} of {data.pages.length}" />
    {:else}
      <div class="continuous-pages" style="--zoom: {zoom}%">
        {#each data.pages as page, index (page.number)}<img src={page.url} alt="Manga page {page.number}" loading={Math.abs(index - visibleIndex) < 2 ? 'eager' : 'lazy'} />{/each}
      </div>
    {/if}
  </div>

  <footer class="reader-footer">
    <button class="page-nav" disabled={direction === 'rtl' ? pageIndex >= data.pages.length - 1 : pageIndex <= 0} onclick={previousPage}><ArrowLeft size={16} /><span>Previous</span></button>
    <div class="page-count"><strong>{visibleIndex + 1}</strong><span> / {data.pages.length}</span><div class="progress-track"><i style="--read-progress: {(visibleIndex + 1) / data.pages.length * 100}%"></i></div></div>
    <button class="page-nav" disabled={direction === 'rtl' ? pageIndex <= 0 : pageIndex >= data.pages.length - 1} onclick={nextPage}><span>Next</span><ArrowRight size={16} /></button>
  </footer>
  <p class="reader-note">{#if currentPage}<a href={currentPage.sourceUrl} target="_blank" rel="noreferrer">Page source</a> · {currentPage.licenseName} · {currentPage.attribution}{/if} · Reading progress saves to your account when signed in.</p>
</section>

<style>
  .reader { min-height: calc(100vh - 70px); background: #0a0b09; }
  .reader-bar { position: sticky; z-index: 5; top: 70px; display: flex; align-items: center; gap: 15px; min-height: 66px; border-bottom: 1px solid #2d3029; padding: 0 24px; background: #141612; }
  .reader-back, .tool-button { display: grid; place-items: center; border: 0; background: transparent; color: #d0d2c8; cursor: pointer; }
  .reader-back { width: 34px; aspect-ratio: 1; }
  .reader-title { display: grid; gap: 4px; min-width: 150px; }
  .reader-title strong { font-size: 11px; }
  .reader-title span { color: #96998e; font-size: 9px; }
  .reader-tools { display: flex; align-items: center; gap: 13px; margin-left: auto; }
  .segmented { display: flex; border: 1px solid #42453c; }
  .segmented button { display: grid; width: 35px; aspect-ratio: 1; place-items: center; border: 0; background: transparent; color: #a7a99e; cursor: pointer; }
  .segmented button.active { background: #34372f; color: #f08468; }
  .direction-button { display: flex; gap: 6px; height: 34px; padding: 0 7px; font-size: 9px; }
  .zoom-tools { display: flex; align-items: center; gap: 6px; color: #aaa; font-size: 9px; }
  .zoom-tools .tool-button { width: 30px; height: 30px; }
  .page-stage { display: grid; min-height: min(78vh, 1000px); place-items: center; padding: 20px; overflow: auto; background: #0d0e0c; }
  .page-stage.continuous { display: block; }
  .manga-page { display: block; width: min(var(--zoom), 100%); max-height: 73vh; object-fit: contain; background: #171915; }
  .continuous-pages { display: grid; justify-items: center; gap: 2px; }
  .continuous-pages img { display: block; width: min(var(--zoom), 100%); max-height: none; object-fit: contain; }
  .reader-footer { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 62px; border-top: 1px solid #2d3029; padding: 0 22px; background: #141612; }
  .page-nav { display: inline-flex; align-items: center; gap: 8px; justify-self: start; border: 0; background: transparent; color: #d0d2c8; font-size: 10px; cursor: pointer; }
  .page-nav:last-child { justify-self: end; }
  .page-nav:disabled { color: #55584f; cursor: default; }
  .page-count { display: grid; grid-template-columns: auto auto; column-gap: 3px; align-items: baseline; color: #777a70; font-size: 10px; text-align: center; }
  .page-count strong { color: #f0efe7; font-size: 12px; }
  .progress-track { grid-column: 1 / -1; width: min(190px, 38vw); height: 2px; margin-top: 7px; background: #3d4037; }
  .progress-track i { display: block; width: var(--read-progress); height: 100%; background: #e56348; }
  .reader-note { margin: 0; padding: 12px 20px 18px; color: #92958a; font-size: 9px; line-height: 1.7; text-align: center; }
  .reader-note a { color: #ee8b70; }
  @media (max-width: 700px) { .reader { min-height: 100vh; } .reader-bar { top: 0; gap: 8px; min-height: 60px; padding: 0 10px; } .reader-title { min-width: 0; max-width: 33vw; } .reader-title strong, .reader-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .reader-tools { gap: 5px; } .segmented button { width: 31px; } .direction-button { padding: 0 4px; } .zoom-tools { gap: 1px; } .zoom-tools .tool-button { width: 25px; } .page-stage { min-height: calc(100vh - 160px); padding: 7px; } .manga-page { max-height: calc(100vh - 180px); } .reader-footer { min-height: 56px; padding: 0 10px; } .page-nav span { font-size: 9px; } }
</style>