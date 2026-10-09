<script lang="ts">
  import { onMount } from 'svelte';
  import '../styles.css';
  import { Search, ArrowRight, House, Clapperboard, BookOpen, PanelsTopLeft, Settings, Bookmark, LogIn, LogOut } from 'lucide-svelte';
  import { library } from '$lib/library';
  import { authState, initializeAuth0, login, logout } from '$lib/auth';
  import { syncPersonalData } from '$lib/library';

  let query = '';

  onMount(() => { void initializeAuth0().then(syncPersonalData); });
</script>

<div class="app-frame">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Wyllo Player home">
      <span class="brand-mark">W</span><span>WYLLO<span class="brand-light">PLAYER</span></span>
    </a>
    <form class="top-search" action="/search" method="GET">
      <Search size={17} strokeWidth={1.8} />
      <input bind:value={query} name="q" placeholder="Find a story, a feeling..." aria-label="Search anime and manga" />
      <button type="submit" aria-label="Search" title="Search"><ArrowRight size={15} /></button>
    </form>
    <div class="account-actions">
      {#if $authState.loading}
        <span class="auth-loading" aria-label="Loading account"></span>
      {:else if $authState.isAuthenticated}
        <button class="account-button" type="button" title="Sign out" aria-label="Sign out" onclick={logout}>
          {#if $authState.user?.picture}<img src={$authState.user.picture} alt="" />{:else}<LogOut size={16} />{/if}
        </button>
      {:else}
        <button class="auth-button" type="button" disabled={!$authState.configured} title={$authState.configured ? 'Sign in' : 'Configure Auth0 to enable sign-in'} onclick={login}><LogIn size={16} /><span>Sign in</span></button>
      {/if}
    </div>
  </header>

  <aside class="sidebar">
    <p class="nav-caption">YOUR SPACE</p>
    <nav aria-label="Main navigation">
      <a href="/"><House size={17} />Home</a>
      <a href="/search?type=anime"><Clapperboard size={17} />Anime</a>
      <a href="/search?type=manga"><BookOpen size={17} />Manga</a>
      <a href="/comics"><PanelsTopLeft size={17} />Comics</a>
      <a href="/library"><Bookmark size={17} />My library <span class="nav-count">{$library.length || ''}</span></a>
    </nav>
    <div class="sidebar-foot">
      <span class="live-dot"></span><span>OPEN ARCHIVE</span>
      <a href="/settings" aria-label="Settings"><Settings size={16} /></a>
    </div>
  </aside>

  <main class="main-content"><slot /></main>

  <nav class="mobile-nav" aria-label="Mobile navigation">
    <a href="/"><House size={19} /><span>Home</span></a>
    <a href="/search?type=anime"><Clapperboard size={19} /><span>Anime</span></a>
    <a href="/search?type=manga"><BookOpen size={19} /><span>Manga</span></a>
    <a href="/comics"><PanelsTopLeft size={19} /><span>Comics</span></a>
    <a href="/library"><Bookmark size={19} /><span>Library</span></a>
  </nav>
</div>