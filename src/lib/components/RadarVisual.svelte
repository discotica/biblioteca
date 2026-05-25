<script>
  import { tweened } from 'svelte/motion';
  import { derived } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';

  export let valores = {
    experimental: 0,
    denso: 0,
    sintetico: 0,
    bailable: 0,
    rapido: 0
  };

  const categorias = ['experimental', 'denso', 'sintetico', 'bailable', 'rapido'];
  const radioMax = 50;
  const center = { x: 60, y: 65 };
  const duration = 300;

  const radarStore = tweened(valores, {
    duration,
    easing: cubicOut
  });

  // Actualizar radar animadamente cada vez que los valores cambien
  $: radarStore.set(valores);

  function getPuntos(valorPorCategoria) {
    const anguloPaso = (2 * Math.PI) / categorias.length;
    return categorias.map((cat, i) => {
      const valor = valorPorCategoria[cat] ?? 0;
      const radio = (valor / 5) * radioMax;
      const angulo = -Math.PI / 2 + i * anguloPaso;
      const x = center.x + radio * Math.cos(angulo);
      const y = center.y + radio * Math.sin(angulo);
      return [x, y];
    });
  }

  const puntosInterpolados = derived(radarStore, $v => getPuntos($v));

  function puntosToPath(puntos) {
    return puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
  }
</script>

<svg viewBox="0 0 120 130" class="radar-mini">
  <!-- Líneas concéntricas -->
  {#each Array(5) as _, nivel}
    <polygon
      points={
        getPuntos(Object.fromEntries(categorias.map(c => [c, nivel + 1])))
          .map(([x, y]) => `${x},${y}`).join(' ')
      }
      fill="none"
      stroke="#f8ffee"
      stroke-width="0.5"
      stroke-opacity={(nivel + 1) / 5}
    />
  {/each}

  <!-- Líneas radiales -->
  {#each categorias as _, i}
    {@const angle = -Math.PI / 2 + i * ((2 * Math.PI) / categorias.length)}
    {@const x = center.x + radioMax * Math.cos(angle)}
    {@const y = center.y + radioMax * Math.sin(angle)}
    <line x1={center.x} y1={center.y} x2={x} y2={y} stroke="#ccc" stroke-width="0.5" />
  {/each}

  <!-- Radar animado -->
  {#if $puntosInterpolados}
    <path d={puntosToPath($puntosInterpolados)} fill="#96f71988" stroke="#96f719" stroke-width="2" />
  {/if}

  <!-- Letras en los vértices -->
  {#each categorias as cat, i}
    {@const angle = -Math.PI / 2 + i * ((2 * Math.PI) / categorias.length)}
    {@const x = center.x + (radioMax + 10) * Math.cos(angle)}
    {@const y = center.y + (radioMax + 10) * Math.sin(angle)}
    <text
      x={x}
      y={y}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="7"
      fill="#96f719"
    >
      {cat.charAt(0).toUpperCase()}
    </text>
  {/each}
</svg>

<style>
  .radar-mini {
    width: 100%;
    max-width: 200px;
    height: auto;
    display: block;
  }
</style>