<script lang="ts">
  import { coverFailure } from './coverFallback';

  type Props = {
    src?: string | null;
    /** Texto alternativo. Vacío si un texto cercano ya nombra el lanzamiento. */
    alt: string;
    /**
     * Fondo ambiental: la misma portada desenfocada detrás del contenido del
     * anfitrión (tarjeta, ficha). Ocupa el ancestro posicionado más cercano, que
     * debe tener `position: relative`, `isolation: isolate` y `overflow: hidden`.
     */
    ambient?: boolean;
    loading?: 'lazy' | 'eager';
    fetchpriority?: 'high' | 'low' | 'auto';
    sizes?: string;
    srcset?: string;
    /** Radio de la portada. */
    radius?: 'none' | 'sm' | 'base';
    class?: string;
  };

  let {
    src,
    alt,
    ambient = false,
    loading = 'lazy',
    fetchpriority,
    sizes,
    srcset,
    radius = 'none',
    class: className = ''
  }: Props = $props();

  // Se recuerda qué URL falló: si cambia la portada, se vuelve a intentar.
  let failedSrc = $state<string | null>(null);
  const showImage = $derived(Boolean(src) && failedSrc !== src);
</script>

{#if ambient && showImage}
  <img class="ui-cover__ambient" src={src} alt="" aria-hidden="true" {loading} decoding="async" draggable="false" />
{/if}
<div class="ui-cover ui-cover--radius-{radius} {className}">
  {#if showImage}
    {#key src}
      <img
        class="ui-cover__image"
        src={src}
        {alt}
        {srcset}
        {sizes}
        {loading}
        {fetchpriority}
        decoding="async"
        draggable="false"
        use:coverFailure={() => (failedSrc = src ?? null)}
      />
    {/key}
  {:else}
    <!-- Sin portada o rota: logo de Discótica atenuado. El nombre lo da `alt`. -->
    <span class="ui-cover__fallback" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}>
      <img src="/img/logo.svg" alt="" draggable="false" />
    </span>
  {/if}
</div>

<style>
  /* Siempre cuadrada: la imagen recorta (object-fit: cover) en lugar de dejar barras. */
  .ui-cover {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: var(--color-panel);
  }
  .ui-cover--radius-sm { border-radius: var(--radius-sm); }
  .ui-cover--radius-base { border-radius: var(--radius-base); }

  .ui-cover__image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .ui-cover__fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  .ui-cover__fallback img {
    display: block;
    width: 46%;
    height: auto;
    opacity: var(--cover-fallback-opacity);
    pointer-events: none;
    user-select: none;
  }

  /* Detrás de todo el contenido del anfitrión (z-index -1 dentro de su contexto). */
  .ui-cover__ambient {
    position: absolute;
    inset: 0;
    z-index: -1;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: var(--cover-ambient-opacity);
    filter: blur(var(--cover-ambient-blur)) saturate(var(--cover-ambient-saturate));
    pointer-events: none;
    user-select: none;
  }
</style>
