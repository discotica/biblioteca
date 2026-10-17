<script lang="ts">
  import RadarMini from './RadarMini.svelte';
  import { RADAR_AXES, type ContributionRadar } from '$lib/domain/contributionContract';

  // Controles del radar: el dibujo y un deslizador de 0 a 5 por eje. Los usan el editor del
  // Estudio (U16) y Sugerir (U19, donde el radar es opcional).

  type Props = {
    /** Los cinco ejes, de 0 a 5 (el `radar` del editor o el de la propuesta). */
    value: Record<string, number>;
    legend?: string;
    /** Sugerir: el formulario es estrecho, así que los deslizadores van en dos columnas. */
    compact?: boolean;
    class?: string;
  };

  let { value = $bindable(), legend = 'Radar', compact = false, class: className = '' }: Props = $props();

  const LABELS: Record<(typeof RADAR_AXES)[number], string> = {
    experimental: 'Experimental',
    denso: 'Denso',
    sintetico: 'Sintético',
    bailable: 'Bailable',
    rapido: 'Rápido'
  };
</script>

<fieldset class="radar-field {className}" class:radar-field--compact={compact}>
  <legend>{legend}</legend>
  <div class="radar-field__row">
    <div class="radar-field__chart" aria-hidden="true"><RadarMini valores={value as ContributionRadar} /></div>
    <div class="radar-field__controls">
      {#each RADAR_AXES as axis (axis)}
        <label class="radar-field__slider">
          <span>{LABELS[axis]}</span>
          <input type="range" min="0" max="5" step="1" bind:value={value[axis]} />
          <output aria-hidden="true">{value[axis]}</output>
        </label>
      {/each}
    </div>
  </div>
</fieldset>

<style>
  .radar-field {
    margin: var(--space-4) 0 0;
    padding: var(--space-3) 0 0;
    border: 0;
    border-top: 1px solid var(--color-borde);
  }
  .radar-field legend {
    margin-bottom: var(--space-2);
    padding: 0;
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .radar-field__row {
    display: grid;
    grid-template-columns: var(--tool-radar) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-6);
  }
  /* Las etiquetas del radar salen del dibujo: margen para que no se corten. */
  .radar-field__chart { width: var(--tool-radar); padding-inline: var(--space-4); box-sizing: content-box; }
  .radar-field__chart :global(svg) { display: block; width: 100%; height: auto; overflow: visible; }
  .radar-field__controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 var(--space-5);
  }
  .radar-field--compact .radar-field__controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .radar-field__slider {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr) 1.5ch;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-size: var(--text-xs);
  }
  .radar-field__slider input { width: 100%; min-height: var(--target-touch); margin: 0; accent-color: var(--color-acento); }
  .radar-field__slider output { color: var(--color-acento); font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }

  @media (max-width: 1023px) {
    .radar-field__controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 767px) {
    .radar-field__row { grid-template-columns: minmax(0, 1fr); justify-items: center; }
    .radar-field__controls,
    .radar-field--compact .radar-field__controls { width: 100%; grid-template-columns: minmax(0, 1fr); }
  }
</style>
