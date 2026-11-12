<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** h1 del panel: 28/34, peso 700. */
    titulo: string;
    /** Línea de apoyo, 16/24. Texto o un fragmento con el dato resaltado. */
    children?: Snippet;
  };

  let { titulo, children }: Props = $props();
</script>

<header class="acceso-titulo">
  <h1 class="acceso-titulo__h1">{titulo}</h1>
  {#if children}<p class="acceso-titulo__linea">{@render children()}</p>{/if}
</header>

<style>
  .acceso-titulo__h1 {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-titulo-panel);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: var(--text-titulo-panel-lh);
  }
  .acceso-titulo__linea {
    margin: var(--space-3) 0 0;
    color: var(--color-texto-alto);
    font-size: var(--text-md);
    line-height: 1.5;
  }
  .acceso-titulo__linea :global(strong) {
    color: var(--color-texto);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
</style>
