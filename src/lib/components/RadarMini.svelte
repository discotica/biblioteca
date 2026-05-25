<script>
  export let valores = {
    experimental: 0,
    denso: 0,
    sintetico: 0,
    bailable: 0,
    rapido: 0
  };

  const categorias = ['experimental', 'denso', 'sintetico', 'bailable', 'rapido'];
  const LABELS     = ['EXPERIMENTAL', 'DENSO', 'SINTÉTICO', 'BAILABLE', 'RÁPIDO'];

  const radioMax = 50;
  const center   = { x: 60, y: 65 };

  const clamp05 = (n) => {
    const x = Math.round(Number(n ?? 0));
    return Math.max(0, Math.min(5, x));
  };

  const normKey = (s) =>
    (s ?? '')
      .toString()
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, ''); // quita tildes

  function normalizarRadar(input) {
    const src = input && typeof input === 'object' ? input : {};
    const out = { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 };

    // 1) Copia por llaves normalizadas
    for (const [k, v] of Object.entries(src)) {
      const nk = normKey(k);
      if (nk in out) out[nk] = clamp05(v);
    }

    // 2) Aliases explícitos (por si llegan con tildes / variantes)
    // rápido
    out.rapido = out.rapido || clamp05(src['rápido'] ?? src['rapido'] ?? src['RADAR_RAPIDO'] ?? src['radar_rapido']);
    // sintético
    out.sintetico = out.sintetico || clamp05(src['sintético'] ?? src['sintetico'] ?? src['RADAR_SINTETICO'] ?? src['radar_sintetico']);
    // bailable (por si llega como "baile" o "danceable" algún día)
    out.bailable = out.bailable || clamp05(src['bailable'] ?? src['RADAR_BAILABLE'] ?? src['radar_bailable']);

    // experimental / denso
    out.experimental = out.experimental || clamp05(src['experimental'] ?? src['radar_experimental']);
    out.denso = out.denso || clamp05(src['denso'] ?? src['radar_denso']);

    return out;
  }

  $: radar = normalizarRadar(valores);

  function getPuntos(valorPorCategoria, escala = 1) {
    const anguloPaso = (2 * Math.PI) / categorias.length;
    return categorias.map((cat, i) => {
      const valor = clamp05(valorPorCategoria?.[cat] ?? 0);
      const radio = (valor / 5) * radioMax * escala;
      const angulo = -Math.PI / 2 + i * anguloPaso;
      const x = center.x + radio * Math.cos(angulo);
      const y = center.y + radio * Math.sin(angulo);
      return [x, y];
    });
  }

  $: puntos = getPuntos(radar);

  function puntosToPath(pts) {
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
  }

  const VERTICES_MAX = getPuntos(Object.fromEntries(categorias.map(c => [c, 5])));

  const LABEL_OFFSET = 10;

  function labelPosPorRegla(nombreCategoria, index) {
    const [vx, vy] = VERTICES_MAX[index];

    switch (nombreCategoria) {
      case 'experimental':
        return { x: vx, y: vy - LABEL_OFFSET, anchor: 'middle', baseline: 'middle' };

      case 'rapido':
        return { x: vx - LABEL_OFFSET, y: vy, anchor: 'end', baseline: 'middle' };

      case 'denso':
        return { x: vx + LABEL_OFFSET, y: vy, anchor: 'start', baseline: 'middle' };

      case 'bailable':
      case 'sintetico':
        return { x: vx, y: vy * 1.05 + LABEL_OFFSET, anchor: 'middle', baseline: 'middle' };

      default:
        return { x: vx, y: vy, anchor: 'middle', baseline: 'middle' };
    }
  }
</script>

<svg viewBox="0 0 120 130" class="radar-mini" aria-hidden={true} on:click|preventDefault|stopPropagation >
  <!-- Concentricos -->
  {#each Array(5) as _, nivel}
    <polygon
      points={
        getPuntos(Object.fromEntries(categorias.map(c => [c, nivel + 1])), 1)
          .map(([x, y]) => `${x},${y}`).join(' ')
      }
      fill="none"
      stroke="#f8ffee"
      stroke-width="0.5"
      stroke-opacity={(nivel + 1) / 5}
    />
  {/each}

  <!-- Radiales -->
  {#each categorias as _, i}
    {@const angle = -Math.PI / 2 + i * ((2 * Math.PI) / categorias.length)}
    {@const x = center.x + radioMax * Math.cos(angle)}
    {@const y = center.y + radioMax * Math.sin(angle)}
    <line x1={center.x} y1={center.y} x2={x} y2={y} stroke="#ccc" stroke-width="0.5" />
  {/each}

  <!-- Radar activo -->
  <path d={puntosToPath(puntos)} fill="#96f71988" stroke="#96f719" stroke-width="2" />

  <!-- Labels (verde, pequeño, sin bold) -->
  {#each categorias as nombre, i}
    {@const p = labelPosPorRegla(nombre, i)}
    <text
      x={p.x}
      y={p.y}
      text-anchor={p.anchor}
      dominant-baseline={p.baseline}
      font-size="7"
      fill="#96f719"
    >
      {LABELS[i]}
    </text>
  {/each}
</svg>

<style>
  .radar-mini {
    width: 100%;
    max-width: 120px;
    height: auto;
    display: block;
    overflow: visible; /* ← asegura que nada del SVG se recorte */
  }
</style>