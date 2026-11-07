<script lang="ts">
  import { RADAR_AXES, type RadarAxis } from '$lib/domain/contributionContract';

  // Ejes del radar con cinco puntos cada uno (E11, U10). U22: salen de RadarFiltros para que la
  // búsqueda y el editor del Estudio usen el mismo control. Pulsar el punto elegido lo deja en 0.
  // Puntos con nombre accesible («Experimental: 3 de 5») y área táctil de 44 con el dedo.

  type Props = {
    /** Los cinco ejes, de 0 a 5. Se reemplaza el objeto entero en cada cambio. */
    value: Record<string, number>;
    /** La línea vertical que une los ejes (la búsqueda la lleva; el editor no). */
    spine?: boolean;
    /** Después de cada cambio, con el valor nuevo. */
    onchange?: (next: Record<string, number>) => void;
    class?: string;
  };

  let { value = $bindable(), spine = true, onchange, class: className = '' }: Props = $props();

  const LABELS: Record<RadarAxis, string> = {
    experimental: 'Experimental',
    denso: 'Denso',
    sintetico: 'Sintético',
    bailable: 'Bailable',
    rapido: 'Rápido'
  };

  const level = (key: RadarAxis) => value?.[key] ?? 0;

  function elegir(key: RadarAxis, n: number) {
    value = { ...value, [key]: level(key) === n ? 0 : n };
    onchange?.(value);
  }
</script>

<div class="radar-ejes {className}" class:radar-ejes--sin-eje={!spine}>
  {#each RADAR_AXES as key (key)}
    {@const label = LABELS[key]}
    <div class="eje-row" class:eje-row--active={level(key) > 0} role="group" aria-label={label}>
      <span class="eje-label" aria-hidden="true">{label}</span>
      <div class="pips" style="--n:{level(key)}">
        {#each [1, 2, 3, 4, 5] as n (n)}
          <button
            type="button"
            class="pip"
            class:pip--active={n <= level(key)}
            class:pip--selected={n === level(key)}
            aria-label={`${label}: ${n} de 5`}
            aria-pressed={n === level(key)}
            onclick={() => elegir(key, n)}
            title={String(n)}
          ></button>
        {/each}
      </div>
      {#if level(key) > 0}
        <span class="eje-valor" aria-hidden="true">{level(key)}</span>
      {:else}
        <span class="eje-valor eje-valor--vacio"></span>
      {/if}
    </div>
  {/each}
</div>

<style>
.radar-ejes {
  /* Paso entre puntos: 24 con cursor, 44 con el dedo (objetivo táctil).
     Ancho y alto por separado: la hoja estrecha usa 40 × 44. */
  --pip-hit: var(--space-5);
  --pip-hit-x: var(--pip-hit);
  --pip-hit-y: var(--pip-hit);
  --pip-dot: 14px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  /* Sangría de la columna vertebral; quien lo usa puede fijar --radar-spine. */
  padding-left: var(--radar-spine, 1.1rem);
}

@media (pointer: coarse) {
  .radar-ejes { --pip-hit: var(--target-touch); }
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
  left: calc(3px - var(--radar-spine, 1.1rem));
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

/* Sin columna vertebral (editor): ni la línea, ni el punto de cada eje, ni su sangría. */
.radar-ejes--sin-eje { padding-left: 0; }
.radar-ejes--sin-eje::before,
.radar-ejes--sin-eje .eje-row::before { display: none; }

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

/* Estrecho: la etiqueta y el valor van sobre los puntos y hay menos aire
   entre ejes (U10b-2, hoja móvil de la búsqueda). */
@media (max-width: 679px) {
  .radar-ejes { gap: var(--space-1); }
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
}

/* Con el dedo bajo 480: puntos de 40 × 44, para que 5 × 40 quepan junto al
   gráfico a 360. */
@media (pointer: coarse) and (max-width: 479px) {
  .radar-ejes {
    --pip-hit-x: 40px;
    --pip-hit-y: var(--target-touch);
  }
}
</style>
