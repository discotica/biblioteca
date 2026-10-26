<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';
  import { sheetOverlay } from './overlay';

  type Props = {
    open: boolean;
    /** Título visible; es el nombre accesible de la hoja. */
    title: string;
    description?: string;
    /** Deslizar la cabecera hacia abajo cierra. Solo empieza en el asa o la cabecera. */
    swipeToClose?: boolean;
    initialFocus?: string;
    returnFocus?: HTMLElement | null;
    onclose?: () => void;
    /** Contenido fijo bajo el título (p. ej. filtros activos); no hace scroll. */
    header?: Snippet;
    children: Snippet;
    /** Pie fijo con la acción primaria. */
    footer?: Snippet;
    /** Tope de altura (CSS) en lugar de --sheet-max-h; el viewport visual sigue limitando. */
    maxHeight?: string;
    class?: string;
  };

  let {
    open = $bindable(),
    title,
    description,
    swipeToClose = true,
    initialFocus,
    returnFocus,
    onclose,
    header,
    children,
    footer,
    maxHeight,
    class: className = ''
  }: Props = $props();

  const id = $props.id();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  // Mismos umbrales que la hoja de filtros de E15.
  const CLOSE_DISTANCE = 72;
  const FLICK_DISTANCE = 24;
  const FLICK_VELOCITY = 0.5;
  const AXIS_LOCK = 10;

  let offset = $state(0);
  let dragging = $state(false);
  let cancelled = false;
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let startAt = 0;

  // Con el teclado virtual abierto solo se ve el viewport visual: la hoja se
  // apoya en su borde inferior y no pasa de su altura.
  let viewportHeight = $state(0);
  let viewportBottom = $state(0);

  $effect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    if (!visual) return;
    const sync = () => {
      viewportHeight = visual.height;
      viewportBottom = Math.max(0, window.innerHeight - (visual.height + visual.offsetTop));
    };
    sync();
    visual.addEventListener('resize', sync);
    visual.addEventListener('scroll', sync);
    return () => {
      visual.removeEventListener('resize', sync);
      visual.removeEventListener('scroll', sync);
    };
  });

  function close() {
    offset = 0;
    dragging = false;
    open = false;
    onclose?.();
  }

  function startSwipe(event: PointerEvent) {
    if (!swipeToClose || (event.button !== undefined && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, summary')) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startAt = performance.now();
    offset = 0;
    dragging = true;
    cancelled = false;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function moveSwipe(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > AXIS_LOCK && Math.abs(dx) > Math.abs(dy)) {
      cancelled = true;
      offset = 0;
      return;
    }
    if (!cancelled) offset = Math.max(0, dy);
  }

  function endSwipe(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    const velocity = offset / Math.max(1, performance.now() - startAt);
    const shouldClose = !cancelled && (offset >= CLOSE_DISTANCE || (offset >= FLICK_DISTANCE && velocity >= FLICK_VELOCITY));
    dragging = false;
    pointerId = -1;
    if (shouldClose) close();
    else offset = 0;
  }
</script>

{#if open}
  <div
    class="ui-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    style:--sheet-vv-height={viewportHeight ? `${viewportHeight}px` : null}
    style:--sheet-vv-bottom={`${viewportBottom}px`}
    use:sheetOverlay={{ onClose: close, initialFocus, returnFocus }}
  >
    <div class="ui-sheet__backdrop" role="presentation" onclick={close}></div>
    <div
      class="ui-sheet__panel {className}"
      class:ui-sheet__panel--dragging={dragging}
      style:--sheet-panel-max-h={maxHeight}
      style:transform={offset ? `translateY(${offset}px)` : null}
    >
      <div
        class="ui-sheet__header"
        class:ui-sheet__header--swipe={swipeToClose}
        role="presentation"
        onpointerdown={startSwipe}
        onpointermove={moveSwipe}
        onpointerup={endSwipe}
        onpointercancel={endSwipe}
      >
        {#if swipeToClose}<div class="ui-sheet__handle" aria-hidden="true"></div>{/if}
        <div class="ui-sheet__title-row">
          <h2 class="ui-sheet__title" id={titleId}>{title}</h2>
          <IconButton icon="cerrar" label="Cerrar" variant="secondary" tooltip="bottom" tooltipAlign="end" onclick={close} />
        </div>
        {#if description}<p class="ui-sheet__description" id={descriptionId}>{description}</p>{/if}
        {#if header}<div class="ui-sheet__extra">{@render header()}</div>{/if}
      </div>
      <div class="ui-sheet__body">{@render children()}</div>
      {#if footer}<div class="ui-sheet__footer">{@render footer()}</div>{/if}
    </div>
    <div class="ui-sheet__layer" data-ui-layer></div>
  </div>
{/if}

<style>
  .ui-sheet {
    position: fixed;
    inset: 0;
    z-index: var(--layer-overlay);
    outline: none;
  }

  .ui-sheet__backdrop {
    position: absolute;
    inset: 0;
    background: var(--overlay-backdrop);
    backdrop-filter: blur(var(--overlay-blur));
    -webkit-backdrop-filter: blur(var(--overlay-blur));
  }

  /* Altura según contenido hasta el máximo; cabecera y pie fijos, el cuerpo hace scroll. */
  .ui-sheet__panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: var(--sheet-vv-bottom, 0px);
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: var(--sheet-max-w);
    max-height: min(var(--sheet-panel-max-h, var(--sheet-max-h)), calc(var(--sheet-vv-height, 100dvh) - var(--sheet-top-gap)));
    margin-inline: auto;
    box-sizing: border-box;
    overflow: hidden;
    border-top: 1px solid var(--color-linea);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-velo-opaco);
    box-shadow: var(--shadow-flotante);
    animation: ui-sheet-in var(--motion-overlay) var(--ease-emphasized);
    transition: transform var(--motion-fast) var(--ease-emphasized), bottom var(--motion-fast) var(--ease-standard);
  }
  .ui-sheet__panel--dragging { transition: none; }

  .ui-sheet__header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4) var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--color-linea-sutil);
    flex: none;
  }
  /* El gesto vertical es de la hoja; el horizontal queda para bandas desplazables. */
  .ui-sheet__header--swipe { touch-action: pan-x; user-select: none; }

  .ui-sheet__handle {
    align-self: center;
    width: var(--sheet-handle-w);
    height: var(--sheet-handle-h);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-3);
  }

  .ui-sheet__title-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: var(--target-touch); }
  .ui-sheet__title { margin: 0; color: var(--color-texto); font-size: var(--text-md); font-weight: 700; }
  .ui-sheet__description { margin: 0; color: var(--color-texto-medio); font-size: var(--text-sm); }
  .ui-sheet__extra { min-width: 0; }

  .ui-sheet__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: var(--space-5);
  }

  .ui-sheet__footer {
    flex: none;
    padding: var(--space-3) var(--space-5) calc(var(--space-3) + var(--safe-area-bottom));
    border-top: 1px solid var(--color-linea);
    background: var(--color-velo-opaco);
  }
  /* Sin pie, el área segura va al final del cuerpo. */
  .ui-sheet__body:last-child { padding-bottom: calc(var(--space-5) + var(--safe-area-bottom)); }

  .ui-sheet__layer { position: absolute; inset: 0; z-index: var(--layer-raised); pointer-events: none; }

  @keyframes ui-sheet-in {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-sheet__panel { animation: none; transition: none; }
  }

  @media (max-width: 479px) {
    .ui-sheet__header { padding-left: var(--space-4); }
    .ui-sheet__body { padding: var(--space-4); }
    .ui-sheet__footer { padding-inline: var(--space-4); }
  }
</style>
