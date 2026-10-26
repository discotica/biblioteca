<script context="module" lang="ts">
  let nextSessionId = 0;
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Release } from '$lib/domain/releases';
  import { releasePlayerConfig } from '$lib/domain/releaseDetail';

  export let release: Release;

  const sessionId = `release-player-${++nextSessionId}`;
  let wrapper: HTMLElement;
  let iframe: HTMLIFrameElement;
  let loaded = false;
  let failed = false;
  let scrollRegion: HTMLElement | null = null;
  let scrollSnapshot: number | null = null;
  let lastStableScrollTop = 0;
  let restoreUntil = 0;
  let resizeObserver: ResizeObserver | null = null;
  let restoreFrame = 0;
  let secondRestoreFrame = 0;
  let stabilizeFrame = 0;
  let stabilizeUntil = 0;
  let stableScrollTimer = 0;
  let pointerInside = false;
  let iframeGuardActive = false;

  $: player = releasePlayerConfig(release);

  function findScrollRegion(node: HTMLElement): HTMLElement {
    let current = node.parentElement;
    while (current) {
      const style = getComputedStyle(current);
      if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current;
      current = current.parentElement;
    }
    return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
  }

  // The scrolling ancestor depends on surface and breakpoint (modal column,
  // mobile modal layout or the document) and on content that may load after
  // mount, so it is resolved again on every interaction. Switching regions
  // takes the new region's position as its stable one.
  function resolveScrollRegion() {
    if (!wrapper) return;
    const next = findScrollRegion(wrapper);
    if (next === scrollRegion) return;
    scrollRegion = next;
    lastStableScrollTop = next.scrollTop;
  }

  function rememberScroll(duration = 1600) {
    resolveScrollRegion();
    if (!scrollRegion) return;
    scrollSnapshot = scrollRegion.scrollTop;
    lastStableScrollTop = scrollSnapshot;
    restoreUntil = performance.now() + duration;
  }

  function armFromStableScroll(duration = 1600) {
    resolveScrollRegion();
    if (!scrollRegion) return;
    scrollSnapshot = lastStableScrollTop;
    restoreUntil = performance.now() + duration;
  }

  // Captured on document: document scrolling dispatches `scroll` on document,
  // never on document.scrollingElement, so a listener on the region itself
  // left the stable position at its mount value (0) and the guard "restored"
  // the page to the top when a touch or keyboard focus entered the iframe.
  function handleScroll(event: Event) {
    const target = event.target === document ? document.scrollingElement : event.target;
    if (!(target instanceof HTMLElement) || !wrapper || !target.contains(wrapper)) return;
    if (target !== scrollRegion) resolveScrollRegion();
    if (!scrollRegion || target !== scrollRegion) return;

    if (
      iframeGuardActive &&
      document.activeElement === iframe &&
      (pointerInside || performance.now() <= stabilizeUntil) &&
      scrollSnapshot !== null &&
      Math.abs(scrollRegion.scrollTop - scrollSnapshot) > 1
    ) {
      scrollRegion.scrollTop = scrollSnapshot;
      return;
    }

    const next = scrollRegion.scrollTop;
    window.clearTimeout(stableScrollTimer);
    stableScrollTimer = window.setTimeout(() => {
      lastStableScrollTop = next;
    }, 120);
  }

  function restoreScrollInFollowingFrames() {
    if (!scrollRegion || scrollSnapshot === null || performance.now() > restoreUntil) return;
    const region = scrollRegion;
    const top = scrollSnapshot;
    cancelAnimationFrame(restoreFrame);
    cancelAnimationFrame(secondRestoreFrame);
    restoreFrame = requestAnimationFrame(() => {
      if (Math.abs(region.scrollTop - top) > 1) region.scrollTop = top;
      secondRestoreFrame = requestAnimationFrame(() => {
        if (Math.abs(region.scrollTop - top) > 1) region.scrollTop = top;
      });
    });
  }

  function stabilizeScroll(duration = 900) {
    if (!scrollRegion || scrollSnapshot === null) return;
    stabilizeUntil = Math.max(stabilizeUntil, performance.now() + duration);
    cancelAnimationFrame(stabilizeFrame);

    const tick = () => {
      if (!scrollRegion || scrollSnapshot === null || performance.now() > stabilizeUntil) return;
      if (Math.abs(scrollRegion.scrollTop - scrollSnapshot) > 1) {
        scrollRegion.scrollTop = scrollSnapshot;
      }
      stabilizeFrame = requestAnimationFrame(tick);
    };

    stabilizeFrame = requestAnimationFrame(tick);
  }

  function handleLoad() {
    loaded = true;
    failed = false;
    restoreScrollInFollowingFrames();
    stabilizeScroll();
  }

  function handleError() {
    loaded = false;
    failed = true;
    restoreScrollInFollowingFrames();
  }

  function handleWindowBlur() {
    requestAnimationFrame(() => {
      if (document.activeElement !== iframe) return;
      // SoundCloud may move the scroll container before the window blur is
      // observable. Never overwrite the pre-interaction snapshot here.
      armFromStableScroll();
      iframeGuardActive = true;
      restoreScrollInFollowingFrames();
      stabilizeScroll();
    });
  }

  function handlePointerEnter() {
    pointerInside = true;
    rememberScroll();
    if (document.activeElement === iframe) iframeGuardActive = true;
  }

  function handlePointerLeave() {
    pointerInside = false;
    iframeGuardActive = false;
    cancelAnimationFrame(stabilizeFrame);
  }

  function handleIframeFocus() {
    armFromStableScroll();
    iframeGuardActive = true;
    restoreScrollInFollowingFrames();
    stabilizeScroll();
  }

  onMount(() => {
    // ReleasePlayer remains mounted as the shared slot even when a release has
    // no supported provider. In that state the conditional wrapper does not
    // exist, so there is no scroll guard to install.
    if (!wrapper) return;
    resolveScrollRegion();
    resizeObserver = new ResizeObserver(() => restoreScrollInFollowingFrames());
    resizeObserver.observe(wrapper);
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('blur', handleWindowBlur);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (typeof document !== 'undefined') document.removeEventListener('scroll', handleScroll, { capture: true });
    window.removeEventListener('blur', handleWindowBlur);
    window.clearTimeout(stableScrollTimer);
    cancelAnimationFrame(restoreFrame);
    cancelAnimationFrame(secondRestoreFrame);
    cancelAnimationFrame(stabilizeFrame);
  });
