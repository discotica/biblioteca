<script lang="ts">
  // Página de artista o de sello (U11): migas "Catálogo › Artista|Sello",
  // cabecera solo con el nombre, sin filtros internos, y la barra de
  // resultados del inicio (paginación "x de y", contador y orden).
  // La página vive en el componente: la query de esta URL es la búsqueda del
  // catálogo (incluida su `p`), que la miga "Catálogo" devuelve intacta.
  import { tick } from 'svelte';
  import { page } from '$app/stores';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import { catalogCrumb } from '$lib/layouts/crumbs';
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import LanzamientoModal from '$lib/components/LanzamientoModal.svelte';
  import SearchResultsBar from '$lib/components/SearchResultsBar.svelte';
  import Pagination from '$lib/ui/Pagination.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';
  import { normalizeReleaseDate } from '$lib/domain/releases';
  import { pageSlice, resultsSummary, totalPagesFor } from '$lib/domain/homeSearchView';

  /** Tipo de página: es la última miga. */
  export let kind: 'Artista' | 'Sello';
  export let name = '';
  export let releases: any[] = [];
  export let emptyMessage = '';

  const ORDERS = [
    { value: 'fecha-desc', label: 'Más reciente' },
    { value: 'fecha-asc', label: 'Más antiguo' },
    { value: 'titulo-asc', label: 'Título A → Z' },
    { value: 'titulo-desc', label: 'Título Z → A' }
  ];

  const byDate = (a: any, b: any) => normalizeReleaseDate(a.release_date).timestamp - normalizeReleaseDate(b.release_date).timestamp;
  const byTitle = (a: any, b: any) => (a.title ?? '').localeCompare(b.title ?? '');

  let order = 'fecha-desc';
  let currentPage = 1;
  let gridEl: HTMLElement | undefined;
  let activeRelease: any = null;

  $: catalog = catalogCrumb($page.url.search);

  $: sorted = (() => {
    const list = [...releases];
    switch (order) {
      case 'fecha-desc': return list.sort((a, b) => byDate(b, a));
      case 'fecha-asc': return list.sort(byDate);
      case 'titulo-asc': return list.sort(byTitle);
      case 'titulo-desc': return list.sort((a, b) => byTitle(b, a));
      default: return list;
    }
  })();

  $: totalPages = totalPagesFor(sorted.length);
  // Un orden o un conjunto nuevos vuelven a la primera página.
  $: sorted, (currentPage = 1);
  $: shownPage = Math.min(currentPage, totalPages);
  $: visible = pageSlice(sorted, shownPage);
  $: summary = resultsSummary(shownPage, totalPages, sorted.length);

  async function goToPage(next: number) {
    currentPage = next;
    await tick();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    gridEl?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }
</script>

<svelte:head>
  <title>{name} | Discótica</title>
</svelte:head>

<PageLayout breadcrumbs={[catalog, { label: kind }]} title={name}>
  {#if !sorted.length}
    <EmptyState message={emptyMessage} actionLabel="Volver al catálogo" actionHref={catalog.href} />
  {:else}
    <SearchResultsBar
      page={shownPage}
      {totalPages}
      {order}
      orders={ORDERS}
      {summary}
      viewToggle={false}
      on:page={(event) => goToPage(event.detail)}
      on:order={(event) => (order = event.detail)}
    />

    <div class="entity__grid lanzamientos-grilla" bind:this={gridEl}>
      {#each visible as release (release.id || release.slug)}
        <LanzamientoCard lanzamiento={release} onabrir={(next) => (activeRelease = next)} />
      {/each}
    </div>

    <div class="entity__bottom">
      {#if summary}<p class="entity__summary">{summary}</p>{/if}
      <Pagination page={shownPage} {totalPages} label="Paginación inferior de resultados" onchange={goToPage} />
    </div>
  {/if}
</PageLayout>

{#if activeRelease}
  {#key slugFromLanzamiento(activeRelease)}
    <LanzamientoModal lanzamiento={activeRelease} on:cerrar={() => (activeRelease = null)} />
  {/key}
{/if}

<style>
  .entity__grid { scroll-margin-top: var(--spacing-lg); }
  /* Mismo pie que el inicio: contador solo en móvil (en desktop va arriba) y paginación. */
  .entity__bottom { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); margin: var(--spacing-lg) 0 0; }
  .entity__summary { display: none; margin: 0; color: var(--color-texto-secundario); font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
  @media (max-width: 768px) {
    .entity__summary { display: block; }
  }
</style>
