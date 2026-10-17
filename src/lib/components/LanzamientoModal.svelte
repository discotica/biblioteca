<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import ReleaseDetail from './ReleaseDetail.svelte';
  import ReleaseRecommendations from './ReleaseRecommendations.svelte';
  import type { Release } from '$lib/domain/releases';
  import type { ReleaseRecommendation } from '$lib/domain/releaseRecommendations';
  import { dialogOverlay } from '$lib/ui/overlay';
  import IconButton from '$lib/ui/IconButton.svelte';

  export let lanzamiento: Release;
  export let returnFocus: HTMLElement | null = null;
  export let recommendations: ReleaseRecommendation[] = [];

  const dispatch = createEventDispatcher<{
    cerrar: void;
    recomendar: { recommendation: ReleaseRecommendation; trigger: HTMLElement | null };
  }>();
  let dialogElement: HTMLElement;
  let previousSlug = lanzamiento.slug;
  $: titleId = `release-title-${lanzamiento.slug}-modal`;
  $: descriptionId = `release-description-${lanzamiento.slug}-modal`;

  $: if (lanzamiento.slug !== previousSlug) {
    previousSlug = lanzamiento.slug;
    void focusReplacementTitle();
  }

  async function focusReplacementTitle() {
    await tick();
    dialogElement?.querySelector<HTMLElement>(`#${CSS.escape(titleId)}`)?.focus({ preventScroll: true });
  }

  function close() {
    dispatch('cerrar');
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="backdrop release-modal-backdrop" data-release-modal-backdrop on:click|self={close}>
  <div
    class="release-modal"
    bind:this={dialogElement}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    use:dialogOverlay={{ onClose: close, returnFocus }}
  >
    <p class="sr-only" id={descriptionId}>Ficha del lanzamiento con créditos, metadata, reproductor y acciones.</p>
    <IconButton icon="cerrar" label="Cerrar" variant="secondary" tooltip="bottom" tooltipAlign="end" class="release-modal__close" data-overlay-initial-focus onclick={close} />
    <ReleaseDetail release={lanzamiento} mode="modal" {titleId}>
      <svelte:fragment slot="recommendations">
        <ReleaseRecommendations
          {recommendations}
          mode="modal"
          on:open={(event) => dispatch('recomendar', event.detail)}
        />
      </svelte:fragment>
    </ReleaseDetail>
    <!-- Portal de menús de las primitivas (layerFor, U6): dentro del diálogo
         para el foco, fuera de las cajas que recortan o desplazan. -->
    <div class="release-modal__layer" data-ui-layer></div>
  </div>
</div>

<style>
  /* Por debajo de 768 la ficha es de una columna: el diálogo ocupa la
     pantalla. Desde 768 (decisiones.md, "Ficha (2026-10-07, durante U9)"):
     alto = columna cuadrada de la portada (--ficha-cover, con su marco) más la
     barra de acciones; ancho = esa columna más la información, que cede hasta
     --ficha-info-min antes de que la portada se achique. */
  .release-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--layer-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    background: var(--overlay-backdrop);
    backdrop-filter: blur(var(--overlay-blur));
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    animation: release-modal-fade var(--motion-overlay) var(--ease-standard);
  }

  .release-modal {
    position: relative;
    width: 100%;
    height: 100dvh;
    min-height: 0;
    /* No recorta: ReleaseDetail recorta su propio layout, así que los menús
       de su capa pueden salir del borde sin salir del diálogo (R1). */
    overflow: visible;
    background: var(--color-panel);
    animation: release-modal-enter var(--motion-overlay) var(--ease-emphasized);
  }

  .release-modal__layer {
    position: absolute;
    inset: 0;
    z-index: calc(var(--layer-dropdown) + 1);
    pointer-events: none;
  }

  /* Sobre la portada en una columna y sobre la información en dos: siempre
     con velo para leerse encima de cualquier imagen. */
  .release-modal :global(.release-modal__close) {
    position: absolute;
    z-index: calc(var(--layer-dropdown) + 2);
    top: var(--space-3);
    right: var(--space-3);
  }

  .release-modal :global(.release-modal__close .ui-btn) {
    border-radius: var(--radius-pill);
    background: var(--color-velo);
  }

  .release-modal :global(.release-modal__close .ui-btn:hover) {
    border-color: var(--color-acento-border);
    background: var(--color-acento-suave);
    color: var(--color-acento);
  }

  @keyframes release-modal-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes release-modal-enter {
    from { transform: translateY(var(--space-4)); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .release-modal-backdrop,
    .release-modal { animation: none; }
  }

  @media (min-width: 768px) {
    .release-modal-backdrop { padding: var(--dialog-gutter); }

    .release-modal {
      --ficha-cover: min(
        var(--ficha-cover-max),
        100dvh - 2 * var(--dialog-gutter) - var(--ficha-bar-h),
        100vw - 2 * var(--dialog-gutter) - 2px - var(--ficha-info-min)
      );
      /* El borde (1 px) va por fuera: el contenido mide exactamente portada +
         información, y el total no pasa del ancho disponible. */
      box-sizing: content-box;
      width: min(100vw - 2 * var(--dialog-gutter) - 2px, var(--ficha-cover) + var(--ficha-info-max));
      height: calc(var(--ficha-cover) + var(--ficha-bar-h));
      border: 1px solid var(--color-linea-sutil);
      border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
      box-shadow: var(--shadow-flotante);
    }
  }
</style>
