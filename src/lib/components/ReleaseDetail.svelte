<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import AddToCrateButton from './AddToCrateButton.svelte';
  import RadarMini from './RadarMini.svelte';
  import ReleasePlayer from './ReleasePlayer.svelte';
  import CompartirLanzamiento from './lanzamiento/CompartirLanzamiento.svelte';
  import { filterHref, isModifiedClick } from './lanzamiento/lanzamiento';
  import type { Release } from '$lib/domain/releases';
  import { formatReleaseDateEsCo } from '$lib/domain/releaseDetail';
  import Button from '$lib/ui/Button.svelte';
  import Chip from '$lib/ui/Chip.svelte';
  import Cover from '$lib/ui/Cover.svelte';
  import CreditLine from '$lib/ui/CreditLine.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import { FICHA_WIDE_QUERY } from '$lib/ui/breakpoints';
  import { slugify } from '$lib/utils/slugify';

  /**
   * Ficha única de modal y página (E16, U9). El modo solo cambia la semántica
   * del título (h2 en el diálogo, h1 en la página) y de dónde sale el alto.
   * decisiones.md, "Ficha (2026-10-07, durante U9)":
   *
   * - desde 768 (dos columnas): arriba, la portada en una columna cuadrada
   *   (--ficha-cover) con un marco uniforme, y la información con scroll
   *   interno; al pie, la barra de acciones a todo el ancho. El modal fija
   *   --ficha-cover según el viewport; la página lo calcula aquí con el ancho
   *   del contenedor y el alto que queda bajo las migas;
   * - por debajo: una columna, portada enmarcada a todo el ancho y la barra
   *   fija abajo, con el área segura.
   */
  export let release: Release;
  export let mode: 'modal' | 'page' = 'page';
  export let titleId = '';

  let menuLayer: HTMLElement;
  // La línea de acciones mide 455 px en md: cabe en la barra desde 768.
  // En la barra de una columna (390 px) va en sm, con el área táctil de 44.
  let wide = browser && window.matchMedia(FICHA_WIDE_QUERY).matches;

  $: resolvedTitleId = titleId || `release-title-${release.slug}-${mode}`;
  $: date = formatReleaseDateEsCo(release.releaseDate);
  $: hasRadar = Object.values(release.radar).some((value) => value > 0);
  $: actionSize = (wide ? 'md' : 'sm') as 'md' | 'sm';
  $: search = $page.url.search;
  $: reportHref = `/reportar${release.id ? `?release_id=${encodeURIComponent(release.id)}` : ''}`;

  function followFilter(event: MouseEvent, href: string) {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    void goto(href, { invalidateAll: true, noScroll: false });
  }

  onMount(() => {
    const query = window.matchMedia(FICHA_WIDE_QUERY);
    const sync = () => (wide = query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  });

  /**
   * Página: dónde empieza la ficha en el documento (bajo el header y las
   * migas). El CSS resta ese valor del alto del viewport para que, desde 1024,
   * la ficha entera quepa en pantalla.
   */
  function measureTop(node: HTMLElement, enabled: boolean) {
    let frame = 0;
    const apply = () => {
      if (!enabled) return node.style.removeProperty('--ficha-top');
      const top = node.getBoundingClientRect().top + window.scrollY;
      node.style.setProperty('--ficha-top', `${Math.max(0, Math.round(top))}px`);
    };
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    // Al montar, en el mismo cuadro: sin un primer pintado con otro alto.
    apply();
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return {
      update(next: boolean) {
        enabled = next;
        measure();
      },
      destroy() {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', measure);
      }
    };
  }
</script>

<article
  class="release-detail release-detail--{mode}"
  data-release-detail
  data-release-detail-mode={mode}
  data-release-slug={release.slug}
  use:measureTop={mode === 'page'}
>
  <!-- Capa de menús (Añadir a colección): fuera de toda caja que recorta o
       desplaza, pero dentro del diálogo (R1). -->
  <div class="release-detail__menu-layer" data-release-menu-layer bind:this={menuLayer}></div>

  <div class="release-detail__layout" data-release-scroll-region>
    <div class="release-detail__cover-column">
      <div class="release-detail__cover">
        <Cover src={release.coverUrl} alt={`Portada de ${release.title}`} loading="eager" fetchpriority="high" />
        {#if hasRadar}
          <div class="release-detail__radar" aria-hidden="true">
            <div class="release-detail__radar-scale"><RadarMini valores={release.radar} /></div>
          </div>
        {/if}
      </div>
    </div>

    <div class="release-detail__info" data-release-scroll-region>
      <header class="release-detail__header">
        <div class="release-detail__credits" data-release-credits>
          <CreditLine {release} variant="roles" />
        </div>
        <svelte:element this={mode === 'page' ? 'h1' : 'h2'} class="release-detail__title" id={resolvedTitleId} tabindex="-1">
          {release.title}
        </svelte:element>
      </header>

      <dl class="release-detail__metadata">
        {#if release.releaseType}
          <div><dt>Tipo</dt><dd>{release.releaseType}</dd></div>
        {/if}

        {#if release.countries.length}
          <div>
            <dt>País</dt>
            <dd>
              {#each release.countries as country, index (country)}
                {@const href = filterHref('pais', country, search)}
                <a {href} on:click={(event) => followFilter(event, href)}>{country}</a>{#if index < release.countries.length - 1}<span class="release-detail__sep" aria-hidden="true">/</span>{/if}
              {/each}
            </dd>
          </div>
        {/if}

        {#if release.label}
          <div>
            <dt>Sello</dt>
            <dd><a href={`/sello/${slugify(release.label)}`}>{release.label}</a></dd>
          </div>
        {/if}

        {#if date}
          <div><dt>Fecha</dt><dd>{date}</dd></div>
        {/if}

        {#if release.genres.length}
          <div>
            <dt>Género</dt>
            <dd class="release-detail__genres">
              {#each release.genres as genre (genre)}
                {@const href = filterHref('genero', genre, search)}
                <Chip kind="genre" size="sm" label={genre} {href} onclick={(event) => followFilter(event, href)} />
              {/each}
            </dd>
          </div>
        {/if}
      </dl>

      {#if release.review}
        <blockquote class="release-detail__review">“{release.review}”</blockquote>
      {/if}

      {#key release.slug}
        <ReleasePlayer {release} />
      {/key}

      <section class="release-detail__recommendations" aria-label="Recomendaciones" data-release-recommendations>
        <slot name="recommendations"></slot>
      </section>
    </div>

    <!-- Una sola línea (I1): Comprar y Añadir a colección con texto e icono;
         Compartir y Reportar como IconButton. Fila propia al pie de la ficha,
         fuera de la región con scroll: nunca se dibuja sobre el reproductor. -->
    <div class="release-detail__dock">
      <div class="release-detail__actions" role="group" aria-label="Acciones del lanzamiento" data-release-actions>
        {#if release.buyLink}
          <Button href={release.buyLink} target="_blank" rel="noopener noreferrer" icon="comprar" size={actionSize} class="release-detail__buy">
            Comprar<span class="sr-only">, se abre en otra pestaña</span>
          </Button>
        {/if}

        <AddToCrateButton releaseId={release.id ?? undefined} lanzamientoSlug={release.slug} menuPortalTarget={menuLayer} size={actionSize} />

        <span class="release-detail__secondary">
          <CompartirLanzamiento slug={release.slug} size={actionSize} quiet={false} />
          <IconButton icon="reportar" label="Reportar un problema" href={reportHref} size={actionSize} tooltipAlign="end" />
        </span>
      </div>
    </div>
  </div>
</article>

<style>
  .release-detail {
    position: relative;
    width: 100%;
    min-width: 0;
    color: var(--color-texto);
  }

  .release-detail--modal {
    height: 100%;
    min-height: 0;
    border-radius: inherit;
  }

  .release-detail__menu-layer {
    position: absolute;
    inset: 0;
    z-index: calc(var(--layer-dropdown) + 1);
    pointer-events: none;
  }

  /* ---- Portada: siempre cuadrada, con el mismo marco en los cuatro lados ---- */

  .release-detail__cover-column {
    position: relative;
    min-width: 0;
    padding: var(--ficha-frame);
    box-sizing: border-box;
    background: var(--color-fondo);
  }

  .release-detail__cover { position: relative; width: 100%; overflow: hidden; }

  .release-detail__radar {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--color-sombra-fuerte);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--motion-slow) var(--ease-standard);
  }

  .release-detail__radar-scale { transform: scale(1.7); transform-origin: center; }
  .release-detail__cover :global(.ui-cover__image) {
    transition: transform var(--motion-slow) var(--ease-standard), opacity var(--motion-slow) var(--ease-standard);
  }

  /* Radar al pasar el cursor; en táctil no hay hover que se quede pegado. */
  @media (hover: hover) {
    .release-detail__cover:hover :global(.ui-cover__image) { transform: scale(1.04); opacity: .12; }
    .release-detail__cover:hover .release-detail__radar { opacity: 1; }
  }

  /* ---- Información -------------------------------------------------------- */

  .release-detail__info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5) var(--space-4);
    box-sizing: border-box;
  }

  /* Con alto fijo, los hijos (el reproductor recorta su desborde, así que su
     mínimo automático es 0) se encogerían en lugar de dejar que la columna
     desplace (R1). Incluye componentes hijos como ReleasePlayer: :global. */
  .release-detail__info > :global(*) { flex-shrink: 0; }

  .release-detail__header { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .release-detail__credits:empty { display: none; }

  .release-detail__title {
    margin: 0;
    max-width: 100%;
    font-size: var(--text-3xl);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -.02em;
    color: var(--color-texto);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .release-detail__title:focus { outline: none; }
  .release-detail__title:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 4px; border-radius: var(--radius-xs); }

  .release-detail__metadata {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-4);
    align-items: baseline;
    margin: 0;
  }

  .release-detail__metadata > div { display: contents; }

  .release-detail__metadata dt {
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    line-height: 1.6;
    text-transform: uppercase;
  }

  .release-detail__metadata dd {
    min-width: 0;
    margin: 0;
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .release-detail__metadata a { color: inherit; text-decoration: underline; text-decoration-color: var(--color-linea-fuerte); text-underline-offset: .2em; }
  .release-detail__metadata a:hover { color: var(--color-acento); text-decoration-color: currentColor; }
  .release-detail__metadata a:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; border-radius: var(--radius-xs); }
  .release-detail__sep { margin-inline: var(--space-1); color: var(--color-texto-tenue); }

  .release-detail__genres { display: flex; flex-wrap: wrap; gap: var(--space-1); align-self: center; }

  .release-detail__review {
    margin: 0;
    padding-left: var(--space-3);
    border-left: 2px solid var(--color-acento-suave);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-style: italic;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .release-detail__recommendations:empty { display: none; }

  /* ---- Barra de acciones -------------------------------------------------- */

  .release-detail__actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    height: 100%;
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-top: 1px solid var(--color-linea);
    background: var(--color-panel);
  }

  .release-detail__secondary {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-3);
    margin-inline-start: auto;
  }

  .release-detail__actions :global(.release-detail__buy) { flex: none; }

  /* ---- Una columna (hasta 767) ------------------------------------------- */

  @media (max-width: 767px) {
    .release-detail__layout { display: flex; flex-direction: column; }

    /* Modal a pantalla completa: un solo recorrido, con la barra al pie. */
    .release-detail--modal .release-detail__layout {
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .release-detail__cover-column { flex: none; }
    .release-detail__info { flex: 1 0 auto; }

    /* Página: la ficha va de borde a borde, como el modal. */
    .release-detail--page {
      width: auto;
      margin-inline: calc(-1 * var(--container-gutter));
      background: var(--color-panel);
    }

    .release-detail__dock { flex: none; min-height: calc(var(--ficha-bar-h-compact) + var(--safe-area-bottom)); }

    .release-detail__actions {
      min-height: calc(var(--ficha-bar-h-compact) + var(--safe-area-bottom));
      padding-bottom: var(--safe-area-bottom);
    }

    /* La barra se queda abajo hasta acoplarse al final de la ficha: en el
       modal, dentro de su propio recorrido; en la página, en el del documento,
       sin tapar el pie del sitio (U18: antes lo emulaba JavaScript, porque el
       overflow-x de body anulaba sticky). */
    .release-detail__dock {
      position: sticky;
      bottom: 0;
      z-index: var(--layer-sticky);
    }
    .release-detail--modal .release-detail__dock { z-index: var(--layer-raised); }
  }

  /* ---- Dos columnas (desde 768) ------------------------------------------ */

  @media (min-width: 768px) {
    /* Página: el lado de la portada es el menor entre el tope, el ancho que
       deja la información mínima y el alto que queda bajo las migas (nunca
       menos de --ficha-min-h). El ancho que sobra lo toma la información. */
    .release-detail--page {
      container-type: inline-size;
      --ficha-cover: min(
        var(--ficha-cover-max),
        100cqw - var(--ficha-info-min),
        max(var(--ficha-min-h), 100dvh - var(--ficha-top, 0px) - var(--ficha-bar-h) - var(--space-5))
      );
      border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    }

    .release-detail__layout {
      display: grid;
      grid-template-columns: var(--ficha-cover) minmax(0, 1fr);
      grid-template-rows: var(--ficha-cover) var(--ficha-bar-h);
      height: calc(var(--ficha-cover) + var(--ficha-bar-h));
      min-width: 0;
      overflow: hidden;
      border-radius: inherit;
    }

    .release-detail--page .release-detail__layout {
      border: 1px solid var(--color-linea-sutil);
      background: var(--color-panel);
      box-shadow: var(--shadow-flotante);
      box-sizing: content-box;
    }

    .release-detail__info {
      min-height: 0;
      overflow-y: auto;
      scrollbar-gutter: stable;
      padding: var(--ficha-frame) var(--space-5) var(--space-5);
    }

    .release-detail--modal .release-detail__info { overscroll-behavior: contain; }

    /* El botón de cerrar del modal ocupa la esquina superior derecha. */
    .release-detail--modal .release-detail__header { padding-inline-end: calc(var(--target-touch) + var(--space-2)); }

    /* La barra va de borde a borde, alineada con el marco de la portada. */
    .release-detail__dock { grid-column: 1 / -1; min-width: 0; }
    .release-detail__actions { padding-inline: var(--ficha-frame); }
  }
</style>
