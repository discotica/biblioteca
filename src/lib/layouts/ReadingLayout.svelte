<script module lang="ts">
  export type TocEntry = { id: string; label: string };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import Breadcrumbs, { type Crumb } from '$lib/ui/Breadcrumbs.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  type Props = {
    title: string;
    eyebrow?: string;
    /** Entrada bajo el título, un paso más grande que el texto. */
    lead?: string;
    /** Línea de datos bajo la entrada ("Última actualización: …"). */
    meta?: string;
    breadcrumbs?: Crumb[];
    /**
     * Índice: cada entrada apunta a un id dentro del contenido. Con índice la
     * página usa el contenedor ancho (índice lateral fijo en desktop y
     * desplegable "Contenido" en móvil); sin él, el estrecho.
     */
    toc?: TocEntry[];
    /** Antes del título, a la derecha en desktop (ilustración decorativa). */
    aside?: Snippet;
    children?: Snippet;
    class?: string;
  };

  let { title, eyebrow, lead, meta, breadcrumbs, toc = [], aside, children, class: className = '' }: Props = $props();

  const hasToc = $derived(toc.length > 0);
  let active = $state('');
  let mobileTocOpen = $state(false);
  let body = $state<HTMLElement>();

  onMount(() => {
    if (!hasToc || !body || typeof IntersectionObserver === 'undefined') return;
    // Marca la sección cuya parte superior está en la franja alta del viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) active = entry.target.id;
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    for (const { id } of toc) {
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    }
    return () => observer.disconnect();
  });
</script>

