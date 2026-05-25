<script>
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  export let data;
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<Header />

<main>
  <slot />
</main>

<Footer />

<style>
  main {
    min-height: calc(100vh - 160px); /* ajusta si tu header/footer cambian de tamaño */
    padding-bottom: var(--spacing-lg);
  }
</style>