</script>

{#if player}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="release-player"
    class:release-player--failed={failed}
    bind:this={wrapper}
    data-release-player={player.provider}
    data-player-session={sessionId}
    data-player-height={player.height}
    data-player-loaded={loaded}
    data-player-failed={failed}
    style={`--player-height: ${player.height}px`}
    on:pointerenter={handlePointerEnter}
    on:pointerleave={handlePointerLeave}
    on:pointerdown={() => rememberScroll()}
  >
    <div class="release-player__frame" aria-busy={!loaded && !failed}>
      <iframe
        bind:this={iframe}
        title={player.title}
        src={player.src}
        height={player.height}
        loading="eager"
        scrolling="no"
        frameborder="0"
        allow={player.allow}
        on:focus={handleIframeFocus}
        on:load={handleLoad}
        on:error={handleError}
      ></iframe>
      {#if !loaded && !failed}
        <span class="sr-only" role="status">Cargando reproductor de {player.provider}</span>
      {/if}
    </div>

    {#if failed}
      <p class="release-player__error" role="alert">
        No pudimos cargar el reproductor.
        <a href={release.buyLink} target="_blank" rel="noopener noreferrer">Abrir en {player.provider}</a>
      </p>
    {/if}
  </div>
{/if}

<style>
  .release-player {
    width: 100%;
    min-width: 0;
    border-radius: var(--radius-sm);
    background: var(--color-sombra);
    overflow: hidden;
    overflow-anchor: none;
  }

  .release-player__frame {
    width: 100%;
    height: var(--player-height);
    min-height: var(--player-height);
    overflow: hidden;
    overflow-anchor: none;
  }

  iframe {
    display: block;
    width: 100%;
    height: var(--player-height);
    border: 0;
    color-scheme: dark;
  }

  .release-player__error {
    margin: 0;
    padding: .85rem 1rem;
    font-size: var(--text-2xs);
    line-height: 1.5;
    color: var(--color-texto-medio);
    border-top: 1px solid var(--color-linea);
  }

  .release-player__error a {
    color: var(--color-acento);
    font-weight: 700;
  }
</style>