{#snippet tocLinks()}
  <ol class="l-reading__toc-list">
    {#each toc as entry}
      <li>
        <a
          class="l-reading__toc-link"
          href="#{entry.id}"
          aria-current={active === entry.id ? 'location' : undefined}
          onclick={() => (mobileTocOpen = false)}
        >{entry.label}</a>
      </li>
    {/each}
  </ol>
{/snippet}

<div class="l-container l-container--{hasToc ? 'wide' : 'narrow'} l-reading {className}" class:l-reading--toc={hasToc}>
  {#if breadcrumbs?.length}
    <Breadcrumbs items={breadcrumbs} class="l-reading__crumbs" />
  {/if}

  <header class="l-reading__header">
    <div class="l-reading__heading">
      {#if eyebrow}<p class="l-reading__eyebrow">{eyebrow}</p>{/if}
      <h1 class="l-reading__title">{title}</h1>
      {#if lead}<p class="l-reading__lead">{lead}</p>{/if}
      {#if meta}<p class="l-reading__meta">{meta}</p>{/if}
    </div>
    {#if aside}<div class="l-reading__aside" aria-hidden="true">{@render aside()}</div>{/if}
  </header>

  {#if hasToc}
    <nav class="l-reading__toc" aria-label="Contenido">
      <p class="l-reading__toc-heading" aria-hidden="true">Contenido</p>
      {@render tocLinks()}
    </nav>
    <details class="l-reading__toc-mobile" bind:open={mobileTocOpen}>
      <summary>
        <span>Contenido</span>
        <Icon name="chevron-abajo" size="sm" />
      </summary>
      <nav aria-label="Contenido">{@render tocLinks()}</nav>
    </details>
  {/if}

  <div class="l-reading__body" bind:this={body}>
    {@render children?.()}
  </div>
</div>

<style>
  .l-reading {
    padding-top: var(--page-pad-top);
    padding-bottom: var(--page-pad-bottom);
  }

  .l-reading--toc {
    display: grid;
    grid-template-columns: var(--reading-toc-w) minmax(0, var(--measure-reading));
    grid-template-areas:
      'crumbs crumbs'
      '. header'
      'toc body';
    column-gap: var(--space-8);
    justify-content: center;
  }
  .l-reading--toc :global(.l-reading__crumbs) { grid-area: crumbs; }
  .l-reading--toc .l-reading__header { grid-area: header; }
  .l-reading--toc .l-reading__toc { grid-area: toc; }
  .l-reading--toc .l-reading__body { grid-area: body; }
  .l-reading :global(.l-reading__crumbs) { margin: calc(var(--space-3) - var(--page-pad-top)) 0 var(--space-4); }

  /* ---- Cabecera ---------------------------------------------------------- */
  .l-reading__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-6);
    margin-bottom: var(--reading-section-gap);
    padding-bottom: var(--space-6);
    border-bottom: 1px solid var(--color-linea);
  }
  .l-reading__heading { min-width: 0; max-width: var(--measure-reading); }
  .l-reading__aside { flex: none; }

  .l-reading__eyebrow {
    margin: 0 0 var(--space-3);
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    line-height: 1.2;
    text-transform: uppercase;
  }

  .l-reading__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-display);
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: var(--leading-heading);
    text-wrap: balance;
  }

  .l-reading__lead {
    margin: var(--space-4) 0 0;
    color: var(--color-texto-alto);
    font-size: var(--text-lg);
    line-height: 1.55;
  }

  .l-reading__meta {
    margin: var(--space-4) 0 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
  }

  /* ---- Índice ------------------------------------------------------------ */
  .l-reading__toc {
    position: sticky;
    top: var(--space-6);
    align-self: start;
  }

  .l-reading__toc-heading {
    margin: 0 0 var(--space-2);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }

  .l-reading__toc-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--color-linea);
  }

  .l-reading__toc-link {
    display: flex;
    align-items: center;
    min-height: var(--target-touch);
    margin-left: -1px;
    padding: 0 var(--space-4);
    border-left: 2px solid transparent;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition: color var(--motion-fast) ease, border-color var(--motion-fast) ease;
  }
  .l-reading__toc-link:hover { color: var(--color-texto); }
  .l-reading__toc-link[aria-current='location'] {
    border-left-color: var(--color-acento);
    color: var(--color-acento);
  }

  .l-reading__toc-mobile { display: none; }

  /* ---- Texto ------------------------------------------------------------- */
  .l-reading__body {
    min-width: 0;
    max-width: var(--measure-reading);
    color: var(--color-texto-alto);
    font-size: var(--text-md);
    line-height: var(--leading-reading);
  }

  .l-reading__body :global([id]) { scroll-margin-top: var(--space-6); }

  .l-reading__body :global(section + section) { margin-top: var(--reading-section-gap); }

  .l-reading__body :global(h2) {
    margin: var(--reading-section-gap) 0 var(--space-4);
    color: var(--color-texto);
    font-size: var(--text-2xl);
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: var(--leading-heading);
  }
  .l-reading__body > :global(h2:first-child),
  .l-reading__body :global(:is(section, div) > h2:first-child) { margin-top: 0; }

  .l-reading__body :global(h3) {
    margin: var(--space-6) 0 var(--space-2);
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: 1.3;
  }

  .l-reading__body :global(p) { margin: 0 0 var(--space-4); }
  .l-reading__body :global(p:last-child) { margin-bottom: 0; }

  .l-reading__body :global(:is(ul, ol)) {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
  .l-reading__body :global(li + li) { margin-top: var(--space-2); }
  .l-reading__body :global(li::marker) { color: var(--color-acento-texto); }

  .l-reading__body :global(:is(strong, b)) { color: var(--color-texto); font-weight: 700; }

  .l-reading__body :global(a:not(.ui-btn)) {
    color: var(--color-acento);
    text-decoration: underline;
    text-decoration-color: var(--color-acento-border);
    text-underline-offset: 0.2em;
  }
  .l-reading__body :global(a:not(.ui-btn):hover) { text-decoration-color: currentColor; }

  .l-reading__body :global(code) {
    padding: 0.1em 0.35em;
    border-radius: var(--radius-xs);
    background: var(--color-superficie-2);
    font-size: var(--text-code);
  }

  @media (max-width: 1023px) {
    .l-reading--toc {
      display: block;
      max-width: var(--container-narrow);
    }
    .l-reading__toc { display: none; }
    .l-reading__toc-mobile {
      display: block;
      margin-bottom: var(--space-6);
      border: 1px solid var(--color-linea);
      border-radius: var(--radius-sm);
      background: var(--color-superficie-1);
    }
    .l-reading__toc-mobile summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: var(--target-touch);
      padding: 0 var(--space-4);
      color: var(--color-texto);
      font-size: var(--text-sm);
      font-weight: 700;
      list-style: none;
      cursor: pointer;
    }
    .l-reading__toc-mobile summary::-webkit-details-marker { display: none; }
    .l-reading__toc-mobile[open] summary :global(.ui-icon) { transform: rotate(180deg); }
    .l-reading__toc-mobile .l-reading__toc-list {
      margin: 0 var(--space-4) var(--space-3);
    }
  }

  @media (max-width: 768px) {
    .l-reading { padding-top: var(--page-pad-top-mobile); }
    .l-reading :global(.l-reading__crumbs) { margin-top: calc(var(--space-2) - var(--page-pad-top-mobile)); }
    .l-reading__aside { display: none; }
    .l-reading__header { margin-bottom: var(--space-6); padding-bottom: var(--space-5); }
  }
</style>
