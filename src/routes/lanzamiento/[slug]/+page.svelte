<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import LanzamientoVista from '$lib/components/LanzamientoVista.svelte';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import { catalogCrumb } from '$lib/layouts/crumbs';
  import ErrorState from '$lib/ui/ErrorState.svelte';
  import LoadingIndicator from '$lib/ui/LoadingIndicator.svelte';
  import { recommendReleases } from '$lib/domain/releaseRecommendations';
  import { coverFailure } from '$lib/ui/coverFallback';
  import { fetchReleases, resolveReleaseBySlug, type Release } from '$lib/utils/catalogoStore';

  export let data;

  let lanzamiento: Release | null = null;
  let cargando = true;
  let mensajeError = '';
  // Si se llegó desde el catálogo, la miga vuelve a esa misma búsqueda.
  let catalogSearch = '';
  let requestedSlug = '';
  let requestVersion = 0;
  let catalogo: Release[] = [];
  // Fondo de la página: la portada desenfocada bajo el velo del modal (U9).
  let fondoFallido = '';
  $: recommendations = lanzamiento ? recommendReleases(lanzamiento, catalogo) : [];

  onMount(() => {
    try {
      const from = new URL(document.referrer);
      if (from.origin === window.location.origin && from.pathname === '/') catalogSearch = from.search;
    } catch {
      // Sin referrer o inválido: la miga lleva al catálogo completo.
    }
  });

  async function cargarLanzamiento(slug: string) {
    requestedSlug = slug;
    const version = ++requestVersion;
    cargando = true;
    mensajeError = '';
    lanzamiento = null;
    try {
      const [resolution, releases] = await Promise.all([resolveReleaseBySlug(slug), fetchReleases()]);
      if (version !== requestVersion) return;
      lanzamiento = resolution.status === 'resolved' ? resolution.release : null;
      catalogo = releases;
      if (!lanzamiento) mensajeError = 'No encontramos este lanzamiento en el catálogo.';
    } catch (error) {
      if (version !== requestVersion) return;
      console.error('No fue posible resolver el lanzamiento:', error);
      mensajeError = 'No fue posible cargar este lanzamiento. Intenta de nuevo.';
    } finally {
      if (version === requestVersion) cargando = false;
    }
  }

  $: if (browser && data?.slug && data.slug !== requestedSlug) void cargarLanzamiento(data.slug);
</script>

<svelte:head>
  <title>{lanzamiento ? `${lanzamiento.title} — Biblioteca Discótica` : 'Lanzamiento — Biblioteca Discótica'}</title>
</svelte:head>

{#if cargando}
  <div class="cargando">
    <LoadingIndicator label="Cargando lanzamiento" />
  </div>
{:else if lanzamiento}
  <div class="ficha-pagina">
    {#if lanzamiento.coverUrl && fondoFallido !== lanzamiento.coverUrl}
      <img
        class="ficha-pagina__fondo"
        src={lanzamiento.coverUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        use:coverFailure={() => (fondoFallido = lanzamiento?.coverUrl ?? '')}
      />
    {/if}
    <PageLayout breadcrumbs={[catalogCrumb(catalogSearch), { label: lanzamiento.title }]}>
      <LanzamientoVista {lanzamiento} {recommendations} />
    </PageLayout>
  </div>
{:else}
  <PageLayout container="narrow">
    <ErrorState heading="h1" message="No pudimos abrir este lanzamiento" detail={mensajeError} actionLabel="Volver al catálogo" actionHref="/" />
  </PageLayout>
{/if}

<style>
  /* El mismo tratamiento que el fondo del modal: lo de detrás desenfocado y
     oscurecido por --overlay-backdrop. Aquí lo de detrás es la portada. Sin
     portada queda el fondo del sitio bajo el velo. */
  .ficha-pagina {
    position: relative;
    isolation: isolate;
    /* clip, no hidden: hidden la volvería contenedor de scroll y la barra
       sticky de la ficha dejaría de seguir al viewport. */
    overflow: clip;
  }

  .ficha-pagina::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: var(--overlay-backdrop);
  }

  .ficha-pagina__fondo {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(var(--cover-ambient-blur)) saturate(var(--cover-ambient-saturate));
    transform: scale(1.15);
    pointer-events: none;
    user-select: none;
  }

  .cargando {
    display: grid;
    place-items: center;
    min-height: 60vh;
  }
</style>
