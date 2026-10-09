<script lang="ts">
  import { ArrowRight, BookOpen, Sparkles } from 'lucide-svelte';
  import type { MediaSummary } from '@wyllo/domain';
  import MediaCard from '$lib/MediaCard.svelte';
  import { getProgress, library } from '$lib/library';

  export let data: { featured: MediaSummary | null; anime: MediaSummary[]; manga: MediaSummary[] };
  $: continueItems = $library.map((saved) => ({ ...saved, progress: getProgress(saved.id) })).filter((saved) => saved.progress > 0);
</script>

<svelte:head>
  <title>Wyllo Player | Open Collections</title>
  <meta name="description" content="Explore anime and manga catalog metadata with clear source attribution." />
</svelte:head>

{#if data.featured}
  <section class="hero" style={data.featured.backdrop ? `--hero-image: url('${data.featured.backdrop}')` : undefined}>
    <div class="hero-content">
      <div class="eyebrow"><Sparkles size={13} /> {data.featured.label}</div>
      <p class="hero-kicker">{data.featured.type === 'manga' ? 'MANGA TITLE METADATA' : 'ANIME TITLE METADATA'}</p>
      <h1>{data.featured.title}</h1>
      <p class="hero-copy">{data.featured.synopsis}</p>
      <div class="hero-meta"><span>{data.featured.year ?? 'Year not listed'}</span><i></i><span>{data.featured.genres.join(' · ')}</span>{#if data.featured.sourceLicense}<i></i><span class="score">{data.featured.sourceLicense}</span>{/if}</div>
      <div class="hero-actions">
        {#if data.featured.type === 'manga'}
          <a class="primary-action" href="/manga/{data.featured.id}"><BookOpen size={16} />View title</a>
        {:else}
          <a class="primary-action" href="/anime/{data.featured.id}">Open title <ArrowRight size={16} /></a>
        {/if}
        {#if data.featured.externalUrl}<a class="quiet-action" href={data.featured.externalUrl} target="_blank" rel="noreferrer"><ArrowRight size={15} />{data.featured.sourceName ?? 'Source'} record</a>{/if}
      </div>
    </div>
    <div class="hero-index"><span>01</span><i></i> {String(data.anime.length + data.manga.length).padStart(2, '0')}</div>
  </section>
{:else}
  <section class="empty-collection"><p class="eyebrow small">CATALOG</p><h1>No catalog data is available</h1><p>Check the configured metadata providers and try again.</p></section>
{/if}

{#if continueItems.length}
  <section class="content-section continue-section">
    <div class="section-heading"><div><p class="eyebrow small">PICK UP WHERE YOU LEFT</p><h2>Continue your story</h2></div><a href="/library">View library <ArrowRight size={15} /></a></div>
    <div class="media-grid">
      {#each continueItems as saved (saved.id)}
        {@const item = [...data.anime, ...data.manga].find((entry) => entry.id === saved.id)}
        {#if item}<MediaCard {item} progress={saved.progress} />{/if}
      {/each}
    </div>
  </section>
{/if}

{#if data.anime.length}
  <section class="content-section">
    <div class="section-heading"><div><p class="eyebrow small">ANIME METADATA</p><h2>Anime catalog</h2></div><a href="/search?type=anime">Browse titles <ArrowRight size={15} /></a></div>
    <div class="media-grid">{#each data.anime as item (item.id)}<MediaCard {item} />{/each}</div>
  </section>
{:else}
  <section class="source-state"><p class="eyebrow small">ANIME CATALOG</p><h2>No anime metadata source is configured</h2><p>After verifying Jikan or another provider’s terms, enable its metadata module in the API configuration. Metadata does not provide playable video.</p></section>
{/if}

<section class="content-section manga-section">
  <div class="section-heading"><div><p class="eyebrow small">MANGA METADATA</p><h2>Manga catalog</h2></div><a href="/search?type=manga">Browse titles <ArrowRight size={15} /></a></div>
  <div class="media-grid">{#each data.manga as item (item.id)}<MediaCard {item} />{/each}</div>
</section>

<footer class="archive-note"><BookOpen size={14} /> Catalog metadata is attributed to its source; reading and playback require authorized media providers.</footer>

<style>
  .hero { position: relative; display: flex; align-items: end; min-height: min(690px, 72vh); padding: clamp(32px, 6vw, 88px); overflow: hidden; background: #222720 var(--hero-image, none) center 43% / cover no-repeat; }
  .hero::before { position: absolute; inset: 0; content: ''; background: linear-gradient(90deg, rgb(13 15 12 / 96%) 0%, rgb(13 15 12 / 75%) 42%, rgb(13 15 12 / 5%) 100%), linear-gradient(0deg, rgb(13 15 12 / 45%), transparent 48%); }
  .hero-content { position: relative; z-index: 1; max-width: 600px; padding-top: 110px; animation: arrive 550ms ease both; }
  .eyebrow { display: flex; align-items: center; gap: 8px; color: #e8785d; font-size: 10px; font-weight: 700; letter-spacing: 0.13em; }
  .hero-kicker { margin: 30px 0 9px; color: #c7c7b9; font-size: 10px; font-weight: 600; letter-spacing: 0.2em; }
  h1 { max-width: 620px; margin: 0; color: #f0efe7; font: 600 clamp(44px, 6.4vw, 82px)/0.98 'Playfair Display', Georgia, serif; }
  .hero-copy { max-width: 465px; margin: 18px 0; color: #d1d2c9; font-size: 15px; line-height: 1.7; }
  .hero-meta { display: flex; align-items: center; gap: 12px; color: #bec0b6; font-size: 11px; }
  .hero-meta i { width: 3px; height: 3px; border-radius: 50%; background: #86887c; }
  .score { color: #e9c279; }
  .hero-actions { display: flex; gap: 12px; margin-top: 25px; }
  .hero-actions a { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 17px; text-decoration: none; font-size: 12px; font-weight: 700; }
  .primary-action { background: #e56348; color: white; }
  .quiet-action { border: 1px solid rgb(255 255 255 / 34%); color: #f0efe7; }
  .hero-index { position: absolute; right: 42px; bottom: 40px; display: flex; align-items: center; gap: 10px; color: #bcbfb3; font-size: 11px; }
  .hero-index span { color: #f0efe7; }
  .hero-index i { width: 40px; height: 1px; background: #e56348; }
  .content-section { padding: 42px clamp(22px, 4.5vw, 66px) 12px; }
  .section-heading { display: flex; justify-content: space-between; align-items: end; gap: 18px; margin-bottom: 20px; }
  .eyebrow.small { margin: 0 0 8px; font-size: 9px; }
  h2 { margin: 0; color: #f0efe7; font: 600 27px/1.2 'Playfair Display', Georgia, serif; }
  .section-heading > a { display: inline-flex; align-items: center; gap: 9px; padding-bottom: 4px; color: #c2c4b9; font-size: 11px; text-decoration: none; }
  .section-heading > a:hover { color: #ed795e; }
  .media-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
  .manga-section { padding-bottom: 40px; }
  .source-state, .empty-collection { border-top: 1px solid #30332d; padding: 34px clamp(22px, 4.5vw, 66px); }
  .source-state h2, .empty-collection h1 { margin: 0; color: #f0efe7; font: 600 25px/1.2 'Playfair Display', Georgia, serif; }
  .source-state > p:last-child, .empty-collection > p:last-child { margin: 9px 0 0; color: #a6a99e; font-size: 12px; line-height: 1.6; }
  .empty-collection { min-height: 50vh; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
  .empty-collection .eyebrow { margin-bottom: 10px; }
  .archive-note { display: flex; align-items: center; gap: 10px; margin: 36px clamp(22px, 4.5vw, 66px) 28px; border-top: 1px solid #30332d; padding-top: 18px; color: #8e9087; font-size: 10px; }
  @keyframes arrive { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 1050px) { .media-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 700px) { .hero { min-height: 590px; padding: 30px 22px 56px; background-position: 58% center; } .hero::before { background: linear-gradient(90deg, rgb(13 15 12 / 88%), rgb(13 15 12 / 24%)), linear-gradient(0deg, rgb(13 15 12 / 58%), transparent 75%); } .hero-content { padding-top: 130px; } .hero-copy { max-width: 360px; font-size: 14px; } .hero-index { right: 22px; bottom: 23px; } .content-section { padding: 32px 20px 5px; } .media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; } .section-heading { align-items: end; } .section-heading > a { gap: 4px; white-space: nowrap; font-size: 10px; } h2 { font-size: 23px; } .archive-note { margin: 30px 20px 90px; line-height: 1.6; } }
</style>