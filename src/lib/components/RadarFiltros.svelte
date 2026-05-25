<script>
  import { createEventDispatcher } from 'svelte';
  import RadarVisual from './RadarVisual.svelte';

  const dispatch = createEventDispatcher();

  export let radar = {
    experimental: 0,
    denso: 0,
    sintetico: 0,
    bailable: 0,
    rapido: 0
  };

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

<section class="radar">
  <div class="radar-controls">
    <h3 class="radar-title">Radar</h3>
    <div class="radar-ejes">
      {#each ejes as { key, label }}
        <div class="eje-row" class:eje-row--active={radarInterno[key] > 0}>
          <span class="eje-label">{label}</span>
          <div class="pips" style="--n:{radarInterno[key]}">
            {#each [1, 2, 3, 4, 5] as n}
              <button
                type="button"
                class="pip"
                class:pip--active={n <= radarInterno[key]}
                class:pip--selected={n === radarInterno[key]}
                on:click={() => elegir(key, n)}
                title={String(n)}
              ></button>
            {/each}
          </div>
          {#if radarInterno[key] > 0}
            <span class="eje-valor">{radarInterno[key]}</span>
          {:else}
            <span class="eje-valor eje-valor--vacio"></span>
          {/if}
        </div>
      {/each}
    </div>
    <div class="radar-acciones">
      <button class="btn-accion btn-accion--random" on:click={randomizarRadar}>Randomizar</button>
      <button class="btn-accion btn-accion--limpiar" on:click={resetRadar}>Limpiar</button>
    </div>
  </div>

  <div class="radar-visual">
    <RadarVisual valores={radarInterno} />
  </div>
</section>

<style>
.radar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 960px) {
  .radar { grid-template-columns: 1fr; }
}

.radar-controls {
  display: flex;
  flex-direction: column;
  gap: .6rem;
}

.radar-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: .2px;
  color: var(--color-texto);
}

.radar-ejes {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding-left: 1.1rem;
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
    rgba(150, 247, 25, .18) 8%,
    rgba(150, 247, 25, .18) 92%,
    transparent 100%
  );
  pointer-events: none;
}

.eje-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: .65rem;
}

/* Dot on the spine for each row */
.eje-row::before {
  content: '';
  position: absolute;
  left: calc(-1.1rem + 3px);
  top: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .18);
  pointer-events: none;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.eje-row--active::before {
  background: var(--color-acento);
  border-color: var(--color-acento);
  box-shadow: 0 0 6px rgba(150, 247, 25, .45);
}

.eje-label {
  min-width: 90px;
  font-size: .8rem;
  color: var(--color-texto-secundario);
  line-height: 1;
}

.pips {
  position: relative;
  display: flex;
  gap: .5rem;
  align-items: center;
}

/* Grey track */
.pips::before {
  content: '';
  position: absolute;
  left: 7px;
  right: 7px;
  top: 50%;
  height: 1.5px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, .1);
  border-radius: 1px;
  z-index: 0;
  pointer-events: none;
}

/* Green track segment up to active pip */
.pips::after {
  content: '';
  position: absolute;
  left: 7px;
  right: 7px;
  top: 50%;
  height: 1.5px;
  transform: translateY(-50%);
  background: linear-gradient(
    to right,
    rgba(150, 247, 25, .55) max(0%, calc((var(--n, 0) - 1) / 4 * 100%)),
    transparent              max(0%, calc((var(--n, 0) - 1) / 4 * 100%))
  );
  border-radius: 1px;
  z-index: 0;
  pointer-events: none;
}

.pip {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, .18);
  background: #131313;
  cursor: pointer;
  padding: 0;
  transition: border-color 100ms ease, background 100ms ease, box-shadow 100ms ease;
  flex-shrink: 0;
}

.pip:hover {
  border-color: rgba(150, 247, 25, .55);
  background: rgba(150, 247, 25, .12);
}

.pip--active {
  background: rgba(150, 247, 25, .3);
  border-color: rgba(150, 247, 25, .65);
}

.pip--selected {
  background: var(--color-acento);
  border-color: var(--color-acento);
  box-shadow: 0 0 5px rgba(150, 247, 25, .6);
}

.eje-valor {
  font-size: .75rem;
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
  gap: .5rem;
  padding-left: 1.1rem;
  margin-top: .9rem;
}

.btn-accion {
  appearance: none;
  flex: 1;
  border-radius: 999px;
  padding: .5rem .75rem;
  font-family: var(--font-base);
  font-size: .72rem;
  font-weight: 600;
  cursor: pointer;
  line-height: 1;
  transition: transform 120ms ease, filter 120ms ease, border-color 120ms ease, background 120ms ease;
}

.btn-accion--random {
  border: 1px solid rgba(150, 247, 25, .45);
  background: rgba(150, 247, 25, .08);
  color: var(--color-texto);
}

.btn-accion--limpiar {
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .04);
  color: rgba(248, 255, 238, .45);
}

.btn-accion:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.btn-accion--random:hover { border-color: rgba(150, 247, 25, .7); }
.btn-accion--limpiar:hover { border-color: rgba(255, 255, 255, .2); color: rgba(248, 255, 238, .75); }

.btn-accion:active { transform: translateY(0); }

.radar-visual {
  width: 230px;
  height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 960px) {
  .radar-visual {
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
  }
}
</style>
