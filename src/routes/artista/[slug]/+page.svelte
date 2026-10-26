<script lang="ts">
  import CatalogEntityPage from '$lib/components/CatalogEntityPage.svelte';

  export let data;
</script>

<CatalogEntityPage
  kind="Artista"
  name={data?.nombreArtista ?? ''}
  releases={data?.lanzamientos ?? []}
  emptyMessage="Este artista aún no tiene lanzamientos en Discótica."
/>
