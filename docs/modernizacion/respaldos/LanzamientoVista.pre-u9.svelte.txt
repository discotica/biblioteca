<script lang="ts">
  import ReleaseDetail from './ReleaseDetail.svelte';
  import ReleaseRecommendations from './ReleaseRecommendations.svelte';
  import type { Release } from '$lib/domain/releases';
  import type { ReleaseRecommendation } from '$lib/domain/releaseRecommendations';

  /**
   * Alias de compatibilidad para consumidores previos a E16. Toda la ficha
   * editorial vive en ReleaseDetail; este archivo no conserva markup propio.
   */
  export let lanzamiento: Release;
  export let recommendations: ReleaseRecommendation[] = [];
</script>

<ReleaseDetail release={lanzamiento} mode="page">
  <svelte:fragment slot="recommendations">
    <ReleaseRecommendations {recommendations} mode="page" />
  </svelte:fragment>
</ReleaseDetail>
