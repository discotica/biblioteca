<script lang="ts">
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  export let data;

  let ordenSeleccionado = 'fecha-desc';

  // Render progresivo para sellos grandes (sin paginacion visible)
  const LOTE = 36;
  let visibles = LOTE;

  // Reactivo: se actualiza si cambia `data`
  $: lanzamientos = data?.lanzamientos ?? [];
  $: nombreSello = data?.nombreSello ?? '';

  // Volver a la búsqueda con pagina/filtros (mantener query string)
  $: volverHref = `/${$page?.url?.search ?? ''}`;

  function volver() {
    if (history.length > 1) history.back();
    else goto(volverHref);
  }

  function pad2(n: number) {
    return String(n).padStart(2, '0');
  }

  function parseReleaseDate(raw: any) {
    const s = (raw ?? '').toString().trim();
    if (!s) return { time: 0 };

    // ISO: YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const y = m[1];
      const mo = pad2(Number(m[2]));
      const d = pad2(Number(m[3]));
      return { time: Date.UTC(Number(y), Number(mo) - 1, Number(d)) };
    }

    // Slash: DD/MM/YYYY
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const d = pad2(Number(m[1]));
      const mo = pad2(Number(m[2]));
      let y: any = m[3];
      if (y.length === 2) y = `20${y}`;
      return { time: Date.UTC(Number(y), Number(mo) - 1, Number(d)) };
    }

    const t = Date.parse(s);
    return { time: Number.isNaN(t) ? 0 : t };
  }

  $: lanzamientosOrdenados = (() => {
    switch (ordenSeleccionado) {
      case 'fecha-desc':
        return [...lanzamientos].sort(
          (a, b) => parseReleaseDate(b.release_date).time - parseReleaseDate(a.release_date).time
        );
      case 'fecha-asc':
        return [...lanzamientos].sort(
          (a, b) => parseReleaseDate(a.release_date).time - parseReleaseDate(b.release_date).time
        );
      case 'titulo-asc':
        return [...lanzamientos].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
      case 'titulo-desc':
        return [...lanzamientos].sort((a, b) => (b.title ?? '').localeCompare(a.title ?? ''));
      default:
        return [...lanzamientos];
    }
  })();

  $: total = lanzamientosOrdenados.length;
  $: visibles = Math.min(visibles, total || LOTE);
  $: lanzamientosVisibles = lanzamientosOrdenados.slice(0, visibles);

  // Si cambia el orden o el dataset, reinicia el render progresivo
  $: if (lanzamientosOrdenados) {
    visibles = Math.min(LOTE, total || LOTE);
  }

  function cargarMas() {
    visibles = Math.min(total, visibles + LOTE);
  }

  onMount(() => {
    // En sellos muy grandes, completa el render en segundo plano por frames
    // (sin UI de paginacion)
    let raf = 0;
    const step = () => {
      if (visibles < total) {
        visibles = Math.min(total, visibles + LOTE);
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
</script>


<svelte:head>
  <title>{nombreSello} | Discótica</title>
</svelte:head>

<main class="main">
  <div class="container">
    <div class="botones-header">


<button class="boton-volver" type="button" on:click={volver}>
  ← Volver
</button>
      <label>
        Ordenar por:
        <select bind:value={ordenSeleccionado}>
          <option value="fecha-desc">Más reciente</option>
          <option value="fecha-asc">Más antiguo</option>
          <option value="titulo-asc">Título A → Z</option>
          <option value="titulo-desc">Título Z → A</option>
        </select>
      </label>
    </div>

    <div class="cabecera-artista">
      <span class="etiqueta">Sello</span>
      <h1 class="nombre-artista">{nombreSello}</h1>
    </div>

    {#if lanzamientosOrdenados.length === 0}
      <p class="mensaje-vacio">Este sello aún no tiene lanzamientos registrados en Discótica.</p>
    {:else}
      <div class="resultados__grid">
        {#each lanzamientosVisibles as lanzamiento}
          <LanzamientoCard {lanzamiento} variant="grid" />
        {/each}
      </div>
      {#if visibles < lanzamientosOrdenados.length}
        <button class="cargar-mas" type="button" on:click={cargarMas}>
          Cargar más
        </button>
      {/if}
    {/if}
  </div>
</main>

<style>
  @import '$lib/styles/styles.css';

  .main {
    min-height: calc(100vh - 160px);
    padding-bottom: var(--spacing-lg);
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-md);
    box-sizing: border-box;
  }

  .cabecera-artista {
    text-align: center;
    margin-bottom: var(--spacing-md);
  }

  .etiqueta {
    font-size: 0.85rem;
    color: var(--color-texto-secundario);
    text-transform: uppercase;
    letter-spacing: 1px;
    display: block;
    margin-bottom: -.5rem;
  }

  .nombre-artista {
    font-size: 2.5rem;
    color: var(--color-acento);
    margin: 0;
  }

  .mensaje-vacio {
    color: var(--color-texto-secundario);
    font-style: italic;
    font-size: 1rem;
    padding: var(--spacing-md);
  }

  .resultados__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--spacing-md);
    align-items: start;
    justify-items: stretch;
  }

  .botones-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm);
    margin: var(--spacing-md) 0;
    flex-wrap: nowrap;
    flex-direction: row;
  }

  .botones-header label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .botones-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .botones-header label {
      width: 100%;
      justify-content: space-between;
    }

    .botones-header select {
      width: 100%;
    }

    .boton-volver {
      width: 100%;
    }
  }

  .boton-volver {
    font-size: 1rem;
    font-weight: 700;
    background: var(--color-acento);
    color: var(--color-fondo);
    border: none;
    border-radius: var(--radius-base);
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    transition: background 0.2s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .boton-volver:hover {
    background: #baff4e;
  }

  select {
    font-size: 0.95rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    color: var(--color-texto);
    border: 1px solid var(--color-borde);
  }

  .cargar-mas{
    margin-top: var(--spacing-md);
    background: transparent;
    color: var(--color-texto);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-base);
    padding: 0.65rem 1rem;
    cursor: pointer;
  }
  .cargar-mas:hover{
    border-color: var(--color-acento);
    color: var(--color-acento);
  }
</style>