<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { studioSectionHref } from '$lib/domain/studio';
  import { LoadingIndicator } from '$lib/ui';

  // /estudio abre la primera sección que ve el rol: Catálogo para admin y
  // Propuestas para colaborador. El layout ya resolvió sesión y rol.
  const studio = getStudioContext();

  $effect(() => {
    const first = studio.sections[0];
    if (first) void goto(studioSectionHref(first) + page.url.search + page.url.hash, { replaceState: true });
  });
</script>

<svelte:head><title>Estudio — Discótica</title></svelte:head>

<LoadingIndicator label="Abriendo el Estudio" />
