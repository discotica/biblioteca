<script>
  import { onMount } from 'svelte';
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import LanzamientoModal from '$lib/components/LanzamientoModal.svelte';
  import Filtros from '$lib/components/Filtros.svelte';
  import RadarFiltros from '$lib/components/RadarFiltros.svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly, fade } from 'svelte/transition';
  import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';

  let lanzamientos = [];
  let lanzamientosFiltrados = [];
  let sugerencias = [];
  let cargandoTSV = true;
  let radarRef;
  let radarRefMobile;
  let mostrarPanelFiltros = false;
  let modalFiltrosMobile = false;
  let paginaActual = 1;

  // Modal
  let lanzamientoActivo = null;

  function abrirModal(lanzamiento) {
    lanzamientoActivo = lanzamiento;
    const slug = slugFromLanzamiento(lanzamiento);
    const params = new URLSearchParams(get(page).url.search);
    params.set('modal', slug);
    history.replaceState({}, '', `/?${params.toString()}`);
  }

  function cerrarModal() {
    lanzamientoActivo = null;
    const params = new URLSearchParams(get(page).url.search);
    params.delete('modal');
    const qs = params.toString();
    history.replaceState({}, '', qs ? `/?${qs}` : '/');
  }

  const lanzamientosPorPagina = 12;

  // Control de inicialización (para respetar ?p=... solo al cargar)
  let paginaDesdeURL = false;

  let syncingFromURL = false;
  let lastSeenQS = '';

  function readFiltersFromURL(sp) {
    const pQS = parseInt(sp.get('p') || '1', 10);
    const pagina = Number.isFinite(pQS) && pQS > 0 ? pQS : 1;

    return {
      paginaActual: pagina,
      filtros: {
        pais: sp.getAll('pais'),
        genero: sp.getAll('genero'),
        texto: sp.getAll('texto'),
        año: sanitizarAño(sp.get('año') || ''),
        mes: sanitizarMes(sp.get('mes') || ''),
        type: sp.get('type') || '',
        orden: sp.get('orden') || 'fecha-desc',
        radar: {
          experimental: parseInt(sp.get('radar_experimental')) || 0,
          denso:        parseInt(sp.get('radar_denso'))        || 0,
          sintetico:    parseInt(sp.get('radar_sintetico'))    || 0,
          bailable:     parseInt(sp.get('radar_bailable'))     || 0,
          rapido:       parseInt(sp.get('radar_rapido'))       || 0
        }
      }
    };
  }

  // Sync reactivo: si cambia la query en la misma ruta (/?...), actualiza filtros y re-filtra
  $: if (!cargandoTSV) {
    const qsNow = $page.url.searchParams.toString();
    if (qsNow !== lastSeenQS) {
      lastSeenQS = qsNow;

      syncingFromURL = true;
      const { paginaActual: p, filtros } = readFiltersFromURL($page.url.searchParams);

      paginaActual = p;
      filtrosSeleccionados = filtros;

      // Re-aplica sin re-escribir la URL (evita loop)
      aplicarTodosLosFiltros({ skipURL: true });
      syncingFromURL = false;
    }
  }
  
  

  $: totalPaginas = Math.max(1, Math.ceil(lanzamientosFiltrados.length / lanzamientosPorPagina));
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

