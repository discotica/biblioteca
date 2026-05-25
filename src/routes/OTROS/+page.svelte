<script>
  import { onMount } from 'svelte';
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import Filtros from '$lib/components/Filtros.svelte';
  import RadarFiltros from '$lib/components/RadarFiltros.svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';

  export let data;

  let lanzamientos = data.lanzamientos;
  let lanzamientosFiltrados = [];
  let sugerencias = [];
  let radarRef;
  let mostrarPanelFiltros = true;
  let paginaActual = 1;

  const lanzamientosPorPagina = 12;

  $: totalPaginas = Math.ceil(lanzamientosFiltrados.length / lanzamientosPorPagina);
  $: lanzamientosPaginados = lanzamientosFiltrados.slice(
    (paginaActual - 1) * lanzamientosPorPagina,
    paginaActual * lanzamientosPorPagina
  );

  // Estado de filtros (pais/genero/texto SIEMPRE arrays)
  let filtrosSeleccionados = {
    pais: [],
    genero: [],
    texto: [],
    año: '',
    mes: '',
    type: '',
    orden: 'fecha-desc',
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 }
  };

  // --- Utils generales ---
  function normalizar(s) {
    return (s ?? '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();
  }

  function growDown(node, { duration = 200 } = {}) {
    const height = getComputedStyle(node).height;
    return {
      duration,
      easing: cubicOut,
      css: (t) => `
        opacity: ${t};
        transform: scaleY(${t});
        transform-origin: top;
        overflow: hidden;
        height: ${parseFloat(height) * t}px;
      `
    };
  }

  function s(n) { return n === 1 ? '' : 's'; }

  // --- Radar ranking (entero, sin sliders de tolerancia visibles) ---
  const RADAR_KEYS = ['experimental','denso','sintetico','bailable','rapido'];

  function toVec(radar) {
    // Redondeo por si llegara un decimal; sliders son enteros
    return RADAR_KEYS.map(k => Math.round(Number(radar?.[k] ?? 0)));
  }

  function l1NormDiff(a, b, w) {
    let sum = 0, wsum = 0;
    for (let i = 0; i < RADAR_KEYS.length; i++) {
      const wi = w ? Number(w[i] ?? 1) : 1;
      sum += wi * Math.abs(a[i] - b[i]);
      wsum += wi;
    }
    return wsum ? (sum / (5 * wsum)) : 0; // escala 0–5 → [0,1]
  }

  function cosineDistance(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < RADAR_KEYS.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 1; // vector nulo → máxima distancia
    const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
    return 1 - Math.max(0, Math.min(1, cos));
  }

  function maxAxisDiff(a, b) {
    let m = 0;
    for (let i = 0; i < RADAR_KEYS.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      if (d > m) m = d;
    }
    return m;
  }

  function radarScore(itemRadar, targetRadar, weights, mode = 'hybrid') {
    const a = toVec(itemRadar);
    const b = toVec(targetRadar);
    const l1 = l1NormDiff(a, b, weights);
    if (mode === 'magnitude') return l1;
    const c  = cosineDistance(a, b);
    if (mode === 'shape') return c;
    return 0.6 * l1 + 0.4 * c; // híbrido por defecto
  }

  /**
   * Rankeador elástico:
   * - Gate por tolerancia (T) en max diff por eje (T=0→1→2…) hasta cubrir una página.
   * - Orden dentro del gate por score híbrido; empate → más reciente.
   */
  function rankByRadarElastic(lista, targetRadar, {
    weights = null,
    mode = 'hybrid',
    tolStart = 0,
    tolStep = 1,
    tolMax = 5,
    pageSize = 12,
    dateKey = 'release_date'
  } = {}) {
    const b = toVec(targetRadar);
    const scored = lista.map(l => {
      const a = toVec(l.radar || {});
      return {
        item: l,
        score: radarScore(a, b, weights, mode),
        maxDiff: maxAxisDiff(a, b),
        date: new Date(l?.[dateKey] ?? 0).getTime()
      };
    });

    let T = tolStart;
    let gated = scored.filter(x => x.maxDiff <= T);
    while (gated.length < pageSize && T < tolMax) {
      T += tolStep;
      gated = scored.filter(x => x.maxDiff <= T);
    }

    gated.sort((x, y) => x.score - y.score || y.date - x.date);
    const outGate = scored.filter(x => x.maxDiff > T)
                          .sort((x, y) => x.score - y.score || y.date - x.date);

    return [...gated, ...outGate].map(x => x.item);
  }

  // --- Acciones ---
  function reiniciarFiltrosYRadar() {
    filtrosSeleccionados = {
      pais: [],
      genero: [],
      texto: [],
      año: '',
      mes: '',
      type: '',
      orden: 'fecha-desc',
      radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 }
    };
    radarRef?.resetRadar();
    aplicarTodosLosFiltros();
  }

  onMount(async () => {
    const res = await fetch('/lanzamientos.json');
    const data = await res.json();
    lanzamientos = Array.isArray(data[0]) ? data[0] : data;

    const query = new URLSearchParams(get(page).url.search);

    // pais/genero/texto desde URL siempre como arrays
    const paisQS   = query.getAll('pais');
    const generoQS = query.getAll('genero');
    const textoQS  = query.getAll('texto');

    filtrosSeleccionados = {
      pais: paisQS.length ? paisQS : [],
      genero: generoQS.length ? generoQS : [],
      texto: textoQS.length ? textoQS : [],
      año: query.get('año') || '',
      mes: query.get('mes') || '',
      type: query.get('type') || '',
      orden: query.get('orden') || 'fecha-desc',
      radar: {
        experimental: parseInt(query.get('radar_experimental')) || 0,
        denso:        parseInt(query.get('radar_denso'))        || 0,
        sintetico:    parseInt(query.get('radar_sintetico'))    || 0,
        bailable:     parseInt(query.get('radar_bailable'))     || 0,
        rapido:       parseInt(query.get('radar_rapido'))       || 0
      }
    };

    // Primer paint rápido: una “página” ordenada
    lanzamientosFiltrados = ordenarLanzamientos(lanzamientos.slice(0, lanzamientosPorPagina));
    paginaActual = 1;

    // Luego filtra todo sin bloquear render
    setTimeout(aplicarTodosLosFiltros, 50);

    // Cierra dropdowns al click global
    const manejarClickGlobal = (event) => {
      document.querySelectorAll('.dropdown[open]').forEach((dropdown) => {
        if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
      });
    };
    document.addEventListener('click', manejarClickGlobal);
    return () => document.removeEventListener('click', manejarClickGlobal);
  });

  function coincideTexto(l, textos) {
    const titulo = normalizar(l.title);
    const sello  = normalizar(l.label);
    const artistas = (l.artist || []).map(normalizar);
    return textos.every((t) => {
      const tt = normalizar(t);
      return titulo.includes(tt) || sello.includes(tt) || artistas.some(a => a.includes(tt));
    });
  }

  function actualizarFiltros({ detail }) {
    filtrosSeleccionados = {
      ...filtrosSeleccionados,
      pais:   Array.isArray(detail.pais)   ? detail.pais   : (detail.pais   ? [detail.pais]   : []),
      genero: Array.isArray(detail.genero) ? detail.genero : (detail.genero ? [detail.genero] : []),
      texto:  Array.isArray(detail.texto)  ? detail.texto  : [],
      año:    detail.año ?? '',
      mes:    detail.mes ?? '',
      type:   detail.type ?? '',
      orden:  detail.orden ?? 'fecha-desc'
    };
    aplicarTodosLosFiltros();
  }

  function actualizarRadar(event) {
    // valores enteros
    const r = event.detail || {};
    filtrosSeleccionados.radar = Object.fromEntries(
      RADAR_KEYS.map(k => [k, Math.round(Number(r[k] ?? 0))])
    );
    aplicarTodosLosFiltros();
  }

  function ordenarLanzamientos(lista) {
    const orden = filtrosSeleccionados.orden;
    const cmpStr = (a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

    switch (orden) {
      case 'fecha-desc': return [...lista].sort((a,b) => new Date(b.release_date) - new Date(a.release_date));
      case 'fecha-asc':  return [...lista].sort((a,b) => new Date(a.release_date) - new Date(b.release_date));
      case 'artista-asc': {
        return [...lista].sort((a,b) => {
          const A = Array.isArray(a.artist) ? a.artist[0] || '' : (a.artist || '');
          const B = Array.isArray(b.artist) ? b.artist[0] || '' : (b.artist || '');
          return cmpStr(A, B);
        });
      }
      case 'artista-desc': {
        return [...lista].sort((a,b) => {
          const A = Array.isArray(a.artist) ? a.artist[0] || '' : (a.artist || '');
          const B = Array.isArray(b.artist) ? b.artist[0] || '' : (b.artist || '');
          return cmpStr(B, A);
        });
      }
      case 'titulo-asc':  return [...lista].sort((a,b) => cmpStr(a.title, b.title));
      case 'titulo-desc': return [...lista].sort((a,b) => cmpStr(b.title, a.title));
      default: return lista;
    }
  }

  function aplicarTodosLosFiltros() {
    // 1) Filtros “clásicos”
    const base = lanzamientos.filter(l => {
      const coincidePais =
        filtrosSeleccionados.pais.length === 0 ||
        filtrosSeleccionados.pais.some(p =>
          (l.country || []).some(c => normalizar(c) === normalizar(p))
        );

      const coincideGenero =
        filtrosSeleccionados.genero.length === 0 ||
        filtrosSeleccionados.genero.some(g =>
          (l.genre || []).some(gg => normalizar(gg) === normalizar(g))
        );

      const coincideAño =
        !filtrosSeleccionados.año || (l.release_date || '').startsWith(filtrosSeleccionados.año);

      const coincideMes =
        !filtrosSeleccionados.mes || (l.release_date || '').slice(5, 7) === filtrosSeleccionados.mes;

      const coincideTipo =
        !filtrosSeleccionados.type || l.type === filtrosSeleccionados.type;

      const coincideTxt =
        filtrosSeleccionados.texto.length === 0 || coincideTexto(l, filtrosSeleccionados.texto);

      return coincidePais && coincideGenero && coincideAño && coincideMes && coincideTipo && coincideTxt;
    });

    // 2) Orden primario (fecha/título/artista)
    let resultado = ordenarLanzamientos(base);

    // 3) Orden secundario por radar (elástico, sin sesgo por valores altos)
    const radarActivo = RADAR_KEYS.some(k => Number(filtrosSeleccionados.radar?.[k] ?? 0) > 0);
    if (radarActivo) {
      resultado = rankByRadarElastic(resultado, filtrosSeleccionados.radar, {
        weights: null,               // puedes pasar [w1..w5] si quieres ponderar ejes
        mode: 'hybrid',              // 'hybrid' | 'magnitude' | 'shape'
        tolStart: 0,
        tolStep: 1,
        tolMax: 5,
        pageSize: lanzamientosPorPagina
      });
    }

    paginaActual = 1;
    lanzamientosFiltrados = resultado;

    // Sugerencias por texto cuando no hay matches
    sugerencias = (lanzamientosFiltrados.length === 0 && filtrosSeleccionados.texto.length)
      ? ordenarLanzamientos(
          lanzamientos.filter(l =>
            filtrosSeleccionados.texto.some(t => {
              const termino = normalizar(t);
              const artistas = (l.artist || []).map(normalizar);
              return artistas.some(a => a.includes(termino)) ||
                     normalizar(l.title).includes(termino) ||
                     normalizar(l.label).includes(termino);
            })
          )
        )
      : [];

    actualizarURL();
  }

  let timeout;
  function actualizarURL() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const params = new URLSearchParams();
      const { pais, genero, texto, año, mes, type, orden, radar } = filtrosSeleccionados;

      // Arrays
      for (const p of pais)   params.append('pais', p);
      for (const g of genero) params.append('genero', g);
      for (const t of texto)  params.append('texto', t);

      // Escalares
      if (año)   params.set('año', año);
      if (mes)   params.set('mes', mes);
      if (type)  params.set('type', type);
      if (orden) params.set('orden', orden);

      // Radar (solo >0)
      for (const [k, v] of Object.entries(radar || {})) {
        if (Number(v) > 0) params.set(`radar_${k}`, String(v));
      }

      goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
    }, 400);
  }
