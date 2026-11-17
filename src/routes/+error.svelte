<script lang="ts">
  import { page } from '$app/stores';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import AccesoTitulo from '$lib/components/account/AccesoTitulo.svelte';
  import { Button, FormPanel } from '$lib/ui';

  $: notFound = $page.status === 404;
  $: message = notFound ? 'No encontramos esta página' : 'Algo salió mal';
  $: detail = notFound
    ? 'El enlace puede estar mal escrito o la página ya no existe.'
    : 'No pudimos mostrar esta página. Inténtalo de nuevo en un momento.';
</script>

<svelte:head>
  <title>{notFound ? 'Página no encontrada' : 'Error'} — Biblioteca Discótica</title>
</svelte:head>

<!-- Tablero M (U33): 404 y error comparten pantalla, en el panel de 480 sobre el campo de puntos. -->
<AccesoPagina contenedor="narrow" alinea="centro">
  <FormPanel size="narrow" role="alert">
    <AccesoTitulo titulo={message}>{detail}</AccesoTitulo>

    {#snippet actions()}
      <Button href="/" size="form" block>Volver al catálogo</Button>
    {/snippet}
  </FormPanel>
</AccesoPagina>