function splitCSVish(value) {
  // Para celdas tipo: "Argentina, Colombia" o "Latinclub, Latinncore"
  // (sin comillas escapadas; suficiente para Google Sheets TSV típico)
  const s = (value ?? '').toString().trim();
  if (!s) return [];
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

function toInt01to5(v) {
  const n = Number((v ?? '').toString().trim());
  if (!Number.isFinite(n)) return 0;
  // Tu radar parece 0–5
  return Math.max(0, Math.min(5, Math.round(n)));
}

function normKey(s) {
  return (s ?? '')
    .toString()
    .replace(/^\uFEFF/, '')     // BOM
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita tildes
    .replace(/\s+/g, '_');      // espacios -> _
}

function parseTSV(tsvText) {
  const text = (tsvText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (!lines.length) return [];

  const headers = lines[0].split('\t').map(h => normKey(h));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (cols[c] ?? '').trim();
    }
    rows.push(obj);
  }
  return rows;
}
function parseTSVToLanzamientos(tsvText) {
  const rows = parseTSV(tsvText);

  return rows
    .map(r => {
      const artistArr  = splitCSVish(r.artist);  // "Shakti, EL MAMU" -> ["Shakti","EL MAMU"]
      const countryArr = splitCSVish(r.country);
      const genreArr   = splitCSVish(r.genre);
      const experimental = r.experimental ?? r.radar_experimental;
const denso        = r.denso ?? r.radar_denso;
const sintetico    = r.sintetico ?? r.sintetico_ ?? r.radar_sintetico;
const bailable     = r.bailable ?? r.bailable_ ?? r.radar_bailable;
const rapido       = r.rapido ?? r.rapido_ ?? r.radar_rapido;


      // Si alguien pone artist sin coma, igual queda ["X"]
      const artist = artistArr.length ? artistArr : ((r.artist ?? '').trim() ? [r.artist.trim()] : []);

      return {
        artist,
        title: (r.title ?? '').trim(),
        type: (r.type ?? '').trim(),
        country: countryArr,
        genre: genreArr,
        label: (r.label ?? '').trim(),
        release_date: (r.release_date ?? '').trim(),
        buy_link: (r.buy_link ?? '').trim(),
        review: (r.review ?? '').trim(),

radar: {
  experimental: toInt01to5(experimental),
  denso: toInt01to5(denso),
  sintetico: toInt01to5(sintetico),
  bailable: toInt01to5(bailable),
  rapido: toInt01to5(rapido)
},
        cover: (r.cover ?? '').trim()
      };
    })
    .filter(l => l.title || (l.artist && l.artist.length)); // evita filas vacías
}

  function panelIn(node, { duration = 200 } = {}) {
    return {
      duration,
      easing: cubicOut,
      css: (t) => `opacity: ${t}; transform: translateY(${(1 - t) * 8}px);`
    };
  }

  function panelOut(node, { duration = 180 } = {}) {
    const h = node.scrollHeight;
    return {
      duration,
      easing: cubicOut,
      css: (t) => `opacity: ${t}; overflow: hidden; height: ${h * t}px;`
    };
  }

  function s(n) { return n === 1 ? '' : 's'; }

  function irAPagina(p) {
    paginaActual = Math.max(1, Math.min(p, totalPaginas));
    actualizarURL();
    scrollTo(0, 0);
  }

  function getPaginasVisibles(actual, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const cercanas = new Set([1, total]);
    for (let i = Math.max(2, actual - 2); i <= Math.min(total - 1, actual + 2); i++) cercanas.add(i);
    const sorted = [...cercanas].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] > sorted[i - 1] + 1) result.push('...');
      result.push(sorted[i]);
    }
    return result;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // Parser robusto: soporta ISO YYYY-MM-DD y DD/MM/YYYY (común en CO)
  function parseReleaseDate(raw) {
    const s = (raw ?? '').toString().trim();
    if (!s) return { time: 0, year: '', month: '' };

    // ISO: YYYY-MM-DD (o YYYY-MM-DDTHH:mm...)
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const y = m[1];
      const mo = pad2(m[2]);
      const d = pad2(m[3]);
      const time = Date.UTC(Number(y), Number(mo) - 1, Number(d));
      return { time, year: y, month: mo };
    }

    // Slash: DD/MM/YYYY (o D/M/YY)
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const d = pad2(m[1]);
      const mo = pad2(m[2]);
      let y = m[3];
      if (y.length === 2) y = `20${y}`;
      const time = Date.UTC(Number(y), Number(mo) - 1, Number(d));
      return { time, year: y, month: mo };
    }

    // Fallback: Date.parse (último recurso)
    const t = Date.parse(s);
    if (!Number.isNaN(t)) {
      const dt = new Date(t);
      const y = String(dt.getUTCFullYear());
      const mo = pad2(dt.getUTCMonth() + 1);
      return { time: t, year: y, month: mo };
    }

    return { time: 0, year: '', month: '' };
  }

  function sanitizarAño(val) {
    const a = (val ?? '').toString().trim();
    return /^\d{4}$/.test(a) ? a : '';
  }

  function sanitizarMes(val) {
    const m = (val ?? '').toString().trim();
    if (!m) return '';
    if (/^\d{1,2}$/.test(m)) {
      const n = Number(m);
      return n >= 1 && n <= 12 ? pad2(n) : '';
    }
    return '';
  }

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
    dateKey = 'release_date',
    secondaryCmp = null
  } = {}) {
    const b = toVec(targetRadar);
    const scored = lista.map(l => {
      const a = toVec(l.radar || {});
      return {
        item: l,
        score: radarScore(a, b, weights, mode),
        maxDiff: maxAxisDiff(a, b),
        date: parseReleaseDate(l?.[dateKey]).time
      };
    });

    let T = tolStart;
    let gated = scored.filter(x => x.maxDiff <= T);
    while (gated.length < pageSize && T < tolMax) {
      T += tolStep;
      gated = scored.filter(x => x.maxDiff <= T);
    }

    gated.sort((x, y) => {
      const primary = x.score - y.score;
      if (primary) return primary;
      const secondary = secondaryCmp ? secondaryCmp(x.item, y.item) : 0;
      if (secondary) return secondary;
      return y.date - x.date;
    });

    const outGate = scored.filter(x => x.maxDiff > T)
                          .sort((x, y) => {
                            const primary = x.score - y.score;
                            if (primary) return primary;
                            const secondary = secondaryCmp ? secondaryCmp(x.item, y.item) : 0;
                            if (secondary) return secondary;
                            return y.date - x.date;
                          });

    return [...gated, ...outGate].map(x => x.item);
  }

  // --- Chips always-visible ---
  function eliminarFiltroLista(key, valor) {
    filtrosSeleccionados = {
      ...filtrosSeleccionados,
      [key]: filtrosSeleccionados[key].filter(v => v !== valor)
    };
    aplicarTodosLosFiltros();
  }

  function limpiarFiltroSimple(key) {
    filtrosSeleccionados = { ...filtrosSeleccionados, [key]: '' };
    aplicarTodosLosFiltros();
  }

  $: contarFiltrosActivos =
    filtrosSeleccionados.pais.length +
    filtrosSeleccionados.genero.length +
    filtrosSeleccionados.texto.length +
    (filtrosSeleccionados.año ? 1 : 0) +
    (filtrosSeleccionados.mes ? 1 : 0) +
    (filtrosSeleccionados.type ? 1 : 0) +
    (RADAR_KEYS.some(k => Number(filtrosSeleccionados.radar?.[k] ?? 0) > 0) ? 1 : 0);

  $: hayFiltrosActivos =
    filtrosSeleccionados.pais.length > 0 ||
    filtrosSeleccionados.genero.length > 0 ||
    filtrosSeleccionados.texto.length > 0 ||
    !!filtrosSeleccionados.año ||
    !!filtrosSeleccionados.mes ||
    !!filtrosSeleccionados.type ||
    RADAR_KEYS.some(k => Number(filtrosSeleccionados.radar?.[k] ?? 0) > 0);

  const NOMBRE_MES_PAGE = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  function abrirFiltrosMobile() {
    modalFiltrosMobile = true;
    document.body.style.overflow = 'hidden';
  }

  function cerrarFiltrosMobile() {
    modalFiltrosMobile = false;
    document.body.style.overflow = '';
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
    radarRefMobile?.resetRadar();
    aplicarTodosLosFiltros();
  }

  onMount(async () => {

    cargandoTSV = true;

    const TSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vScoTP0-0jq3HAGMIzxS9NOSHsgXx4bxjlFKSPtuFq26OLJ5QCTtulXm328Bdl5lMHzpiOO5ffkpvE4/pub?gid=1229139332&single=true&output=tsv';

    try {
      const res = await fetch(TSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`TSV fetch failed: ${res.status}`);
      const tsvText = await res.text();
      lanzamientos = parseTSVToLanzamientos(tsvText);
    } catch (err) {
      console.error('Error cargando TSV:', err);
      lanzamientos = [];
    }

    cargandoTSV = false;

    const query = new URLSearchParams(get(page).url.search);
    const pQS = parseInt(query.get('p') || '1', 10);
    paginaActual = Number.isFinite(pQS) && pQS > 0 ? pQS : 1;
    paginaDesdeURL = true;

    // pais/genero/texto desde URL siempre como arrays
    const paisQS   = query.getAll('pais');
    const generoQS = query.getAll('genero');
    const textoQS  = query.getAll('texto');

    filtrosSeleccionados = {
      pais: paisQS.length ? paisQS : [],
      genero: generoQS.length ? generoQS : [],
      texto: textoQS.length ? textoQS : [],
      año: sanitizarAño(query.get('año') || ''),
      mes: sanitizarMes(query.get('mes') || ''),
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
    const upto = Math.max(1, paginaActual) * lanzamientosPorPagina;
    lanzamientosFiltrados = ordenarLanzamientos(lanzamientos.slice(0, upto));

    // Luego filtra todo sin bloquear render
    setTimeout(aplicarTodosLosFiltros, 50);

    // Abrir modal si la URL tiene ?modal=[slug]
    const modalSlug = query.get('modal');
    if (modalSlug) {
      const target = lanzamientos.find(l => slugFromLanzamiento(l) === modalSlug);
      if (target) {
        abrirModal(target); // abrirModal maneja la URL preservando los filtros
      } else {
        query.delete('modal');
        const qs = query.toString();
        history.replaceState({}, '', qs ? `/?${qs}` : '/');
      }
    }

    // Cierra dropdowns al click global
    const manejarClickGlobal = (event) => {
      document.querySelectorAll('.dropdown[open]').forEach((dropdown) => {
        if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
      });
    };
    document.addEventListener('click', manejarClickGlobal);
    return () => {
      document.removeEventListener('click', manejarClickGlobal);
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
      año:    sanitizarAño(detail.año ?? ''),
      mes:    sanitizarMes(detail.mes ?? ''),
      type:   detail.type ?? '',
      orden:  detail.orden ?? 'fecha-desc'
    };
    paginaActual = 1;
    paginaDesdeURL = false;
    aplicarTodosLosFiltros();
  }

  function actualizarRadar(event) {
    const r = event.detail || {};
    filtrosSeleccionados.radar = Object.fromEntries(
      RADAR_KEYS.map(k => [k, Math.round(Number(r[k] ?? 0))])
    );
    paginaActual = 1;
    paginaDesdeURL = false;
    aplicarTodosLosFiltros();
  }

  function getOrdenComparator(orden) {
    const cmpStr = (a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

    switch (orden) {
      case 'fecha-desc':
        return (a,b) => parseReleaseDate(b.release_date).time - parseReleaseDate(a.release_date).time;
      case 'fecha-asc':
        return (a,b) => parseReleaseDate(a.release_date).time - parseReleaseDate(b.release_date).time;
      case 'artista-asc':
        return (a,b) => {
          const A = Array.isArray(a.artist) ? a.artist[0] || '' : (a.artist || '');
          const B = Array.isArray(b.artist) ? b.artist[0] || '' : (b.artist || '');
          return cmpStr(A, B);
        };
      case 'artista-desc':
        return (a,b) => {
          const A = Array.isArray(a.artist) ? a.artist[0] || '' : (a.artist || '');
          const B = Array.isArray(b.artist) ? b.artist[0] || '' : (b.artist || '');
          return cmpStr(B, A);
        };
      case 'titulo-asc':
        return (a,b) => cmpStr(a.title, b.title);
      case 'titulo-desc':
        return (a,b) => cmpStr(b.title, a.title);
      default:
        return () => 0;
    }
  }

  function ordenarLanzamientos(lista) {
    const orden = filtrosSeleccionados.orden;
    const cmp = getOrdenComparator(orden);
    return [...lista].sort(cmp);
  }

function aplicarTodosLosFiltros({ skipURL = false } = {}) {
  const base = lanzamientos.filter((l) => {
    const coincidePais =
      filtrosSeleccionados.pais.length === 0 ||
      filtrosSeleccionados.pais.some((p) =>
        (l.country || []).some((c) => normalizar(c) === normalizar(p))
      );

    const coincideGenero =
      filtrosSeleccionados.genero.length === 0 ||
      filtrosSeleccionados.genero.some((g) =>
        (l.genre || []).some((gg) => normalizar(gg) === normalizar(g))
      );

    const { year, month } = parseReleaseDate(l.release_date);

    const coincideAño =
      !filtrosSeleccionados.año || year === String(filtrosSeleccionados.año);

    const coincideMes =
      !filtrosSeleccionados.mes || month === String(filtrosSeleccionados.mes);

    const coincideTipo =
      !filtrosSeleccionados.type || l.type === filtrosSeleccionados.type;

    const coincideTxt =
      filtrosSeleccionados.texto.length === 0 ||
      coincideTexto(l, filtrosSeleccionados.texto);

    return (
      coincidePais &&
      coincideGenero &&
      coincideAño &&
      coincideMes &&
      coincideTipo &&
      coincideTxt
    );
  });

  const radarActivo = RADAR_KEYS.some(
    (k) => Number(filtrosSeleccionados.radar?.[k] ?? 0) > 0
  );

  const resultado = radarActivo
    ? rankByRadarElastic(base, filtrosSeleccionados.radar, {
        weights: null,
        mode: 'hybrid',
        tolStart: 0,
        tolStep: 1,
        tolMax: 5,
        pageSize: lanzamientosPorPagina,
        secondaryCmp: getOrdenComparator(filtrosSeleccionados.orden)
      })
    : ordenarLanzamientos(base);

  const total = Math.max(1, Math.ceil(resultado.length / lanzamientosPorPagina));
  if (paginaActual > total) paginaActual = total;
  if (paginaActual < 1) paginaActual = 1;

  lanzamientosFiltrados = resultado;

  sugerencias =
    lanzamientosFiltrados.length === 0 && filtrosSeleccionados.texto.length
      ? ordenarLanzamientos(
          lanzamientos.filter((l) =>
            filtrosSeleccionados.texto.some((t) => {
              const termino = normalizar(t);
              const artistas = (l.artist || []).map(normalizar);
              return (
                artistas.some((a) => a.includes(termino)) ||
                normalizar(l.title).includes(termino) ||
                normalizar(l.label).includes(termino)
              );
            })
          )
        )
      : [];

  if (!skipURL && !syncingFromURL) actualizarURL();
}


  let timeout;
  function actualizarURL() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    const params = new URLSearchParams();
    const { pais, genero, texto, año, mes, type, orden, radar } = filtrosSeleccionados;

    for (const p of pais) params.append('pais', p);
    for (const g of genero) params.append('genero', g);
    for (const t of texto) params.append('texto', t);

    if (año) params.set('año', String(año));
    if (mes) params.set('mes', String(mes));
    if (type) params.set('type', type);
    if (orden) params.set('orden', orden);

    for (const [k, v] of Object.entries(radar || {})) {
      if (Number(v) > 0) params.set(`radar_${k}`, String(v));
    }

    params.set('p', String(paginaActual));

    if (lanzamientoActivo) {
      params.set('modal', slugFromLanzamiento(lanzamientoActivo));
    }

const nextQs = params.toString();
const currQs = get(page).url.searchParams.toString();
if (nextQs === currQs) return;

goto(`?${nextQs}`, { replaceState: true, noScroll: true });
  }, 400);
}