</script>

<!-- BOTÓN PARA MOSTRAR/OCULTAR FILTROS -->
<div class="boton-buscar-contenedor">
  <button class="boton-buscar-toggle" on:click={() => mostrarPanelFiltros = !mostrarPanelFiltros}>
    {#if mostrarPanelFiltros}
      ✖ Cerrar búsqueda
    {:else}
      🔍 Buscar
    {/if}
  </button>
</div>

{#if mostrarPanelFiltros}
<section class="filtros container" transition:growDown={{ duration: 200 }}>
  <div class="filtros__grid">
    <div class="filtros__formulario">
      <Filtros 
        {lanzamientos} 
        valores={filtrosSeleccionados} 
        on:filtrar={actualizarFiltros} 
      />
    </div>

    <div class="filtros__radar">
      <RadarFiltros
        radar={filtrosSeleccionados.radar}
        bind:this={radarRef}
        on:filtrarRadar={actualizarRadar}
      />
    </div>
    
    <div class="filtros__acciones">
      <button class="filtros__reiniciar" on:click={reiniciarFiltrosYRadar}>
        Reiniciar filtros
      </button>
    </div>
  </div>
</section>

{/if}

  <div class="paginacion">
    {#if paginaActual > 1}
      <button on:click={() => { paginaActual -= 1; scrollTo(0, 0); }}>
        <b>←</b>
      </button>
    {/if}

    <span>{paginaActual} de {totalPaginas}</span>

    {#if paginaActual < totalPaginas}
      <button on:click={() => { paginaActual += 1; scrollTo(0, 0); }}>
        <b>→</b>
      </button>
    {/if}
  </div>

<section class="resultados container">
  <p class="resultados__contador">
    {#if lanzamientosFiltrados.length > 0}
      Mostrando {lanzamientosFiltrados.length} lanzamiento{s(lanzamientosFiltrados.length)}
    {:else}
      No se encontraron lanzamientos con esos filtros.
    {/if}
  </p>

<div class="resultados__grid">
  {#if lanzamientosFiltrados.length > 0}
    {#each lanzamientosPaginados as lanzamiento}
      <LanzamientoCard 
        {lanzamiento}
        on:buscar={async (e) => {
          const texto = e.detail.toLowerCase();
          if (!filtrosSeleccionados.texto.includes(texto)) {
            filtrosSeleccionados.texto = [...filtrosSeleccionados.texto, texto];
            aplicarTodosLosFiltros();
            mostrarPanelFiltros = true;
            await tick();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }} 
      />
    {/each}
  {:else if sugerencias.length > 0}
    <p class="resultados__sugerencia">Sugerencias cercanas:</p>
    {#each sugerencias as lanzamiento}
      <LanzamientoCard 
        {lanzamiento}
        on:buscar={async (e) => {
          const texto = e.detail.toLowerCase();
          if (!filtrosSeleccionados.texto.includes(texto)) {
            filtrosSeleccionados.texto = [...filtrosSeleccionados.texto, texto];
            aplicarTodosLosFiltros();
            mostrarPanelFiltros = true;
            await tick();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }} 
      />
    {/each}
  {/if}
</div>

{#if totalPaginas > 1}
  <div class="paginacion">
    {#if paginaActual > 1}
      <button on:click={() => { paginaActual -= 1; scrollTo(0, 0); }}>
        <b>←</b>
      </button>
    {/if}

    <span>{paginaActual} de {totalPaginas}</span>

    {#if paginaActual < totalPaginas}
      <button on:click={() => { paginaActual += 1; scrollTo(0, 0); }}>
        <b>→</b>
      </button>
    {/if}
  </div>
{/if}

</section>

<style>
  @import '$lib/styles/styles.css';

  .boton-buscar-contenedor {
    display: flex;
    justify-content: center;
    margin: var(--spacing-md) 0;
  }

  .boton-buscar-toggle {
    font-size: 1rem;
    font-weight: 700;
    background: var(--color-acento);
    color: var(--color-fondo);
    border: none;
    border-radius: var(--radius-base);
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .boton-buscar-toggle:hover {
    background: #baff4e;
  }

  .resultados__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--spacing-md);
    align-items: start;
    justify-items: center;
  }

  @media (min-width: 640px) {
    .resultados__grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (min-width: 1024px) {
    .resultados__grid {
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
  }

  .paginacion {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.25rem;
  font-weight: bold;
}

.paginacion button {
  background: var(--color-acento);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: background 0.2s ease;
  color: var(--color-fondo);
}

.paginacion button:hover {
  background: #baff4e;
}

.boton-buscar-toggle {
  transition: all 0.2s ease;
  transform-origin: center;
}

.boton-buscar-toggle:hover {
  background: #baff4e;
  transform: scale(1.05);
}

</style>
