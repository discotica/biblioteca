<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CoverFallback from './CoverFallback.svelte';
  import type { ReleaseRecommendation } from '$lib/domain/releaseRecommendations';
  import { coverFailure } from '$lib/ui/coverFallback';

  export let recommendations: ReleaseRecommendation[] = [];
  export let mode: 'modal' | 'page' = 'page';

  let failedCovers: Record<string, boolean> = {};

  const dispatch = createEventDispatcher<{ open: { recommendation: ReleaseRecommendation; trigger: HTMLElement | null } }>();

  function activate(event: MouseEvent, recommendation: ReleaseRecommendation) {
    if (mode !== 'modal') return;
    event.preventDefault();
    dispatch('open', {
      recommendation,
      trigger: event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    });
  }
</script>

{#if recommendations.length}
  <div class="release-recommendations" data-release-recommendation-count={recommendations.length}>
    <h3>También te puede interesar</h3>
    <div class="release-recommendations__list">
      {#each recommendations as recommendation (recommendation.release.id || recommendation.release.slug)}
        <a
          class="release-recommendation"
          data-recommendation-slot={recommendation.slot}
          data-recommendation-release-id={recommendation.release.id ?? recommendation.release.slug}
          href={`/lanzamiento/${encodeURIComponent(recommendation.release.slug)}`}
          on:click={(event) => activate(event, recommendation)}
        >
          {#if recommendation.release.coverUrl && !failedCovers[recommendation.release.coverUrl]}
            <img
              src={recommendation.release.coverUrl}
              alt=""
              loading="lazy"
              use:coverFailure={() => (failedCovers = { ...failedCovers, [recommendation.release.coverUrl]: true })}
            />
          {:else}
            <span class="release-recommendation__cover" aria-hidden="true"><CoverFallback /></span>
          {/if}
          <span class="release-recommendation__copy">
            <span class="release-recommendation__title">{recommendation.release.title}</span>
            {#if recommendation.artist}<span class="release-recommendation__artist">{recommendation.artist}</span>{/if}
          </span>
          <span class="release-recommendation__arrow" aria-hidden="true">→</span>
        </a>
      {/each}
    </div>
  </div>
{/if}

<style>
  .release-recommendations {
    padding-top: .25rem;
    border-top: 1px solid var(--color-linea-sutil);
  }

  .release-recommendations h3 {
    margin: .9rem 0 .65rem;
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .release-recommendations__list { display: grid; gap: .45rem; }

  .release-recommendation {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    align-items: center;
    gap: .75rem;
    min-width: 0;
    padding: .5rem;
    border: 1px solid var(--color-linea-sutil);
    border-radius: var(--radius-sm);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-fast) ease, background var(--motion-fast) ease;
  }

  .release-recommendation:hover,
  .release-recommendation:focus-visible {
    border-color: var(--color-acento-border);
    background: var(--color-acento-tinte);
  }

  .release-recommendation img,
  .release-recommendation__cover {
    display: block;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-xs);
    object-fit: cover;
    background: linear-gradient(135deg, var(--color-panel-raised), var(--color-panel));
  }

  .release-recommendation__copy { min-width: 0; }
  .release-recommendation__title,
  .release-recommendation__artist {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .release-recommendation__title { color: var(--color-texto); font-size: var(--text-xs); font-weight: 700; }
  .release-recommendation__artist { margin-top: .12rem; color: var(--color-texto-tenue); font-size: var(--text-2xs); }
  .release-recommendation__arrow { color: var(--color-acento-texto); }
</style>
