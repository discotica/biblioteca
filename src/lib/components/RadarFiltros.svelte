<script>
  // Filtro Radar: cinco ejes con cinco puntos cada uno (E11). U10: acciones con
  // Button, puntos con nombre accesible y área táctil de 44 con el dedo, y el
  // título opcional. U10b-2: siempre en dos columnas (ejes | gráfico); con el
  // dedo en un ancho estrecho se compacta para caber en la hoja móvil. U22: los
  // ejes con puntos viven en RadarPips, compartidos con el editor del Estudio.
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/ui/Button.svelte';
  import RadarPips from './RadarPips.svelte';
  import RadarVisual from './RadarVisual.svelte';

  const dispatch = createEventDispatcher();

  export let radar = {
    experimental: 0,
    denso: 0,
    sintetico: 0,
    bailable: 0,
    rapido: 0
  };

  export let showTitle = true;

  let radarInterno = { ...radar };

  export function resetRadar() {
    radarInterno = { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 };
    dispatch('filtrarRadar', { ...radarInterno });
  }

  function actualizarRadar() {
    dispatch('filtrarRadar', { ...radarInterno });
  }

  function randomizarRadar() {
    radarInterno = {
      experimental: Math.floor(Math.random() * 6),
      denso: Math.floor(Math.random() * 6),
      sintetico: Math.floor(Math.random() * 6),
      bailable: Math.floor(Math.random() * 6),
      rapido: Math.floor(Math.random() * 6)
    };
    actualizarRadar();
  }
</script>

<section class="radar" aria-label={showTitle ? undefined : 'Radar'}>
  <div class="radar-controls">
    {#if showTitle}<h3 class="radar-title">Radar</h3>{/if}
    <RadarPips bind:value={radarInterno} onchange={(next) => dispatch('filtrarRadar', { ...next })} />
    <div class="radar-acciones">
      <Button variant="secondary" size="sm" onclick={randomizarRadar}>Aleatorizar</Button>
      <Button variant="ghost" size="sm" onclick={resetRadar}>Limpiar</Button>
    </div>
  </div>

  <div class="radar-visual" aria-hidden="true">
    <RadarVisual valores={radarInterno} />
  </div>
</section>

<style>
.radar {
  /* Sangría de la columna vertebral de los ejes (la leen RadarPips y las acciones). */
  --radar-spine: 1.1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: start;
}

.radar-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.radar-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: .2px;
  color: var(--color-texto);
}

.radar-acciones {
  display: flex;
  gap: var(--space-2);
  padding-left: var(--radar-spine);
  margin-top: var(--space-2);
}

.radar-visual {
  width: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Estrecho (hoja móvil): las dos columnas se compactan. La etiqueta y el
   valor van sobre los puntos, hay menos aire entre ejes, el gráfico mide
   ~115 px y Aleatorizar/Limpiar van bajo él, en su columna. Con etiqueta al
   lado y gráfico de 180 no caben: hacen falta 566 px con el dedo y la hoja
   ofrece 432 a 480. */
@media (max-width: 679px) {
  .radar {
    --radar-spine: var(--space-3);
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      "titulo titulo"
      "ejes visual"
      "ejes acciones";
    gap: var(--space-3);
  }
  .radar:not(:has(.radar-title)) {
    grid-template-rows: auto 1fr;
    grid-template-areas:
      "ejes visual"
      "ejes acciones";
  }
  .radar-controls { display: contents; }
  .radar-title { grid-area: titulo; }
  .radar-controls :global(.radar-ejes) { grid-area: ejes; }
  .radar-visual {
    grid-area: visual;
    width: 100%;
    max-width: 115px;
    justify-self: center;
  }
  .radar-acciones {
    grid-area: acciones;
    flex-direction: column;
    align-self: start;
    padding-left: 0;
    margin-top: 0;
  }
}
</style>
