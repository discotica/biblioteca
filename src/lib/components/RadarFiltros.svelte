<script>
  // Filtro Radar: cinco ejes con cinco puntos cada uno (E11). U10: acciones con
  // Button, puntos con nombre accesible y área táctil de 44 con el dedo, y el
  // título opcional. U10b-2: siempre en dos columnas (ejes | gráfico); con el
  // dedo en un ancho estrecho se compacta para caber en la hoja móvil.
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/ui/Button.svelte';
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

  const ejes = [
    { key: 'experimental', label: 'Experimental' },
    { key: 'denso', label: 'Denso' },
    { key: 'sintetico', label: 'Sintético' },
    { key: 'bailable', label: 'Bailable' },
    { key: 'rapido', label: 'Rápido' }
  ];

  export function resetRadar() {
    radarInterno = { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 };
    dispatch('filtrarRadar', { ...radarInterno });
  }

  function actualizarRadar() {
    dispatch('filtrarRadar', { ...radarInterno });
  }

  function elegir(key, n) {
    radarInterno[key] = radarInterno[key] === n ? 0 : n;
    actualizarRadar();
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
    <div class="radar-ejes">
      {#each ejes as { key, label }}
        <div class="eje-row" class:eje-row--active={radarInterno[key] > 0} role="group" aria-label={label}>
          <span class="eje-label" aria-hidden="true">{label}</span>
          <div class="pips" style="--n:{radarInterno[key]}">
            {#each [1, 2, 3, 4, 5] as n}
              <button
                type="button"
                class="pip"
                class:pip--active={n <= radarInterno[key]}
                class:pip--selected={n === radarInterno[key]}
                aria-label={`${label}: ${n} de 5`}
                aria-pressed={n === radarInterno[key]}
                on:click={() => elegir(key, n)}
                title={String(n)}
              ></button>
            {/each}
          </div>
          {#if radarInterno[key] > 0}
            <span class="eje-valor" aria-hidden="true">{radarInterno[key]}</span>
          {:else}
            <span class="eje-valor eje-valor--vacio"></span>
          {/if}
        </div>
      {/each}
    </div>
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
  /* Paso entre puntos: 24 con cursor, 44 con el dedo (objetivo táctil).
     Ancho y alto por separado: la hoja estrecha usa 40 × 44. */
  --pip-hit: var(--space-5);
  --pip-hit-x: var(--pip-hit);
  --pip-hit-y: var(--pip-hit);
  --pip-dot: 14px;
  /* Sangría de la columna vertebral de los ejes. */
  --radar-spine: 1.1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: start;
}

@media (pointer: coarse) {
  .radar { --pip-hit: var(--target-touch); }
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

.radar-ejes {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-left: var(--radar-spine);
}

/* Vertical spine connecting all rows */
.radar-ejes::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 9px;
  bottom: 9px;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--color-acento-suave) 8%,
    var(--color-acento-suave) 92%,
    transparent 100%
  );
  pointer-events: none;
}

.eje-row {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  column-gap: var(--space-3);
}

/* Dot on the spine for each row */
.eje-row::before {
  content: '';
  position: absolute;
  left: calc(3px - var(--radar-spine));
  top: calc(100% - var(--pip-hit-y) / 2);
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-superficie-3);
  border: 1px solid var(--color-linea-fuerte);
  pointer-events: none;
  transition: background var(--motion-fast) ease, border-color var(--motion-fast) ease, box-shadow var(--motion-fast) ease;
}

.eje-row--active::before {
  background: var(--color-acento);
  border-color: var(--color-acento);
  box-shadow: 0 0 6px var(--color-acento-border);
}

.eje-label {
  flex: 0 0 5.75rem;
  font-size: var(--text-xs);
  color: var(--color-texto-secundario);
  line-height: 1;
}

.pips {
  position: relative;
  display: flex;
  align-items: center;
}

/* Grey track */
.pips::before {
  content: '';
  position: absolute;
  left: calc(var(--pip-hit-x) / 2);
  right: calc(var(--pip-hit-x) / 2);
  top: 50%;
  height: 1.5px;
  transform: translateY(-50%);
  background: var(--color-superficie-3);
  border-radius: var(--radius-xs);
  z-index: 0;
  pointer-events: none;
}

/* Green track segment up to active pip */
.pips::after {
  content: '';
  position: absolute;
  left: calc(var(--pip-hit-x) / 2);
  right: calc(var(--pip-hit-x) / 2);
  top: 50%;
  height: 1.5px;
  transform: translateY(-50%);
  background: linear-gradient(
    to right,
    var(--color-acento-texto) max(0%, calc((var(--n, 0) - 1) / 4 * 100%)),
    transparent              max(0%, calc((var(--n, 0) - 1) / 4 * 100%))
  );
  border-radius: var(--radius-xs);
  z-index: 0;
  pointer-events: none;
}

/* El botón ocupa el paso completo; el punto visible se dibuja en ::before. */
.pip {
  position: relative;
  z-index: 1;
  width: var(--pip-hit-x);
  height: var(--pip-hit-y);
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.pip::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--pip-dot);
  height: var(--pip-dot);
  box-sizing: border-box;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1.5px solid var(--color-linea-fuerte);
  background: var(--color-panel);
  transition: border-color var(--motion-instant) ease, background var(--motion-instant) ease, box-shadow var(--motion-instant) ease;
}

.pip:hover::before {
  border-color: var(--color-acento-texto);
  background: var(--color-acento-dim);
}

.pip:focus-visible { outline: none; }
.pip:focus-visible::before { box-shadow: var(--focus-ring); border-color: var(--focus-ring-color); }

.pip--active::before {
  background: var(--color-borde-hover);
  border-color: var(--color-acento-texto);
}

.pip--selected::before {
  background: var(--color-acento);
  border-color: var(--color-acento);
  box-shadow: 0 0 5px var(--color-acento-texto);
}

.eje-valor {
  font-size: var(--text-2xs);
  font-weight: 700;
  color: var(--color-acento);
  min-width: 1rem;
  line-height: 1;
}

.eje-valor--vacio {
  min-width: 1rem;
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
  .radar-ejes { grid-area: ejes; gap: var(--space-1); }
  .eje-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "label valor"
      "pips pips";
    row-gap: var(--space-1);
  }
  .eje-label { grid-area: label; }
  .eje-valor { grid-area: valor; text-align: right; }
  .pips { grid-area: pips; }
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

/* Con el dedo bajo 480: puntos de 40 × 44, para que 5 × 40 quepan junto al
   gráfico a 360. */
@media (pointer: coarse) and (max-width: 479px) {
  .radar {
    --pip-hit-x: 40px;
    --pip-hit-y: var(--target-touch);
  }
}
</style>
