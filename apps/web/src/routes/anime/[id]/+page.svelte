<script lang="ts">
  import { ArrowLeft, Bookmark, Play, Star } from 'lucide-svelte';
  import type { Episode, MediaSummary } from '@wyllo/domain';
  import { hasInLibrary, toggleLibrary } from '$lib/library';

  export let data: { anime: MediaSummary; episodes: Episode[] };
  let saved = hasInLibrary(data.anime.id);

  function toggleSaved() { saved = toggleLibrary(data.anime.id, 'anime'); }
  function durationLabel(minutes: number) {
    const seconds = Math.round(minutes * 60);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
</script>

<svelte:head><title>{data.anime.title} | Wyllo Player</title></svelte:head>

<section class="detail-cover" style={data.anime.backdrop ? `--cover-image: url('${data.anime.backdrop}')` : undefined}>
  <a class="back-link" href="/search?type=anime"><ArrowLeft size={15} /> Back to anime</a>
  <div class="detail-hero">
    {#if data.anime.cover}<img class="detail-poster" src={data.anime.cover} alt="Cover for {data.anime.title}" />{:else}<div class="detail-poster poster-fallback"><strong>{data.anime.title}</strong><small>{data.anime.sourceName}</small></div>{/if}
    <div class="detail-copy">
      <p class="overline">{data.anime.label}</p>
      <h1>{data.anime.title}</h1>
      <p class="original-title">{data.anime.originalTitle}</p>
      <div class="detail-meta"><span>{data.anime.year ?? 'Year not listed'}</span><span>{data.anime.status}</span>{#if data.anime.rating > 0}<span><Star size={13} fill="currentColor" /> {data.anime.rating}</span>{/if}</div>
      <div class="genre-list">{#each data.anime.genres as genre}<span>{genre}</span>{/each}</div>
      <p class="synopsis">{data.anime.synopsis}</p>
      <div class="detail-actions">
        {#if data.episodes[0]}<a class="watch-button" href="/watch/{data.episodes[0].id}"><Play size={16} fill="currentColor" />{data.anime.contentKind === 'film' ? 'Watch archival short' : 'Play episode 1'}</a>{/if}
        <button class="save-detail" class:saved type="button" onclick={toggleSaved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'In your library' : 'Add to library'}</button>
      </div>
    </div>
  </div>
</section>

<section class="episode-section">
  {#if data.episodes.length}
    <div class="episode-heading"><div><p class="overline">{data.anime.contentKind === 'film' ? 'ARCHIVAL FILM' : 'PLAYABLE EPISODES'}</p><h2>{data.anime.contentKind === 'film' ? 'Available film' : 'Episodes'} <span>{data.episodes.length}</span></h2></div><p>{data.anime.sourceLicense} · {data.anime.sourceName}</p></div>
  {:else}
    <div class="episode-heading"><div><p class="overline">TITLE INFORMATION</p><h2>Playback unavailable</h2></div>{#if data.anime.episodeCount}<p>MyAnimeList lists {data.anime.episodeCount} episodes; it does not provide video.</p>{:else}<p>There is no authorized video source connected for this title.</p>{/if}</div>
  {/if}
  <div class="episode-list">
    {#each data.episodes as episode (episode.id)}
      <a class="episode-row" href="/watch/{episode.id}">
        <span class="episode-number">{String(episode.number).padStart(2, '0')}</span>
        <span class="episode-play"><Play size={15} fill="currentColor" /></span>
        <span class="episode-name"><strong>{episode.title}</strong><small>{data.anime.contentKind === 'film' ? `Short film · ${durationLabel(episode.duration)}` : `Episode ${episode.number} · ${durationLabel(episode.duration)}`}</small></span>
        <span class="episode-open">WATCH <ArrowLeft size={13} /></span>
      </a>
    {/each}
  </div>
  {#if data.anime.externalUrl}<p class="content-note">{#if data.anime.sourceAttribution}{data.anime.sourceAttribution} · {/if}<a href={data.anime.externalUrl} target="_blank" rel="noreferrer">Open {data.anime.sourceName ?? 'provider'} title</a></p>{/if}
</section>

<style>
  .detail-cover { position: relative; padding: 30px clamp(22px, 5vw, 72px) 52px; background: #191c17 var(--cover-image, none) center 38% / cover no-repeat; }
  .detail-cover::before { position: absolute; inset: 0; content: ''; background: linear-gradient(90deg, rgb(14 16 13 / 96%), rgb(14 16 13 / 74%) 56%, rgb(14 16 13 / 45%)), linear-gradient(0deg, #111310, transparent 40%); }
  .back-link, .detail-hero { position: relative; z-index: 1; }
  .back-link { display: inline-flex; align-items: center; gap: 8px; color: #b9bbb0; font-size: 11px; text-decoration: none; }
  .detail-hero { display: grid; grid-template-columns: minmax(190px, 270px) minmax(0, 1fr); align-items: center; gap: clamp(28px, 5vw, 70px); max-width: 1050px; margin: 42px auto 0; }
  .detail-poster { width: 100%; aspect-ratio: 0.73; object-fit: cover; box-shadow: 0 22px 50px rgb(0 0 0 / 35%); }
  .detail-poster.poster-fallback { display: flex; flex-direction: column; justify-content: space-between; padding: 18px; background: linear-gradient(145deg, #71868a, #354c52 58%, #20251f); color: #f5f1e8; }
  .poster-fallback strong { font: 600 21px/1.2 'Playfair Display', Georgia, serif; }
  .poster-fallback small { color: rgb(245 241 232 / 75%); font-size: 10px; }
  .overline { display: flex; align-items: center; gap: 10px; margin: 0 0 15px; color: #e8785d; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; }
  h1 { max-width: 720px; margin: 0; font: 600 clamp(40px, 5.5vw, 68px)/1.02 'Playfair Display', Georgia, serif; }
  .original-title { margin: 9px 0 18px; color: #a9aa9f; font-size: 14px; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 18px; color: #c5c6bc; font-size: 11px; }
  .detail-meta span:last-child { display: inline-flex; gap: 5px; align-items: center; color: #e8c17f; }
  .genre-list { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 17px; }
  .genre-list span { border: 1px solid #4a4c43; padding: 6px 9px; color: #d0d1c7; font-size: 10px; }
  .synopsis { max-width: 570px; margin: 18px 0 22px; color: #c7c8be; font-size: 13px; line-height: 1.75; }
  .detail-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .watch-button, .save-detail { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 43px; border: 0; padding: 0 15px; font-size: 11px; font-weight: 700; text-decoration: none; cursor: pointer; }
  .watch-button { background: #e56348; color: white; }
  .save-detail { border: 1px solid #5a5c52; background: rgb(18 20 17 / 50%); color: #ecebe3; }
  .save-detail.saved { color: #f0957b; }
  .episode-section { max-width: 1050px; margin: 0 auto; padding: 30px clamp(22px, 5vw, 60px) 80px; }
  .episode-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .episode-heading .overline { margin-bottom: 8px; }
  h2 { margin: 0; font: 600 29px 'Playfair Display', Georgia, serif; }
  h2 span { margin-left: 6px; color: #8e9186; font: 400 12px 'DM Sans', sans-serif; }
  .episode-heading > p, .content-note { color: #888b81; font-size: 10px; }
  .content-note a { margin-left: 7px; color: #ee8b70; }
  .episode-list { border-top: 1px solid #33362f; }
  .episode-row { display: grid; grid-template-columns: 42px 44px 1fr auto; align-items: center; gap: 14px; min-height: 74px; border-bottom: 1px solid #33362f; color: inherit; text-decoration: none; }
  .episode-row:hover { background: #1a1d18; }
  .episode-number { color: #777a70; font: 16px 'Playfair Display', Georgia, serif; }
  .episode-play { display: grid; width: 34px; aspect-ratio: 1; place-items: center; background: #252821; color: #f08367; }
  .episode-name { display: grid; gap: 5px; }
  .episode-name strong { font-size: 12px; font-weight: 600; }
  .episode-name small { color: #8f9186; font-size: 10px; }
  .episode-open { display: flex; align-items: center; gap: 7px; color: #9b9e92; font-size: 9px; letter-spacing: 0.09em; }
  .episode-open :global(svg) { transform: rotate(180deg); color: #e8785d; }
  .content-note { margin-top: 18px; line-height: 1.6; }
  @media (max-width: 700px) { .detail-cover { padding: 24px 20px 34px; } .detail-hero { grid-template-columns: 96px minmax(0, 1fr); gap: 18px; margin-top: 28px; align-items: start; } .detail-poster { margin-top: 5px; } h1 { font-size: 36px; } .original-title { margin: 6px 0 12px; font-size: 11px; } .detail-meta { gap: 9px; font-size: 9px; } .genre-list { gap: 5px; margin-top: 10px; } .genre-list span { padding: 5px 6px; font-size: 8px; } .synopsis { grid-column: 1 / -1; margin: 0; font-size: 12px; } .detail-actions { grid-column: 1 / -1; } .watch-button, .save-detail { flex: 1; min-height: 40px; padding: 0 8px; font-size: 10px; } .episode-section { padding: 25px 20px 90px; } .episode-heading { align-items: start; flex-direction: column; gap: 7px; } .episode-row { grid-template-columns: 26px 34px minmax(0, 1fr) auto; gap: 8px; } .episode-open { font-size: 0; } }
</style>