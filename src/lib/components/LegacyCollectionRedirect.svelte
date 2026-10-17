<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { legacyCollectionHref } from '$lib/domain/collectionRoutes';

  // Enlace con una ruta anterior a "colecciones": se reemplaza en el historial
  // por la ruta nueva. El hash solo se puede leer en el cliente, ya montado.
  onMount(() => {
    const { pathname, search, hash } = window.location;
    goto(legacyCollectionHref(pathname, search, hash) ?? '/', { replaceState: true });
  });
</script>
