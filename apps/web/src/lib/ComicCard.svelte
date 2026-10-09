<script lang="ts">
  import { BookOpen, ExternalLink } from 'lucide-svelte';
  import type { ComicSummary } from '@wyllo/domain';

  export let comic: ComicSummary;
</script>

<article class="comic-card">
  <a class="cover" href={comic.detailUrl} target="_blank" rel="noreferrer" aria-label="View {comic.title} at Open Library">
    {#if comic.coverUrl}<img src={comic.coverUrl} alt="" loading="lazy" />{:else}<span class="cover-fallback">{comic.title}</span>{/if}
  </a>
  <div class="comic-info">
    <h2><a href={comic.detailUrl} target="_blank" rel="noreferrer">{comic.title}</a></h2>
    <p>{comic.authors.join(', ') || 'Author not listed'}{#if comic.firstPublishYear}<span> · </span>{comic.firstPublishYear}{/if}</p>
    <div class="comic-actions">
      {#if comic.readUrl}<a class="read-link" href={comic.readUrl} target="_blank" rel="noreferrer"><BookOpen size={14} />Read on Open Library</a>{/if}
      <a class="source-link" href={comic.detailUrl} target="_blank" rel="noreferrer" aria-label="Open source record"><ExternalLink size={14} /></a>
    </div>
  </div>
</article>

<style>
  .comic-card { min-width: 0; }
  .cover { display: grid; aspect-ratio: 0.72; place-items: center; overflow: hidden; background: #252821; color: #e9e8df; text-decoration: none; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .cover-fallback { padding: 20px; font: 600 19px/1.2 'Playfair Display', Georgia, serif; text-align: center; }
  .comic-info { padding-top: 11px; }
  h2 { overflow: hidden; margin: 0; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  h2 a { text-decoration: none; }
  .comic-info p { overflow: hidden; margin: 6px 0 0; color: #999b90; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .comic-info p span { color: #60635b; }
  .comic-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
  .read-link, .source-link { display: inline-flex; min-height: 30px; align-items: center; justify-content: center; gap: 7px; color: #e98a70; font-size: 9px; text-decoration: none; }
  .source-link { width: 30px; border: 1px solid #41443b; }
</style>