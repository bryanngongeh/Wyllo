<svelte:head><title>Settings | Wyllo Player</title></svelte:head>

<section class="settings-page">
  <p class="overline">YOUR EXPERIENCE</p>
  <h1>Settings</h1>
  <div class="setting-row"><div><strong>Catalog providers</strong><p>AniList supplies anime and manga title metadata, search, and trending results.</p></div><span class="status">CONNECTED</span></div>
  <div class="setting-row"><div><strong>Library & progress</strong><p>Saved to your account when signed in; otherwise kept in this browser.</p></div><span class="status">PRIVATE</span></div>
  <div class="setting-row"><div><strong>Media availability</strong><p>Playback and chapter pages require separate providers authorized for the content.</p></div><a href="/">Browse catalog</a></div>
</section>

<style>
  .settings-page { max-width: 940px; margin: 0 auto; padding: 58px clamp(22px, 5vw, 72px) 100px; }
  .overline { margin: 0 0 10px; color: #e8785d; font-size: 9px; font-weight: 700; letter-spacing: 0.15em; }
  h1 { margin: 0 0 32px; font: 600 48px/1.05 'Playfair Display', Georgia, serif; }
  .setting-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; border-top: 1px solid #34372f; padding: 21px 0; }
  .setting-row strong { font-size: 12px; }
  .setting-row p { margin: 7px 0 0; color: #9b9d93; font-size: 10px; line-height: 1.6; }
  .setting-row a { color: #e8785d; font-size: 10px; }
  .status { border: 1px solid #44473e; padding: 6px 8px; color: #9fa196; font-size: 8px; white-space: nowrap; }
  @media (max-width: 700px) { .settings-page { padding: 38px 20px 100px; } h1 { font-size: 39px; } }
</style>