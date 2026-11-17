<script>
  // Búsqueda del inicio en desktop (U10b, >768): el campo de texto es el
  // disparador. U29 (tablero D): cerrado mide 560 y va a la izquierda, con las
  // chips en la misma fila, a la derecha (space-between; con más de 4, la quinta
  // es «N más»). Un clic o empezar a escribir lo amplía hasta el ancho del
  // panel, muestra la × y despliega el panel, y las chips bajan a una segunda
  // fila, al inicio y alineadas con el formulario. Sin bienvenida ni nota beta
  // (`compacta`), el campo mide 420 y lleva el título a su izquierda, sobre la
  // banda reducida de la franja. Un foco (Tab, el cierre de la bienvenida o de
  // la nota) no abre.
  // Cierran la × y el segundo Esc, que dejan el foco en el campo, y un clic
  // fuera de la región: las chips, las sugerencias y los desplegables están
  // dentro. Cerrar conserva el texto, los filtros y el radar.
  // En móvil solo se ven las chips, como banda bajo MobileSearchBar; allí la
  // región de búsqueda es la barra (U10b-2), así que esta deja de serlo.
  import { onMount, tick } from 'svelte';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';
  import IconButton from '$lib/ui/IconButton.svelte';
  import SearchCombobox from '$lib/components/SearchCombobox.svelte';
  import ActiveSearchPills from '$lib/components/ActiveSearchPills.svelte';
  import HomeFilterPanel from './HomeFilterPanel.svelte';

  export let open = false;
  export let lanzamientos = [];
  export let valores;
  export let pills = [];
  export let radarRef = null;
  export let inputEl = null;
  /** Banda reducida de la franja (sin bienvenida ni nota): título a la izquierda y campo de 420. */
  export let compacta = false;
  export let titulo = '';

  const panelId = 'panel-busqueda';
  const mobileQuery = window.matchMedia(MOBILE_QUERY);
  let region;
  let mobile = mobileQuery.matches;

  function abrir() {
    open = true;
  }

  async function cerrar() {
    open = false;
    await tick();
    inputEl?.focus({ preventScroll: true });
  }

  onMount(() => {
    // dropdownMenu (overlay.ts) no encaja: mueve el foco al abrir, lo devuelve
    // al cerrar y anula el pointerdown de fuera, y aquí el clic en un
    // resultado tiene que llegar a su destino.
    const onPointerDown = (event) => {
      if (open && region && !region.contains(event.target)) open = false;
    };
    const onBreakpoint = () => (mobile = mobileQuery.matches);
    document.addEventListener('pointerdown', onPointerDown, true);
    mobileQuery.addEventListener?.('change', onBreakpoint);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      mobileQuery.removeEventListener?.('change', onBreakpoint);
    };
  });
</script>

<div
  class="home-search l-container l-container--wide"
  role={mobile ? undefined : 'search'}
  aria-label={mobile ? undefined : 'Catálogo'}
  bind:this={region}
  class:home-search--compacta={compacta}
