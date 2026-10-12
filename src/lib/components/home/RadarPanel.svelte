<script>
  // Radar del panel de búsqueda y de la hoja móvil. El contenedor lo pone
  // quien lo usa (columna del panel o el final de la hoja).
  import RadarFiltros from '$lib/components/RadarFiltros.svelte';

  export let radar;
  /** Título «Radar» visible (U10b-2: también en la hoja, sin desplegable). */
  export let showTitle = true;

  let radarFiltros;

  export function resetRadar() {
    radarFiltros?.resetRadar();
  }
</script>

<div class="radar-panel">
  <RadarFiltros
    {radar}
    {showTitle}
    bind:this={radarFiltros}
    on:filtrarRadar
  />
</div>
