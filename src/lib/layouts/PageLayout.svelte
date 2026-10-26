<script lang="ts">
  import type { Snippet } from 'svelte';
  import Breadcrumbs, { type Crumb } from '$lib/ui/Breadcrumbs.svelte';
  import type { ContainerSize } from './Container.svelte';

  type Props = {
    /** Ancho de la página. Por defecto, wide (catálogo). */
    container?: ContainerSize;
    /** Patrón de retorno: del más general a la página actual, que va al final. */
    breadcrumbs?: Crumb[];
    /** Antetítulo corto en mayúsculas (sección o tipo de página). */
    eyebrow?: string;
    /** Título visible (h1). Sin título no hay cabecera: la vista pone su propio h1 (la ficha). */
    title?: string;
    titleId?: string;
    /** Una o dos frases bajo el título. */
    description?: string;
    /** Antes del título: el avatar de un perfil. */
    leading?: Snippet;
    /** Bajo el título y la descripción: datos, insignias, redes. */
    meta?: Snippet;
    /** Acciones de la página, a la derecha del título (abajo en móvil). */
    actions?: Snippet;
    children?: Snippet;
    class?: string;
  };

  let {
    container = 'wide',
    breadcrumbs,
    eyebrow,
    title,
    titleId,
    description,
    leading,
    meta,
    actions,
    children,
    class: className = ''
  }: Props = $props();
</script>

<div class="l-container l-container--{container} l-page {className}" class:l-page--crumbs={breadcrumbs?.length}>
  {#if breadcrumbs?.length}
    <Breadcrumbs items={breadcrumbs} class="l-page__crumbs" />
  {/if}

  {#if title}
    <header class="l-page__header">
      {#if leading}<div class="l-page__leading">{@render leading()}</div>{/if}
      <div class="l-page__heading">
        {#if eyebrow}<p class="l-page__eyebrow">{eyebrow}</p>{/if}
        <h1 class="l-page__title" id={titleId}>{title}</h1>
        {#if description}<p class="l-page__description">{description}</p>{/if}
        {#if meta}<div class="l-page__meta">{@render meta()}</div>{/if}
      </div>
      {#if actions}<div class="l-page__actions">{@render actions()}</div>{/if}
    </header>
  {/if}

  {@render children?.()}
</div>

<style>
  .l-page {
    padding-top: var(--page-pad-top);
    padding-bottom: var(--page-pad-bottom);
  }

  /* Las migas (44 px de área táctil) ocupan la franja superior. */
  .l-page--crumbs { padding-top: var(--space-3); }
  .l-page :global(.l-page__crumbs) { margin-bottom: var(--space-4); }

  .l-page__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-4) var(--space-5);
    margin-bottom: var(--page-header-gap);
  }

  .l-page__leading { flex: none; align-self: center; }

  .l-page__heading {
    flex: 1 1 20rem;
    min-width: 0;
  }

  .l-page__eyebrow {
    margin: 0 0 var(--space-2);
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    line-height: 1.2;
    text-transform: uppercase;
  }

  .l-page__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-3xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: var(--leading-heading);
    overflow-wrap: anywhere;
  }

  .l-page__description {
    max-width: var(--measure-reading);
    margin: var(--space-3) 0 0;
    color: var(--color-texto-medio);
    font-size: var(--text-md);
    line-height: 1.55;
  }

  .l-page__meta {
    margin-top: var(--space-3);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
  }

  .l-page__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  /* Acciones condicionales (p. ej. solo en el perfil propio): sin contenido, no ocupan fila. */
  .l-page__actions:not(:has(*)) { display: none; }

  @media (max-width: 768px) {
    .l-page { padding-top: var(--page-pad-top-mobile); }
    .l-page--crumbs { padding-top: var(--space-2); }
  }
</style>
