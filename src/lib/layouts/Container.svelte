<script module lang="ts">
  /** narrow 736 · regular 960 · wide 1200 · full (todo el viewport). Incluyen el margen lateral. */
  export type ContainerSize = 'narrow' | 'regular' | 'wide' | 'full';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    size?: ContainerSize;
    /** Elemento que se renderiza (div por defecto). */
    as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'nav';
    class?: string;
    children?: Snippet;
    [attribute: string]: unknown;
  };

  let { size = 'wide', as = 'div', class: className = '', children, ...rest }: Props = $props();
</script>

<!-- Las clases viven en styles.css para que un componente que no puede envolver
     (p. ej. una sección sticky) declare el mismo ancho con class="l-container l-container--wide". -->
<svelte:element this={as} class="l-container l-container--{size} {className}" {...rest}>
  {@render children?.()}
</svelte:element>
