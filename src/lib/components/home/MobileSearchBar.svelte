<script>
  // Línea 1 del inicio en móvil (E15, U10): es la única línea sticky y su
  // visibilidad la decide mobileSearchChrome, que la congela con el campo
  // enfocado o el teclado abierto.
  // U10b-2: buscar y filtrar se separan. El campo de texto es real (una chip
  // con Enter o una sugerencia, que salen bajo la barra a todo su ancho), y
  // Filtros, con el número de filtros activos, abre la hoja. Tras crear una
  // chip el campo suelta el foco para bajar el teclado y dejar ver los
  // resultados. En móvil, la barra es la región de búsqueda. El placeholder
  // es corto («Buscar», como el botón anterior): a 360 el campo mide ~150 px.
  import { createEventDispatcher, onMount } from 'svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import ViewToggle from '$lib/ui/ViewToggle.svelte';
  import SearchCombobox from '$lib/components/SearchCombobox.svelte';

  export let visible = true;
  export let expanded = false;
  export let count = 0;
  export let lanzamientos = [];
  export let valores;
  export let inputEl = null;
  export let filtersButtonEl = null;
  /** 'grid' | 'list' */
  export let view = 'grid';

  const dispatch = createEventDispatcher();
  let row;
  let suggestionsMaxHeight = null;

  $: filtersLabel = count > 0 ? `Filtros, ${count} ${count === 1 ? 'activo' : 'activos'}` : 'Filtros';

  // Las sugerencias no pasan del borde visible: con el teclado abierto, del
  // viewport visual.
  function measureSuggestions() {
    if (!row || document.activeElement !== inputEl) return;
    const visual = window.visualViewport;
    const visibleBottom = visual ? visual.offsetTop + visual.height : window.innerHeight;
    suggestionsMaxHeight = `${Math.max(160, Math.floor(visibleBottom - row.getBoundingClientRect().bottom - 16))}px`;
  }

  function commit() {
    inputEl?.blur();
  }

  onMount(() => {
    const visual = window.visualViewport;
    visual?.addEventListener('resize', measureSuggestions);
    visual?.addEventListener('scroll', measureSuggestions);
    return () => {
      visual?.removeEventListener('resize', measureSuggestions);
      visual?.removeEventListener('scroll', measureSuggestions);
    };
  });
</script>

<div
  class="mobile-search-anchor l-container l-container--wide"
  class:mobile-search-anchor--hidden={!visible}
  data-search-visible={visible}
>
  <div
    class="mobile-search-row"
    role="search"
    aria-label="Catálogo"
    bind:this={row}
    style:--busqueda-dropdown-max-h={suggestionsMaxHeight}
    on:focusin={measureSuggestions}
  >
    <div class="mobile-search-field">
      <SearchCombobox
        id="busqueda-movil"
        size="md"
        placeholder="Buscar"
        {lanzamientos}
        {valores}
        bind:inputEl
        on:filtrar
        on:commit={commit}
      />
    </div>
    <span class="mobile-search-filters">
      <IconButton
        icon="filtros"
        label={filtersLabel}
        variant="secondary"
        tooltip="bottom"
        bind:element={filtersButtonEl}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onclick={(event) => dispatch('open', event.currentTarget)}
      />
      {#if count > 0}
        <span class="mobile-search-badge" aria-hidden="true">{count}</span>
      {/if}
    </span>
    <ViewToggle value={view} label="Vista de resultados" onchange={(mode) => dispatch('view', mode)} />
  </div>
</div>

<style>
  /* ---- Persistent mobile search surface ---- */
  .mobile-search-anchor {
    display: none;
  }

  /* Ancla de las sugerencias: salen bajo la barra, a todo su ancho. */
  .mobile-search-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .mobile-search-field {
    flex: 1;
    min-width: 0;
  }
  .mobile-search-field :global(.busqueda-wrap) { position: static; }

  /* La barra flota sobre los resultados: campo y Filtros opacos, como el
     botón «Buscar» al que sustituyen. */
  .mobile-search-field :global(.busqueda-input-row),
  .mobile-search-field :global(.busqueda-input-row:focus-within),
  .mobile-search-filters :global(.ui-btn) {
    background: var(--color-velo-opaco);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .mobile-search-field :global(.busqueda-input-row) { box-shadow: 0 10px 30px var(--color-sombra); }
  .mobile-search-field :global(.busqueda-input-row:focus-within) { box-shadow: var(--focus-ring), 0 10px 30px var(--color-sombra); }

  .mobile-search-filters {
    position: relative;
    display: inline-flex;
    flex: none;
  }
  .mobile-search-filters :global(.ui-icon) { color: var(--color-acento); }

  /* El número ya está en el nombre accesible del botón. */
  .mobile-search-badge {
    position: absolute;
    top: calc(var(--space-1) * -1);
    right: calc(var(--space-1) * -1);
    display: inline-grid;
    min-width: 1.25rem;
    min-height: 1.25rem;
    padding: 0 .3rem;
    box-sizing: border-box;
    place-items: center;
    border-radius: var(--radius-pill);
    background: var(--color-acento);
    color: var(--color-fondo);
    font-size: var(--text-2xs);
    font-weight: 850;
    line-height: 1;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .mobile-search-anchor {
      position: sticky;
      top: 0;
      z-index: calc(var(--layer-overlay) - 2);
      display: block;
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      padding-bottom: var(--space-2);
      transition: transform var(--motion-overlay) var(--ease-emphasized), opacity var(--motion-fast) ease;
    }
    .mobile-search-anchor--hidden {
      transform: translateY(calc(-100% - .6rem));
      opacity: 0;
      pointer-events: none;
    }
  }
</style>
