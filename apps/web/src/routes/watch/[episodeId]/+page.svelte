<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, Maximize, SkipBack, SkipForward } from 'lucide-svelte';
  import type { Episode, MediaSummary, VideoSource } from '@wyllo/domain';
  import { getProgress, saveProgress } from '$lib/library';

  export let data: { anime: MediaSummary; episode: Episode; source: VideoSource };
  let player: HTMLVideoElement;
  let resumed = false;
  let lastSavedSecond = -1;

  function restore() {
    const percent = getProgress(data.episode.id);
    if (percent > 0 && player.duration) {
      player.currentTime = player.duration * percent / 100;
      resumed = true;
    }
  }

  function persist() {
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return;
    const second = Math.floor(player.currentTime);
    if (second === lastSavedSecond || second % 5 !== 0) return;
    lastSavedSecond = second;
    const percent = Math.round(player.currentTime / player.duration * 100);
    saveProgress(data.episode.id, percent);
    saveProgress(data.anime.id, percent);
  }

  function seek(delta: number) { player.currentTime = Math.max(0, Math.min(player.duration || 0, player.currentTime + delta)); }
  function fullscreen() { player.requestFullscreen?.(); }

  onMount(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowLeft') seek(-10);
      if (event.key === 'ArrowRight') seek(10);
      if (event.key === ' ' && player) { event.preventDefault(); player.paused ? void player.play() : player.pause(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<svelte:head><title>{data.anime.title} | Wyllo Player</title></svelte:head>

<section class="watch-page">
  <header class="watch-header"><a href="/anime/{data.anime.id}"><ArrowLeft size={16} /> <span>{data.anime.title}</span></a><span class="source-tag">{data.source.label}</span></header>
  <div class="player-frame">
    <video bind:this={player} controls playsinline preload="metadata" onloadedmetadata={restore} ontimeupdate={persist}>
      <source src={data.source.url} type="video/mp4" />
      Your browser does not support HTML video.
    </video>
    {#if resumed}<span class="resume-notice">RESUMED FROM YOUR LAST POSITION</span>{/if}
    <div class="quick-controls"><button type="button" aria-label="Back 10 seconds" onclick={() => seek(-10)}><SkipBack size={17} />10</button><button type="button" aria-label="Forward 10 seconds" onclick={() => seek(10)}><SkipForward size={17} />10</button><button type="button" aria-label="Fullscreen" onclick={fullscreen}><Maximize size={17} /></button></div>
  </div>
  <div class="episode-info"><div><p class="overline">{data.source.licenseName}</p><h1>{data.episode.title}</h1><p class="subline">{data.anime.title} <span>·</span> {data.anime.year ?? 'Year not listed'} archival short · {Math.round(data.episode.duration)} min</p></div><div class="source-badges"><span>{data.source.language}</span><span>{data.source.resolution}</span><a href={data.source.externalUrl} target="_blank" rel="noreferrer">Source record <ArrowLeft size={12} /></a></div></div>
  <p class="license-note">{data.source.attribution} <a href={data.source.licenseUrl} target="_blank" rel="noreferrer">License</a></p>
</section>

<style>
  .watch-page { max-width: 1280px; margin: 0 auto; padding: 28px clamp(18px, 4vw, 55px) 80px; }
  .watch-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 17px; }
  .watch-header a { display: inline-flex; align-items: center; gap: 9px; color: #d0d1c6; font-size: 12px; text-decoration: none; }
  .source-tag { border: 1px solid #6e493e; padding: 5px 7px; color: #e78b72; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; }
  .player-frame { position: relative; background: #050605; }
  video { display: block; width: 100%; max-height: min(70vh, 720px); aspect-ratio: 16 / 9; background: #050605; }
  .resume-notice { position: absolute; top: 14px; left: 14px; border: 1px solid #77766b; padding: 7px 10px; background: rgb(10 11 9 / 78%); color: #ecebe3; font-size: 8px; letter-spacing: 0.1em; pointer-events: none; }
  .quick-controls { position: absolute; right: 12px; bottom: 50px; display: flex; gap: 5px; opacity: 0.5; transition: opacity 150ms ease; }
  .player-frame:hover .quick-controls { opacity: 1; }
  .quick-controls button { display: flex; align-items: center; gap: 4px; height: 32px; border: 1px solid #585a50; padding: 0 8px; background: rgb(12 13 11 / 80%); color: white; font-size: 9px; cursor: pointer; }
  .episode-info { display: flex; justify-content: space-between; align-items: end; gap: 20px; padding: 25px 0 14px; border-bottom: 1px solid #34372f; }
  .overline { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; color: #e8785d; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; }
  h1 { margin: 0; font: 600 30px/1.1 'Playfair Display', Georgia, serif; }
  .subline { margin: 9px 0 0; color: #999b91; font-size: 11px; }
  .subline span { margin: 0 6px; color: #64675e; }
  .source-badges { display: flex; flex-wrap: wrap; justify-content: end; gap: 6px; }
  .source-badges span { border: 1px solid #41443b; padding: 7px 9px; color: #bdc0b4; font-size: 9px; }
  .source-badges a, .license-note a { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #41443b; padding: 7px 9px; color: #f0967b; font-size: 9px; text-decoration: none; }
  .license-note a { margin-left: 8px; border: 0; padding: 0; font-size: inherit; }
  .license-note { margin-top: 14px; color: #85877e; font-size: 10px; line-height: 1.6; }
  @media (max-width: 700px) { .watch-page { padding: 20px 0 90px; } .watch-header, .episode-info, .license-note { margin-right: 18px; margin-left: 18px; } .player-frame video { aspect-ratio: 16 / 10; } .quick-controls { bottom: 45px; opacity: 1; } .episode-info { align-items: start; flex-direction: column; } h1 { font-size: 25px; } .source-badges { justify-content: start; } }
</style>