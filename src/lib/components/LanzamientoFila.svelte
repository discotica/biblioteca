<script lang="ts">
  // Fila del modo lista (U8): las piezas de la tarjeta en versión densa.
  //
  // Portada · créditos, título y datos en tres líneas · compartir, en todos los
  // anchos. Sin géneros: en una columna propia se recortaban (decisión del
  // equipo durante U10, que prefirió la composición móvil).
  //
  // Sin radar: a 56 px no se lee. Toda la fila abre la ficha (el enlace del
  // título se estira sobre ella), también la miniatura. Todas las filas miden
  // lo mismo.
  import { page } from '$app/stores';
  import { Cover, CreditLine } from '$lib/ui';
  import type { Release } from '$lib/domain/releases';
  import DatosLanzamiento from './lanzamiento/DatosLanzamiento.svelte';
  import CompartirLanzamiento from './lanzamiento/CompartirLanzamiento.svelte';
  import { artistHref, isModifiedClick, releaseHref, summarizeRelease } from './lanzamiento/lanzamiento';

  type Props = {
    lanzamiento: Release;
    /** Abre la ficha en el modal. Sin él, el título y la portada navegan a la página. */
    onabrir?: (lanzamiento: Release) => void;
    class?: string;
  };

  let { lanzamiento, onabrir, class: className = '' }: Props = $props();

  const search = $derived($page?.url?.search ?? '');
  const datos = $derived(summarizeRelease(lanzamiento));
  const href = $derived(releaseHref(datos.slug, search));

  function onOpenClick(event: MouseEvent) {
    if (!onabrir || isModifiedClick(event)) return;
    event.preventDefault();
    onabrir(lanzamiento);
  }
</script>

<article class="fila {className}">
  <div class="fila__portada" aria-hidden="true">
    <Cover src={datos.cover} alt="" radius="sm" />
  </div>

  <div class="fila__principal">
    <div class="fila__creditos">
      <CreditLine release={lanzamiento} hrefFor={artistHref(search)} />
    </div>
    <h3 class="fila__titulo">
      <a class="fila__titulo-enlace" {href} title={datos.title} aria-label={`Abrir ${datos.title || 'lanzamiento'}`} onclick={onOpenClick}>{datos.title}</a>
    </h3>
  </div>

  <DatosLanzamiento class="fila__datos" year={datos.year} country={datos.country} label={datos.label} {search} />
  <CompartirLanzamiento class="fila__compartir" slug={datos.slug} />
</article>

<style>
  .fila {
    position: relative;
    display: grid;
    grid-template-columns: var(--row-cover) minmax(0, 1fr) auto;
    grid-template-areas:
      'portada principal compartir'
      'portada datos compartir';
    align-items: center;
    column-gap: var(--space-3);
    min-height: calc(var(--row-cover) + 2 * var(--space-2));
    box-sizing: border-box;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-2);
    border-bottom: 1px solid var(--color-linea-sutil);
    transition: background var(--motion-fast) var(--ease-standard);
  }
  .fila:hover { background: var(--color-superficie-1); }

  .fila__portada { grid-area: portada; align-self: center; }
  .fila__principal { grid-area: principal; min-width: 0; align-self: end; }
  .fila :global(.fila__datos) { grid-area: datos; align-self: start; }
  .fila :global(.fila__compartir) { grid-area: compartir; }

  .fila__creditos {
    display: flex;
    align-items: center;
    min-width: 0;
    height: calc(var(--text-xs) * 1.4);
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .fila__titulo {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto);
    font-size: var(--text-sm);
    font-weight: 650;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fila__titulo-enlace { color: inherit; text-decoration: none; }
  .fila__titulo-enlace:hover { color: var(--color-texto-alto); }
  .fila__titulo-enlace:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; border-radius: var(--radius-xs); }
  .fila__titulo-enlace::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: pointer;
  }

  /* Créditos, país, sello, géneros y compartir, sobre el enlace estirado. */
  .fila :global(a:not(.fila__titulo-enlace)),
  .fila :global(button) {
    position: relative;
    z-index: 2;
  }
</style>
