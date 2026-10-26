<script lang="ts">
  import CatalogEntityPage from '$lib/components/CatalogEntityPage.svelte';

  export let data;
</script>

<CatalogEntityPage
  kind="Sello"
  name={data?.nombreSello ?? ''}
  releases={data?.lanzamientos ?? []}
  emptyMessage="Este sello aún no tiene lanzamientos en Discótica."
/>