</script>

<!-- BOTÓN PARA MOSTRAR/OCULTAR FILTROS -->
<div class="boton-buscar-contenedor">
  <button
    class="boton-buscar-toggle"
    class:boton-buscar-toggle--idle={!mostrarPanelFiltros}
    on:click={() => mostrarPanelFiltros = !mostrarPanelFiltros}
  >
    {#if mostrarPanelFiltros}
      ✖ Cerrar búsqueda
    {:else}
      🔍 Buscar
    {/if}
  </button>
</div>

{#if hayFiltrosActivos}
<div class="filtros-activos container">
  {#each filtrosSeleccionados.pais as pais}
    <span class="chip-activo">{pais} <button on:click={() => eliminarFiltroLista('pais', pais)}>×</button></span>
  {/each}
  {#each filtrosSeleccionados.genero as genero}
    <span class="chip-activo">{genero} <button on:click={() => eliminarFiltroLista('genero', genero)}>×</button></span>
  {/each}
  {#each filtrosSeleccionados.texto as texto}
    <span class="chip-activo">"{texto}" <button on:click={() => eliminarFiltroLista('texto', texto)}>×</button></span>
  {/each}
  {#if filtrosSeleccionados.año}
    <span class="chip-activo">{filtrosSeleccionados.año} <button on:click={() => limpiarFiltroSimple('año')}>×</button></span>
  {/if}
  {#if filtrosSeleccionados.mes}
    <span class="chip-activo">{NOMBRE_MES_PAGE[filtrosSeleccionados.mes] ?? filtrosSeleccionados.mes} <button on:click={() => limpiarFiltroSimple('mes')}>×</button></span>
  {/if}
  {#if filtrosSeleccionados.type}
    <span class="chip-activo">{filtrosSeleccionados.type} <button on:click={() => limpiarFiltroSimple('type')}>×</button></span>
  {/if}
  {#if RADAR_KEYS.some(k => Number(filtrosSeleccionados.radar?.[k] ?? 0) > 0)}
    <span class="chip-activo chip-activo--radar">Radar <button on:click={() => { filtrosSeleccionados.radar = {experimental:0,denso:0,sintetico:0,bailable:0,rapido:0}; radarRef?.resetRadar(); aplicarTodosLosFiltros(); }}>×</button></span>
  {/if}
</div>
{/if}

{#if mostrarPanelFiltros}
<section class="filtros-wrap container" in:panelIn out:panelOut>
  <div class="filtros-grid">
    <div class="filtros-col filtros-col--form">
      <Filtros
        {lanzamientos}
        valores={filtrosSeleccionados}
        on:filtrar={actualizarFiltros}
      />
    </div>

    <div class="filtros-col filtros-col--radar">
      <div class="radar-panel">
        <RadarFiltros
          radar={filtrosSeleccionados.radar}
          bind:this={radarRef}
          on:filtrarRadar={actualizarRadar}
        />
      </div>
    </div>

    <div class="filtros-col filtros-col--acciones">
      <button class="btn-outline" on:click={reiniciarFiltrosYRadar}>
        Reiniciar filtros
      </button>
    </div>
  </div>
</section>
{/if}

{#if totalPaginas > 1}
<div class="paginacion">
  <button class="paginacion__nav" on:click={() => irAPagina(paginaActual - 1)} disabled={paginaActual <= 1} aria-label="Página anterior">‹</button>

  {#each getPaginasVisibles(paginaActual, totalPaginas) as p}
    {#if p === '...'}
      <span class="paginacion__ellipsis">…</span>
    {:else}
      <button
        class="paginacion__btn"
        class:paginacion__btn--active={p === paginaActual}
        on:click={() => irAPagina(p)}
        aria-label="Página {p}"
        aria-current={p === paginaActual ? 'page' : undefined}
      >{p}</button>
    {/if}
  {/each}

  <button class="paginacion__nav" on:click={() => irAPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas} aria-label="Página siguiente">›</button>
</div>
{/if}

<section class="resultados container">

{#if cargandoTSV}
  <div class="loader" aria-label="Cargando catálogo">
    <span class="loader__dot"></span>
    <span class="loader__dot"></span>
    <span class="loader__dot"></span>
    <span class="loader__label">Cargando lanzamientos</span>
  </div>
{/if}

<p class="resultados__contador" class:resultados__contador--hidden={cargandoTSV}>
  {#if lanzamientosFiltrados.length > 0}
    {#if totalPaginas > 1}
      {(paginaActual - 1) * lanzamientosPorPagina + 1}–{Math.min(paginaActual * lanzamientosPorPagina, lanzamientosFiltrados.length)} de {lanzamientosFiltrados.length} lanzamiento{s(lanzamientosFiltrados.length)}
    {:else}
      {lanzamientosFiltrados.length} lanzamiento{s(lanzamientosFiltrados.length)}
    {/if}
  {:else}
    No se encontraron lanzamientos con esos filtros.
  {/if}
</p>

  <div class="resultados__grid" class:resultados__grid--hidden={cargandoTSV}>
    {#if lanzamientosFiltrados.length > 0}
{#each lanzamientosPaginados as lanzamiento, i}
  {@const debugKey = `${i}::${lanzamiento?.title ?? 'SIN_TITULO'}::${(lanzamiento?.artist?.[0] ?? 'SIN_ARTISTA')}`}

  <LanzamientoCard
    {lanzamiento}
    variant="grid"
    openInModal={true}
    on:abrir={(e) => abrirModal(e.detail)}
  />
{/each}
    {:else if sugerencias.length > 0}
      <p class="resultados__sugerencia">Sugerencias cercanas:</p>
      {#each sugerencias as lanzamiento}
        <LanzamientoCard
          {lanzamiento} variant="grid"
          openInModal={true}
          on:abrir={(e) => abrirModal(e.detail)}
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
      <button class="paginacion__nav" on:click={() => irAPagina(paginaActual - 1)} disabled={paginaActual <= 1} aria-label="Página anterior">‹</button>

      {#each getPaginasVisibles(paginaActual, totalPaginas) as p}
        {#if p === '...'}
          <span class="paginacion__ellipsis">…</span>
        {:else}
          <button
            class="paginacion__btn"
            class:paginacion__btn--active={p === paginaActual}
            on:click={() => irAPagina(p)}
            aria-label="Página {p}"
            aria-current={p === paginaActual ? 'page' : undefined}
          >{p}</button>
        {/if}
      {/each}

      <button class="paginacion__nav" on:click={() => irAPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas} aria-label="Página siguiente">›</button>
    </div>
  {/if}
</section>

<!-- Mobile FAB: only visible on mobile -->
<button
  class="fab-mobile"
  on:click={abrirFiltrosMobile}
  aria-label="Abrir filtros de búsqueda"
>
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.8"/>
    <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
  {#if contarFiltrosActivos > 0}
    <span class="fab-badge">{contarFiltrosActivos}</span>
  {/if}
</button>

<!-- Mobile filter bottom-sheet modal -->
{#if modalFiltrosMobile}
  <div
    class="filtros-mobile-backdrop"
    transition:fade={{ duration: 180 }}
    on:click={cerrarFiltrosMobile}
    role="presentation"
  ></div>
  <div
    class="filtros-mobile-sheet"
    transition:fly={{ y: 500, duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-label="Filtros de búsqueda"
  >
    <div class="filtros-mobile-header">
      <span class="filtros-mobile-title">Filtros</span>
      <button class="filtros-mobile-close" on:click={cerrarFiltrosMobile} aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <line x1="3" y1="3" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="15" y1="3" x2="3" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="filtros-mobile-body">
      <Filtros
        {lanzamientos}
        valores={filtrosSeleccionados}
        on:filtrar={actualizarFiltros}
      />
      <div class="radar-panel">
        <RadarFiltros
          radar={filtrosSeleccionados.radar}
          bind:this={radarRefMobile}
          on:filtrarRadar={actualizarRadar}
        />
      </div>
      <button class="btn-outline" on:click={reiniciarFiltrosYRadar}>
        Reiniciar filtros
      </button>
    </div>
  </div>
{/if}

{#if lanzamientoActivo}
  <LanzamientoModal
    lanzamiento={lanzamientoActivo}
    on:cerrar={cerrarModal}
  />
{/if}

<style>
@import '$lib/styles/styles.css';

/* Toggle mostrar/ocultar (más compacto y moderno) */
.boton-buscar-contenedor{
  display:flex;
  justify-content:center;
  margin: var(--spacing-md) 0;
}

.boton-buscar-toggle{
  appearance:none;
  border: 1px solid rgba(150,247,25,.45);
  background: rgba(150,247,25,.10);
  color: var(--color-texto);
  border-radius: 999px;
  padding: .78rem 1.25rem;
  cursor:pointer;
  font-family: var(--font-base);
  font-size: .98rem;
  font-weight: 800;
  line-height: 1;
  position: relative;
  overflow: hidden;
  transition: transform 120ms ease, filter 120ms ease, border-color 120ms ease, background 120ms ease;
}

.boton-buscar-toggle:hover{
  filter: brightness(1.08);
  border-color: rgba(150,247,25,.70);
  transform: translateY(-1px);
}

.boton-buscar-toggle:active{ transform: translateY(0px); }

/* Estado pasivo: más llamativo + light sweep */
.boton-buscar-toggle--idle{
  background: rgba(150,247,25,.16);
  border-color: rgba(150,247,25,.75);
  box-shadow: 0 0 0 1px rgba(150,247,25,.10), 0 18px 45px rgba(0,0,0,.28);
}

.boton-buscar-toggle--idle::after{
  content: "";
  position: absolute;
  top: -20%;
  left: -35%;
  width: 30%;
  height: 140%;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,.85) 100%,
    rgba(255,255,255,0) 100%
  );
  mix-blend-mode: overlay;
  opacity: 1;
  transform: skewX(-18deg);
  animation: sweep 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes sweep{
  0%   { transform: translateX(-40%) skewX(-18deg); opacity: 0; }
  22%  { transform: translateX(-40%) skewX(-18deg); opacity: 0; }
  30%  { opacity: .85; }
  70%  { transform: translateX(440%) skewX(-18deg); opacity: .65; }
  78%  { opacity: 0; }
  100% { transform: translateX(440%) skewX(-18deg); opacity: 0; }
}

/* Layout panel filtros */
.filtros-wrap{ margin-top: .25rem; }

.filtros-grid{
  display:grid;
  gap: 1rem;
  align-items:start;
}

@media (min-width: 980px){
  .filtros-grid{
    grid-template-columns: 1.2fr .8fr;
    grid-template-areas:
      "form radar"
      "acciones radar";
  }
  .filtros-col--form{ grid-area: form; }
  .filtros-col--radar{ grid-area: radar; }
  .filtros-col--acciones{ grid-area: acciones; }
}

/* Panel radar (para que no se vea suelto) */
.radar-panel{
  background: rgba(255,255,255,.02);
  border: 1px solid var(--color-borde);
  border-radius: 18px;
  padding: 1.25rem;
  box-shadow: 0 18px 50px rgba(0,0,0,.22);
}


/* Botón outline (reiniciar) */
.btn-outline{
  appearance:none;
  width: 100%;
  border: 1px solid rgba(150,247,25,.45);
  background: rgba(150,247,25,.3);
  color: var(--color-texto);
  border-radius: 999px;
  padding: .75rem 1rem;
  cursor:pointer;
  font-family: var(--font-base);
  font-size: .92rem;
  font-weight: 500;
  line-height: 1;
  transition: transform 120ms ease, filter 120ms ease, border-color 120ms ease;
}

.btn-outline:hover{
  filter: brightness(1.06);
  border-color: rgba(150,247,25,.65);
  transform: translateY(-1px);
}

.btn-outline:active{ transform: translateY(0px); }

/* Resultados grid (se mantiene tu lógica, se afina espaciado) */
.resultados__grid{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.15rem;
  align-items:start;
  justify-items:stretch;
}

@media (min-width: 640px){
  .resultados__grid{ grid-template-columns: 1fr 1fr; }
}

@media (min-width: 1024px){
  .resultados__grid{ grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
}

/* Paginación */
.paginacion {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: .3rem;
  flex-wrap: wrap;
}

.paginacion__nav {
  appearance: none;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .03);
  color: var(--color-texto);
  border-radius: 999px;
  cursor: pointer;
  font-size: 1.15rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, border-color 120ms ease, transform 100ms ease;
  flex-shrink: 0;
}

.paginacion__nav:disabled {
  opacity: .28;
  cursor: default;
  pointer-events: none;
}

.paginacion__nav:not(:disabled):hover {
  background: rgba(255, 255, 255, .07);
  border-color: rgba(255, 255, 255, .18);
  transform: translateY(-1px);
}

.paginacion__nav:active { transform: translateY(0); }

.paginacion__btn {
  appearance: none;
  min-width: 36px;
  height: 36px;
  padding: 0 .5rem;
  border: 1px solid rgba(255, 255, 255, .07);
  background: rgba(255, 255, 255, .02);
  color: rgba(248, 255, 238, .5);
  border-radius: 10px;
  cursor: pointer;
  font-size: .88rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-base);
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, transform 100ms ease;
}

.paginacion__btn:hover {
  background: rgba(255, 255, 255, .06);
  border-color: rgba(255, 255, 255, .14);
  color: var(--color-texto);
  transform: translateY(-1px);
}

.paginacion__btn:active { transform: translateY(0); }

.paginacion__btn--active {
  background: rgba(150, 247, 25, .14);
  border-color: rgba(150, 247, 25, .5);
  color: var(--color-acento);
  cursor: default;
  pointer-events: none;
}

.paginacion__ellipsis {
  min-width: 24px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(248, 255, 238, .22);
  font-size: .88rem;
  user-select: none;
}

/* Always-visible active filter chips */
.filtros-activos {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  margin-top: -.35rem;
  margin-bottom: .6rem;
}

.chip-activo {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  background: rgba(150, 247, 25, .12);
  border: 1px solid rgba(150, 247, 25, .38);
  color: var(--color-acento);
  border-radius: 999px;
  padding: .35rem .65rem;
  font-size: .78rem;
  font-weight: 600;
  line-height: 1;
}

.chip-activo button {
  background: none;
  border: none;
  color: var(--color-acento);
  cursor: pointer;
  padding: 0;
  font-size: .92rem;
  line-height: 1;
  font-weight: 800;
  opacity: .75;
  transition: opacity 100ms ease;
}

.chip-activo button:hover { opacity: 1; }

.chip-activo--radar {
  background: rgba(150, 247, 25, .07);
  border-color: rgba(150, 247, 25, .25);
}

/* ---- Mobile FAB ---- */
.fab-mobile {
  display: none;
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  z-index: 490;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1.5px solid rgba(150, 247, 25, .6);
  background: rgba(13, 13, 13, .92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: var(--color-acento);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, .45), 0 0 0 1px rgba(150, 247, 25, .1);
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  padding: 0;
}

.fab-mobile:hover {
  transform: scale(1.06);
  border-color: rgba(150, 247, 25, .9);
  box-shadow: 0 10px 38px rgba(0, 0, 0, .5), 0 0 0 3px rgba(150, 247, 25, .12);
}

.fab-mobile:active { transform: scale(.97); }

.fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--color-acento);
  color: #0d0d0d;
  border-radius: 999px;
  font-size: .65rem;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
}

@media (max-width: 768px) {
  .boton-buscar-contenedor { display: none; }
  .fab-mobile { display: flex; }
}

/* ---- Mobile filter bottom-sheet ---- */
.filtros-mobile-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 500;
}

.filtros-mobile-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 501;
  max-height: 88vh;
  border-radius: 22px 22px 0 0;
  background: rgba(14, 14, 14, .98);
  border-top: 1px solid rgba(255, 255, 255, .09);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -20px 60px rgba(0, 0, 0, .55);
}

.filtros-mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.25rem .85rem;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  flex-shrink: 0;
}

.filtros-mobile-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-texto);
  letter-spacing: .03em;
}

.filtros-mobile-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .04);
  color: rgba(248, 255, 238, .55);
  cursor: pointer;
  padding: 0;
  transition: background 120ms ease, color 120ms ease;
}

.filtros-mobile-close:hover {
  background: rgba(255, 255, 255, .08);
  color: var(--color-texto);
}

.filtros-mobile-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  flex: 1;
  min-height: 0;
  padding-bottom: 2rem;
}

.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  height: 60vh;
}

.loader__dot-row {
  display: flex;
  gap: 10px;
}

.loader__label {
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: rgba(248, 255, 238, .35);
}

.loader__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #96f719;
  animation: loader-pulse 1.1s ease-in-out infinite;
}
.loader__dot:nth-child(2) { animation-delay: .18s; }
.loader__dot:nth-child(3) { animation-delay: .36s; }

@keyframes loader-pulse {
  0%, 100% { opacity: .18; transform: scale(.75); }
  50%       { opacity: 1;   transform: scale(1); }
}

.resultados__contador--hidden { visibility: hidden; }
.resultados__grid--hidden     { visibility: hidden; }
</style>