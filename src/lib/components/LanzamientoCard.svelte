<script lang="ts">
  // Tarjeta de lanzamiento (U8). Piezas compartidas con la fila del modo lista
  // (LanzamientoFila): PortadaRadar, CreditLine, DatosLanzamiento,
  // GenerosLanzamiento y CompartirLanzamiento.
  //
  // Altura estable: créditos, datos y géneros ocupan siempre una línea, aunque
  // estén vacíos o el texto sea largo; el título, una o dos. Las tarjetas de una
  // misma fila de la grilla miden lo mismo (la celda se estira) y sus datos y
  // géneros quedan alineados abajo; el aire de un título corto queda entre el
  // título y los datos, solo si una vecina tiene dos líneas.
  //
  // Toda el área de información abre el lanzamiento: el enlace del título se
  // estira sobre ella y los demás controles quedan por encima (E04/R2).
  import { page } from '$app/stores';
  import { CreditLine } from '$lib/ui';
  import type { Release } from '$lib/domain/releases';
  import PortadaRadar from './lanzamiento/PortadaRadar.svelte';
  import DatosLanzamiento from './lanzamiento/DatosLanzamiento.svelte';
  import GenerosLanzamiento from './lanzamiento/GenerosLanzamiento.svelte';
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
  const open = $derived(onabrir ? () => onabrir(lanzamiento) : undefined);

  function onTitleClick(event: MouseEvent) {
    if (!open || isModifiedClick(event)) return;
    event.preventDefault();
    open();
  }
</script>

<article class="card card--grid {className}">
  <PortadaRadar class="card__portada" {href} cover={datos.cover} radar={datos.radar} onopen={open} ambient />

  <div class="card__info">
    <div class="card__creditos">
      <CreditLine release={lanzamiento} hrefFor={artistHref(search)} />
    </div>

    <div class="card__cabecera">
      <h3 class="card__titulo">
        <a class="card__titulo-enlace" {href} title={datos.title} aria-label={`Abrir ${datos.title || 'lanzamiento'}`} onclick={onTitleClick}>{datos.title}</a>
      </h3>
      <CompartirLanzamiento slug={datos.slug} />
    </div>

    <DatosLanzamiento year={datos.year} country={datos.country} label={datos.label} {search} />
    <GenerosLanzamiento genres={datos.genres} more={datos.moreGenres} {search} />
  </div>
</article>

<style>
  .card {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    margin: 0;
    padding: 0;
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-base);
    background: var(--color-panel);
    transition: border-color var(--motion-base) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard);
  }
  .card:hover {
    border-color: var(--color-borde-hover);
    box-shadow: 0 8px 32px var(--color-sombra-fuerte);
  }

  /* El fondo ambiental de la portada (Cover ambient) se aviva al pasar. */
  .card :global(.ui-cover__ambient) { transition: opacity var(--motion-slow) var(--ease-standard); }
  .card:hover :global(.ui-cover__ambient) { opacity: calc(var(--cover-ambient-opacity) * 1.6); }

  .card__info {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--card-pad);
  }

  /* Una línea siempre, también sin créditos o con "Varios artistas". */
  .card__creditos {
    display: flex;
    align-items: center;
    min-width: 0;
    height: calc(var(--text-xs) * 1.4);
    margin-block-end: calc(var(--space-1) - var(--space-2));
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .card__cabecera {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-block-end: auto;
  }

  /* Entre el 16 px de E04 y el --text-3xl que se veía (decisión del equipo,
     2026-10-07). Hasta dos líneas; uno más largo se recorta con elipsis y se
     lee completo en la ayuda y en la ficha. */
  .card__titulo {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-2xl);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.015em;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--card-title-lines);
    line-clamp: var(--card-title-lines);
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .card__titulo-enlace {
    color: inherit;
    text-decoration: none;
    transition: color var(--motion-fast) var(--ease-standard);
  }
  .card__titulo-enlace:hover { color: var(--color-texto-alto); }
  .card__titulo-enlace:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; border-radius: var(--radius-xs); }
  .card__titulo-enlace::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: pointer;
  }

  /* Créditos, compartir, país, sello y géneros, sobre el enlace estirado. */
  .card__info :global(a:not(.card__titulo-enlace)),
  .card__info :global(button) {
    position: relative;
    z-index: 2;
  }
</style>