>
  <div class="home-search__row" class:home-search__row--open={open}>
    {#if compacta && titulo}<h1 class="home-search__titulo">{titulo}</h1>{/if}
    <div class="home-search__field">
      <SearchCombobox
        {lanzamientos}
        {valores}
        bind:inputEl
        on:filtrar
        on:activate={abrir}
        on:escape={cerrar}
      />
    </div>
    {#if open}
      <IconButton
        class="home-search__close"
        icon="cerrar"
        label="Cerrar búsqueda"
        size="lg"
        tooltipAlign="end"
        aria-expanded="true"
        aria-controls={panelId}
        onclick={cerrar}
      />
    {/if}
    {#if pills.length}
      <div class="active-pills-outside">
        <ActiveSearchPills {pills} align={open ? 'start' : 'end'} limit={mobile ? 0 : compacta ? 3 : 4} on:remove />
      </div>
    {/if}
  </div>

  <HomeFilterPanel
    id={panelId}
    {open}
    {lanzamientos}
    {valores}
    bind:radarRef
    on:filtrar
    on:filtrarRadar
    on:reset
  />
</div>

<style>
  .home-search {
    position: relative;
    z-index: var(--layer-raised);
    margin: var(--space-5) auto var(--space-4);
  }

  /* Una fila que envuelve: el campo a la izquierda y las chips a la derecha (el
     contenedor de chips crece y las alinea al final: el efecto de space-between
     también sin chips); abierto, el campo crece y las chips pasan a la línea de abajo. */
  .home-search__row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    column-gap: var(--space-5);
    row-gap: var(--space-2);
  }
  .home-search__row--open { column-gap: var(--space-2); }

  /* Cerrado: --franja-buscador-w a la izquierda. Abierto: todo el ancho que deja
     la ×; el campo crece desde su borde izquierdo. */
  .home-search__field {
    flex: 0 1 var(--franja-buscador-w);
    min-width: 0;
    max-width: var(--franja-buscador-w);
    transition: max-width var(--motion-fast) var(--ease-expressive);
  }
  .home-search__row--open .home-search__field { flex: 1 1 0; max-width: 100%; }

  .home-search__field :global(.busqueda-input-row),
  .home-search__field :global(.busqueda-input-row:focus-within) {
    min-height: var(--franja-buscador-h);
    background: var(--color-panel);
  }

  /* Las chips, a la derecha de la fila; abiertas, su propia línea. */
  .active-pills-outside { flex: 1 1 0; min-width: 0; }
  .home-search__row--open .active-pills-outside { flex: 1 1 100%; }
  .home-search :global(.filtros-wrap) { margin-top: var(--space-3); }

  /* Banda reducida (franja sin bienvenida ni nota): título + campo de 420 sobre
     el campo de pulso. La fila queda centrada en la banda; el panel y la 2.ª línea
     de chips caen debajo sin mover el campo. */
  .home-search--compacta { margin: 0 auto var(--space-4); }
  .home-search--compacta .home-search__row {
    box-sizing: border-box;
    min-height: var(--franja-h-reducida);
    padding-block: calc((var(--franja-h-reducida) - var(--franja-buscador-h-reducida)) / 2) 0;
    align-content: flex-start;
  }
  .home-search--compacta .home-search__row:not(.home-search__row--open) { padding-bottom: calc((var(--franja-h-reducida) - var(--franja-buscador-h-reducida)) / 2); }
  .home-search--compacta .home-search__field { flex-basis: var(--franja-buscador-w-reducida); max-width: var(--franja-buscador-w-reducida); }
  .home-search--compacta .home-search__row--open .home-search__field { flex-basis: 0; max-width: 100%; }
  .home-search--compacta .home-search__field :global(.busqueda-input-row),
  .home-search--compacta .home-search__field :global(.busqueda-input-row:focus-within) { min-height: var(--franja-buscador-h-reducida); }
  .home-search__titulo {
    flex: none;
    margin: 0 var(--space-2) 0 0;
    color: var(--color-texto);
    font-size: var(--text-franja-reducida);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1429;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .home-search__field { transition: none; }
  }

  /* En móvil buscar y filtrar viven en MobileSearchBar y la hoja: aquí solo
     quedan las chips, en banda bajo la barra. Sin chips la región no ocupa. */
  @media (max-width: 768px) {
    .home-search,
    .home-search--compacta { margin-top: 0; margin-bottom: 0; }
    .home-search__row,
    .home-search--compacta .home-search__row,
    .home-search--compacta .home-search__row:not(.home-search__row--open) { display: block; min-height: 0; padding: 0; }
    .home-search__titulo,
    .home-search__field,
    .home-search :global(.home-search__close) { display: none; }
    .active-pills-outside { margin: 0; }
  }
</style>
