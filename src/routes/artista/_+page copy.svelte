<script>
  import { onMount, tick } from 'svelte';
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import Filtros from '$lib/components/Filtros.svelte';
  import RadarFiltros from '$lib/components/RadarFiltros.svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { cubicOut } from 'svelte/easing';

  export let data;

  // ahora arrancamos vacío; se llenará desde el TSV
  let lanzamientos = data?.lanzamientos || [];
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

  // =========================
  //   OVERLAY / MODAL STATE
  // =========================
  let lanzamientoActivo = null;
  let ultimoFoco = null;

  function bloquearScrollPagina() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function desbloquearScrollPagina() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  function buscarLanzamientoPorId(id) {
    if (!id) return null;
    return lanzamientos.find((l) => l.id === id) || null;
  }

  function abrirOverlay(lanzamiento) {
    if (!lanzamiento) return;
    lanzamientoActivo = lanzamiento;
    ultimoFoco = document.activeElement;
    bloquearScrollPagina();

    const nuevoHash = `#lanzamiento=${encodeURIComponent(lanzamiento.id || '')}`;
    if (lanzamiento.id && window.location.hash !== nuevoHash) {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + nuevoHash
      );
    }

    tick().then(() => {
      const btn = document.getElementById('overlay-cerrar');
      if (btn) btn.focus();
    });
  }

  function cerrarOverlay() {
    lanzamientoActivo = null;
    desbloquearScrollPagina();

    if (window.location.hash.startsWith('#lanzamiento=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (ultimoFoco && typeof ultimoFoco.focus === 'function') {
      try {
        ultimoFoco.focus();
      } catch {}
    }
  }

  function intentarAbrirDesdeHash() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#lanzamiento=')) return;
    const id = decodeURIComponent(hash.slice('#lanzamiento='.length));
    const l = buscarLanzamientoPorId(id);
    if (l) abrirOverlay(l);
  }

  // ======================
  //     TSV / GOOGLE SHEET
  // ======================

  const TSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vScoTP0-0jq3HAGMIzxS9NOSHsgXx4bxjlFKSPtuFq26OLJ5QCTtulXm328Bdl5lMHzpiOO5ffkpvE4/pub?gid=1229139332&single=true&output=tsv';

  function normalizar(s) {
    return (s ?? '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();
  }

  function parseTSV(texto) {
    const lineas = texto
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    return lineas
      .filter((l) => l.trim().length > 0)
      .map((linea) => {
        const out = [];
        let cur = '';
        let enComillas = false;
        for (let i = 0; i < linea.length; i++) {
          const c = linea[i];
          if (c === '"') {
            if (enComillas && linea[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              enComillas = !enComillas;
            }
          } else if (c === '\t' && !enComillas) {
            out.push(cur);
            cur = '';
          } else {
            cur += c;
          }
        }
        out.push(cur);
        return out;
      });
  }

  // Fecha DD/MM/YYYY -> {anio, mes, dia, iso}
  function parsearFecha(fecha) {
    const s = (fecha || '').trim();
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (!m) return null;
    const d = Number(m[1]);
    const mm = Number(m[2]);
    const y = Number(m[3]);
    if (!d || !mm || !y) return null;
    const iso = `${y}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { anio: y, mes: mm, dia: d, iso };
  }

  function numeroSeguro(v) {
    const n = Number((v ?? '').toString().replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    return n;
  }

  function textoALista(v) {
    return (v || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function slugify(str) {
    return (str || '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function tsvADatos(tsv) {
    const filas = parseTSV(tsv);
    if (!filas.length) return [];

    const encabezados = filas[0];
    const headersNorm = encabezados.map((h) => normalizar(h));

    const idx = (nombres) => {
      const arr = Array.isArray(nombres) ? nombres.map(normalizar) : [normalizar(nombres)];
      return headersNorm.findIndex((h) => arr.includes(h));
    };

    const idxFuzzy = (pred) => headersNorm.findIndex(pred);

    // Basado en las columnas del TSV:
    // artist | title | type | country | genre | label | release_date | buy_link | review | experiment | denso | sintetí | bailab | rapid | cover
    const iArtist      = idx(['artist']);
    const iTitle       = idx(['title']);
    const iType        = idx(['type']);
    const iCountry     = idx(['country']);
    const iGenre       = idx(['genre']);
    const iLabel       = idx(['label']);
    const iReleaseDate = idx(['release_date', 'release_dat', 'date']);
    const iBuyLink     = idx(['buy_link', 'link', 'url']);
    const iReview      = idx(['review', 'resena', 'reseña', 'descripcion', 'description']);
    const iExperiment  = idx(['experiment', 'experimental']);
    const iDenso       = idx(['denso']);
    const iSintetico   = idxFuzzy((h) => h.startsWith('sintet'));
    const iBailable    = idxFuzzy((h) => h.startsWith('bail'));
    const iRapido      = idxFuzzy((h) => h.startsWith('rapi') || h.startsWith('rapid'));
    const iCover       = idx(['cover', 'imagen', 'image']);

    const out = [];

    for (let r = 1; r < filas.length; r++) {
      const row = filas[r];
      if (!row || !row.length) continue;

      const artistaStr = row[iArtist] ?? '';
      const titulo     = row[iTitle] ?? '';
      const type       = iType        >= 0 ? (row[iType]        ?? '') : '';
      const countryStr = iCountry     >= 0 ? (row[iCountry]     ?? '') : '';
      const genreStr   = iGenre       >= 0 ? (row[iGenre]       ?? '') : '';
      const sello      = iLabel       >= 0 ? (row[iLabel]       ?? '') : '';
      const fechaTxt   = iReleaseDate >= 0 ? (row[iReleaseDate] ?? '') : '';
      const buyLink    = iBuyLink     >= 0 ? (row[iBuyLink]     ?? '') : '';
      const review     = iReview      >= 0 ? (row[iReview]      ?? '') : '';
      const cover      = iCover       >= 0 ? (row[iCover]       ?? '') : '';

      const experimental = iExperiment >= 0 ? numeroSeguro(row[iExperiment]) : 0;
      const denso        = iDenso      >= 0 ? numeroSeguro(row[iDenso])      : 0;
      const sintetico    = iSintetico  >= 0 ? numeroSeguro(row[iSintetico])  : 0;
      const bailable     = iBailable   >= 0 ? numeroSeguro(row[iBailable])   : 0;
      const rapido       = iRapido     >= 0 ? numeroSeguro(row[iRapido])     : 0;

      const fechaParsed = parsearFecha(fechaTxt);
      const fechaISO = fechaParsed?.iso  || '';
      const anio     = fechaParsed?.anio || 0;
      const mes      = fechaParsed?.mes  || 0;

      const artist  = textoALista(artistaStr);
      const country = textoALista(countryStr);
      const genre   = textoALista(genreStr);

      const id = `${fechaISO || 'sindata'}--${slugify(`${artistaStr} ${titulo}`) || 'lanzamiento'}`;

      const radar = { experimental, denso, sintetico, bailable, rapido };

      out.push({
        id,
        artist,
        title: titulo,
        type,
        label: sello,
        country,
        genre,
        release_date: fechaISO,
        fechaTexto: fechaTxt,
        year: anio,
        month: mes,
        cover,
        link: buyLink,
        review,
        experimental,
        denso,
        sintetico,
        bailable,
        rapido,
        radar
      });
    }

    return out;
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
    return RADAR_KEYS.map(k => Math.round(Number(radar?.[k] ?? 0)));
  }

  function l1NormDiff(a, b, w) {
    let sum = 0, wsum = 0;
    for (let i = 0; i < RADAR_KEYS.length; i++) {
      const wi = w ? Number(w[i] ?? 1) : 1;
      sum += wi * Math.abs(a[i] - b[i]);
      wsum += wi;
    }
    return wsum ? (sum / (5 * wsum)) : 0;
  }

  function cosineDistance(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < RADAR_KEYS.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 1;
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
    return 0.6 * l1 + 0.4 * c;
  }

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
    // Cargar desde Google Sheet (TSV)
    const res = await fetch(TSV_URL);
    const tsv = await res.text();
    lanzamientos = tsvADatos(tsv);

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

    // Primer paint rápido
    lanzamientosFiltrados = ordenarLanzamientos(lanzamientos.slice(0, lanzamientosPorPagina));
    paginaActual = 1;

    // Luego filtra todo
    setTimeout(aplicarTodosLosFiltros, 50);

    // Cierra dropdowns al click global
    const manejarClickGlobal = (event) => {
      document.querySelectorAll('.dropdown[open]').forEach((dropdown) => {
        if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
      });
    };
    document.addEventListener('click', manejarClickGlobal);

    // Deep link: abrir overlay si viene #lanzamiento=
    intentarAbrirDesdeHash();
    const hashHandler = () => intentarAbrirDesdeHash();
    window.addEventListener('hashchange', hashHandler);

    // ESC para cerrar overlay
    const escHandler = (e) => {
      if (e.key === 'Escape' && lanzamientoActivo) {
        cerrarOverlay();
      }
    };
    window.addEventListener('keydown', escHandler);

    return () => {
      document.removeEventListener('click', manejarClickGlobal);
      window.removeEventListener('hashchange', hashHandler);
      window.removeEventListener('keydown', escHandler);
    };
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

    let resultado = ordenarLanzamientos(base);

    const radarActivo = RADAR_KEYS.some(k => Number(filtrosSeleccionados.radar?.[k] ?? 0) > 0);
    if (radarActivo) {
      resultado = rankByRadarElastic(resultado, filtrosSeleccionados.radar, {
        weights: null,
        mode: 'hybrid',
        tolStart: 0,
        tolStep: 1,
        tolMax: 5,
        pageSize: lanzamientosPorPagina
      });
    }

    paginaActual = 1;
    lanzamientosFiltrados = resultado;

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

      for (const p of pais)   params.append('pais', p);
      for (const g of genero) params.append('genero', g);
      for (const t of texto)  params.append('texto', t);

      if (año)   params.set('año', año);
      if (mes)   params.set('mes', mes);
      if (type)  params.set('type', type);
      if (orden) params.set('orden', orden);

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
        <div class="card-wrapper" on:click={() => abrirOverlay(lanzamiento)}>
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
        </div>
      {/each}
    {:else if sugerencias.length > 0}
      <p class="resultados__sugerencia">Sugerencias cercanas:</p>
      {#each sugerencias as lanzamiento}
        <div class="card-wrapper" on:click={() => abrirOverlay(lanzamiento)}>
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
        </div>
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

{#if lanzamientoActivo}
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-label={`Detalle de ${(lanzamientoActivo.artist || []).join(', ')} – ${lanzamientoActivo.title || ''}`}
    on:click|self={cerrarOverlay}
  >
    <div class="overlay-card">
      <button
        id="overlay-cerrar"
        class="overlay-cerrar"
        type="button"
        aria-label="Cerrar"
        on:click={cerrarOverlay}
      >
        ×
      </button>

      <!-- Misma card reutilizada como detalle -->
      <LanzamientoCard lanzamiento={lanzamientoActivo} modo="overlay" />
    </div>
  </div>
{/if}

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
    transition: background 0.2s ease, transform 0.2s ease;
    transform-origin: center;
  }

  .boton-buscar-toggle:hover {
    background: #baff4e;
    transform: scale(1.05);
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
    transition: background 0.2s.ease;
    color: var(--color-fondo);
  }

  .paginacion button:hover {
    background: #baff4e;
  }

  .card-wrapper {
    width: 100%;
    cursor: pointer;
  }

  /* En el listado desactivamos los enlaces internos
     para que no naveguen a la página antigua */
  .card-wrapper a {
    pointer-events: none;
  }

  /* ============= OVERLAY ============= */

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.7);
  }

  .overlay-card {
    position: relative;
    width: min(1100px, 100%);
    max-height: calc(100vh - 24px);
    background: rgba(16, 16, 16, 0.9);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    overflow: auto;
    padding: 16px;
  }

  .overlay-cerrar {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 22px;
    cursor: pointer;
    z-index: 2;
  }
</style>