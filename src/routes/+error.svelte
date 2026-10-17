<script lang="ts">
  import { page } from '$app/stores';
  import ErrorState from '$lib/ui/ErrorState.svelte';
  import Container from '$lib/layouts/Container.svelte';

  $: notFound = $page.status === 404;
  $: message = notFound ? 'No encontramos esta página' : 'Algo salió mal';
  $: detail = notFound
    ? 'El enlace puede estar mal escrito o la página ya no existe.'
    : 'No pudimos mostrar esta página. Inténtalo de nuevo en un momento.';
</script>

<svelte:head>
  <title>{notFound ? 'Página no encontrada' : 'Error'} — Biblioteca Discótica</title>
</svelte:head>

<Container size="narrow" class="error-page">
  <ErrorState heading="h1" {message} {detail} actionLabel="Volver al catálogo" actionHref="/" />
</Container>

<style>
  :global(.error-page) {
    display: grid;
    min-height: 50vh;
    align-content: center;
  }
</style>
