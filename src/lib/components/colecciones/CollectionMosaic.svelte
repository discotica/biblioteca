<script lang="ts">
  // Mosaico de una colección (U14): sus 4 primeras portadas en 2 × 2, en el
  // orden de la colección. Las casillas sin portada quedan vacías; una colección
  // vacía muestra el logo atenuado, como un lanzamiento sin portada.
  import { Cover } from '$lib/ui';
  import { PORTADAS_MOSAICO } from '$lib/stores/cratesStore';

  type Props = {
    /** Hasta 4 URLs; null deja la casilla con el logo. */
    covers: (string | null)[];
    class?: string;
  };

  let { covers, class: className = '' }: Props = $props();

  const slots = $derived(Array.from({ length: PORTADAS_MOSAICO }, (_, index) => index));
</script>

<!-- Decorativo: el nombre de la colección va junto al mosaico. -->
<div class="mosaic {className}" aria-hidden="true">
  {#if covers.length === 0}
    <Cover src={null} alt="" />
  {:else}
    <div class="mosaic__grid">
      {#each slots as index (index)}
        {#if index < covers.length}
          <Cover src={covers[index]} alt="" sizes="(min-width: 680px) 10rem, 25vw" />
        {:else}
          <span class="mosaic__empty"></span>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .mosaic {
    position: relative;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    border-radius: var(--radius-sm);
    background: var(--color-panel);
  }
  .mosaic__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--mosaic-gap);
    height: 100%;
  }
  .mosaic__empty { background: var(--color-superficie-1); }
</style>
