<script>
  // Hoja de filtros móvil (E15, U10) sobre la primitiva Sheet. No tiene estado
  // de búsqueda propio: recibe los valores del SearchState y emite los cambios,
  // que se aplican al instante. El gesto de cierre solo empieza en el asa o la
  // cabecera.
  // U10b-2: el campo de texto vive en la barra (MobileSearchBar) y la hoja no
  // tiene pie: se cierra con la ×. Orden: País · Género / Tipo · Año /
  // Reiniciar / Radar, siempre desplegado. La altura se mide al abrir para que
  // el radar asome (su título y el primer eje) y el resto se vea con scroll.
  import { createEventDispatcher, tick } from 'svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Filtros from '$lib/components/Filtros.svelte';
  import ActiveSearchPills from '$lib/components/ActiveSearchPills.svelte';
  import RadarPanel from './RadarPanel.svelte';

  export let open = false;
  export let pills = [];
  export let lanzamientos = [];
  export let valores;
  export let returnFocus = null;
  export let radarRef = null;

  /** Lo que se ve del radar bajo el formulario al abrir. */
  const RADAR_PEEK = 72;

  const dispatch = createEventDispatcher();
  let radarEl;
  let maxHeight;

  // Cabecera + posición del radar en el cuerpo + el asomo. Solo al abrir y al
  // cambiar el viewport: con chips nuevas la hoja no salta.
  function medir() {
    const panel = radarEl?.closest('.ui-sheet__panel');
    const body = radarEl?.closest('.ui-sheet__body');
    if (!panel || !body) return;
    const radar = radarEl.querySelector('.radar') ?? radarEl;
    const top = radar.getBoundingClientRect().top - panel.getBoundingClientRect().top + body.scrollTop;
    maxHeight = `min(${Math.ceil(top + RADAR_PEEK)}px, var(--sheet-max-h))`;
  }

  $: if (open) void tick().then(medir);
  $: if (!open) maxHeight = undefined;

  function onResize() {
    if (open) medir();
  }

  function close() {
    dispatch('close');
  }
</script>

<svelte:window on:resize={onResize} />

<Sheet {open} title="Filtros" class="filtros-mobile-sheet" {returnFocus} {maxHeight} onclose={close}>
  {#snippet header()}
    {#if pills.length}
      <ActiveSearchPills
        {pills}
        layout="band"
        label="Todos los filtros activos"
        on:remove
      />
    {/if}
  {/snippet}

  <div class="filtros-mobile-body">
    <Filtros
      {lanzamientos}
      {valores}
      layout="sheet"
      on:filtrar
      on:reset
    />
    <div class="sheet-radar" bind:this={radarEl}>
      <RadarPanel
        radar={valores.radar}
        bind:this={radarRef}
        on:filtrarRadar
      />
    </div>
  </div>
</Sheet>

<style>
  .filtros-mobile-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* El radar siempre desplegado, separado del formulario por una línea. */
  .sheet-radar {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-linea-sutil);
  }
</style>
