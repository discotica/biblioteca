<script>
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import ConsentimientoAnalitica from '$lib/components/ConsentimientoAnalitica.svelte';
  import { initAnalytics, trackPageView } from '$lib/analytics';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import '$lib/styles/styles.css';
  import { WELCOME_SESSION_CONTEXT, readInitialWelcomePath } from '$lib/ui/welcomeSession';
  export let data;

  // E20 owns only this tab-session route marker. It is created once in the
  // root layout so a later in-app navigation to / can never look like a cold
  // direct visit.
  const initialPath = typeof window === 'undefined' ? '' : readInitialWelcomePath(window.location.pathname);
  setContext(WELCOME_SESSION_CONTEXT, { initialPath });

  // GA4 solo con consentimiento (analytics.ts). afterNavigate también corre en
  // la carga inicial; trackPageView ignora los cambios que solo tocan la query.
  onMount(initAnalytics);
  afterNavigate(trackPageView);
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<Header />

<main>
  <slot />
</main>

<!-- El Estudio (U15) es una herramienta de trabajo: sin el pie del sitio. -->
{#if !$page.url.pathname.startsWith('/estudio')}<Footer />{/if}

<ConsentimientoAnalitica />

<style>
  main {
    min-height: calc(100vh - 160px); /* ajusta si tu header/footer cambian de tamaño */
    padding-bottom: var(--spacing-lg);
  }
</style>
