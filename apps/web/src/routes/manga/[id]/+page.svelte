<script lang="ts">
  import { ArrowLeft, Bookmark, BookOpen, Star } from 'lucide-svelte';
  import type { Chapter, MediaSummary } from '@wyllo/domain';
  import { hasInLibrary, toggleLibrary } from '$lib/library';

  export let data: { manga: MediaSummary; chapters: Chapter[] };
  let saved = hasInLibrary(data.manga.id);
  function toggleSaved() { saved = toggleLibrary(data.manga.id, 'manga'); }
</script>

<svelte:head><title>{data.manga.title} | Wyllo Player</title></svelte:head>

<section class="manga-cover" style={data.manga.backdrop ? `--cover-image: url('${data.manga.backdrop}')` : undefined}>
  <a class="back-link" href="/search?type=manga"><ArrowLeft size={15} /> Back to manga</a>
  <div class="manga-hero">
    {#if data.manga.cover}<img src={data.manga.cover} alt="Cover for {data.manga.title}" />{:else}<div class="manga-poster-fallback" aria-hidden="true">{data.manga.title}</div>{/if}
    <div>
      <p class="overline">{data.manga.label}</p>
      <h1>{data.manga.title}</h1>
      <p class="original-title">{data.manga.originalTitle}</p>
          <div class="detail-meta"><span>{data.manga.year ?? 'Year not listed'}</span><span>{data.manga.status}</span>{#if data.manga.rating > 0}<span><Star size={13} fill="currentColor" /> {data.manga.rating}</span>{/if}</div>
      <div class="genre-list">{#each data.manga.genres as genre}<span>{genre}</span>{/each}</div>
      <p class="synopsis">{data.manga.synopsis}</p>
      <div class="detail-actions">
        {#if data.chapters[0]}<a class="read-button" href="/read/{data.chapters[0].id}"><BookOpen size={16} /> Open chapter</a>{/if}
        <button class="save-detail" class:saved type="button" onclick={toggleSaved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'In your library' : 'Add to library'}</button>
      </div>
    </div>
  </div>
</section>

<section class="chapter-section">
  {#if data.chapters.length}
    <div class="chapter-heading"><div><p class="overline">CHAPTERS</p><h2>Available chapters <span>{data.chapters.length}</span></h2></div><p>{data.manga.sourceName}</p></div>
  {:else}
    <div class="chapter-heading"><div><p class="overline">TITLE METADATA</p><h2>Reading pages unavailable</h2></div><p>This provider supplies title metadata but no authorized chapter or page source.</p></div>
  {/if}
  <div class="chapter-list">
    {#each [...data.chapters].reverse() as chapter (chapter.id)}
      <a href="/read/{chapter.id}" class="chapter-row"><span class="chapter-number">{String(chapter.number).padStart(2, '0')}</span><span class="chapter-name"><strong>{chapter.title}</strong><small>{chapter.pages} attributed pages</small></span><span class="read-label">READ <BookOpen size={14} /></span></a>
    {/each}
  </div>
  {#if data.manga.externalUrl}<p class="content-note">{data.manga.sourceAttribution} <a href={data.manga.externalUrl} target="_blank" rel="noreferrer">View source collection</a></p>{/if}
</section>

<style>
  .manga-cover { position: relative; padding: 30px clamp(22px, 5vw, 72px) 52px; background: #191c17 var(--cover-image) center 38% / cover no-repeat; }
  .manga-cover::before { position: absolute; inset: 0; content: ''; background: linear-gradient(90deg, rgb(14 16 13 / 96%), rgb(14 16 13 / 74%) 56%, rgb(14 16 13 / 45%)), linear-gradient(0deg, #111310, transparent 40%); }
  .back-link, .manga-hero { position: relative; z-index: 1; }
  .back-link { display: inline-flex; align-items: center; gap: 8px; color: #b9bbb0; font-size: 11px; text-decoration: none; }
  .manga-hero { display: grid; grid-template-columns: minmax(190px, 270px) minmax(0, 1fr); align-items: center; gap: clamp(28px, 5vw, 70px); max-width: 1050px; margin: 42px auto 0; }
  .manga-hero > img { width: 100%; aspect-ratio: 0.73; object-fit: cover; box-shadow: 0 22px 50px rgb(0 0 0 / 35%); }
  .overline { display: flex; align-items: center; gap: 10px; margin: 0 0 15px; color: #e8785d; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; }
  h1 { max-width: 720px; margin: 0; font: 600 clamp(40px, 5.5vw, 68px)/1.02 'Playfair Display', Georgia, serif; }
  .original-title { margin: 9px 0 18px; color: #a9aa9f; font-size: 14px; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 18px; color: #c5c6bc; font-size: 11px; }
  .detail-meta span:last-child { display: inline-flex; gap: 5px; align-items: center; color: #e8c17f; }
  .genre-list { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 17px; }
  .genre-list span { border: 1px solid #4a4c43; padding: 6px 9px; color: #d0d1c7; font-size: 10px; }
  .synopsis { max-width: 570px; margin: 18px 0 22px; color: #c7c8be; font-size: 13px; line-height: 1.75; }
  .detail-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .read-button, .save-detail { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 43px; border: 0; padding: 0 15px; font-size: 11px; font-weight: 700; text-decoration: none; cursor: pointer; }
  .read-button { background: #e56348; color: white; }
  .save-detail { border: 1px solid #5a5c52; background: rgb(18 20 17 / 50%); color: #ecebe3; }
  .save-detail.saved { color: #f0957b; }
  .chapter-section { max-width: 1050px; margin: 0 auto; padding: 30px clamp(22px, 5vw, 60px) 80px; }
  .chapter-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .chapter-heading .overline { margin-bottom: 8px; }
  h2 { margin: 0; font: 600 29px 'Playfair Display', Georgia, serif; }
  h2 span { margin-left: 6px; color: #8e9186; font: 400 12px 'DM Sans', sans-serif; }
  .chapter-heading > p, .content-note { color: #888b81; font-size: 10px; }
  .chapter-list { border-top: 1px solid #33362f; }
  .chapter-row { display: grid; grid-template-columns: 50px 1fr auto; align-items: center; gap: 14px; min-height: 70px; border-bottom: 1px solid #33362f; color: inherit; text-decoration: none; }
  .chapter-row:hover { background: #1a1d18; }
  .chapter-number { color: #e8785d; font: 16px 'Playfair Display', Georgia, serif; }
  .chapter-name { display: grid; gap: 5px; }
  .chapter-name strong { font-size: 12px; font-weight: 600; }
  .chapter-name small { color: #8f9186; font-size: 10px; }
  .read-label { display: flex; align-items: center; gap: 8px; color: #9b9e92; font-size: 9px; letter-spacing: 0.09em; }
  .read-label :global(svg) { color: #e8785d; }
  .content-note { margin-top: 18px; line-height: 1.6; }
  .content-note a { margin-left: 7px; color: #ee8b70; }
  @media (max-width: 700px) { .manga-cover { padding: 24px 20px 34px; } .manga-hero { grid-template-columns: 96px minmax(0, 1fr); gap: 18px; margin-top: 28px; align-items: start; } .manga-hero > img { margin-top: 5px; } h1 { font-size: 36px; } .original-title { margin: 6px 0 12px; font-size: 11px; } .detail-meta { gap: 9px; font-size: 9px; } .genre-list { gap: 5px; margin-top: 10px; } .genre-list span { padding: 5px 6px; font-size: 8px; } .synopsis { grid-column: 1 / -1; margin: 0; font-size: 12px; } .detail-actions { grid-column: 1 / -1; } .read-button, .save-detail { flex: 1; min-height: 40px; padding: 0 8px; font-size: 10px; } .chapter-section { padding: 25px 20px 90px; } .chapter-heading { align-items: start; flex-direction: column; gap: 7px; } .chapter-row { grid-template-columns: 36px minmax(0, 1fr) auto; gap: 8px; } }
</style>