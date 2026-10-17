<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** Título visible (h1). */
    title: string;
    /** Ayuda corta bajo el título. */
    help?: string;
    /**
     * single: una columna centrada. split: dos columnas desde 769 px, con `aside`
     * a la izquierda y el formulario a la derecha; en móvil, primero el formulario.
     */
    variant?: 'single' | 'split';
    /** Columna lateral de la variante split (beneficios de Entrar). */
    aside?: Snippet;
    /** El formulario o el estado (enviado, error). */
    children?: Snippet;
    /** Enlaces secundarios bajo el formulario. */
    footer?: Snippet;
    class?: string;
  };

  let { title, help, variant = 'single', aside, children, footer, class: className = '' }: Props = $props();

  const split = $derived(variant === 'split' && Boolean(aside));
</script>

<div class="l-container l-container--{split ? 'regular' : 'narrow'} l-account {className}" class:l-account--split={split}>
  <div class="l-account__main">
    <header class="l-account__header">
      <h1 class="l-account__title">{title}</h1>
      {#if help}<p class="l-account__help">{help}</p>{/if}
    </header>
    {@render children?.()}
    {#if footer}<div class="l-account__footer">{@render footer()}</div>{/if}
  </div>
  {#if split && aside}
    <aside class="l-account__aside">{@render aside()}</aside>
  {/if}
</div>

<style>
  .l-account {
    padding-top: var(--page-pad-top);
    padding-bottom: var(--page-pad-bottom);
  }

  .l-account__main {
    width: 100%;
    max-width: var(--account-form-w);
    margin-inline: auto;
  }

  .l-account__header { margin-bottom: var(--space-6); }

  .l-account__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: var(--leading-heading);
  }

  .l-account__help {
    margin: var(--space-2) 0 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .l-account__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-1) var(--space-3);
    margin-top: var(--space-5);
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
  }
  .l-account__footer :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    text-decoration: none;
    transition: color var(--motion-fast) ease;
  }
  .l-account__footer :global(a:hover) { color: var(--color-acento); }

  /* Dos columnas: beneficios a la izquierda, formulario a la derecha. */
  .l-account--split {
    display: grid;
    grid-template-columns: minmax(0, var(--account-aside-w)) minmax(0, var(--account-form-w));
    justify-content: space-between;
    align-items: start;
    gap: var(--space-7);
  }
  .l-account--split .l-account__main { order: 2; margin-inline: 0; }
  .l-account__aside { order: 1; min-width: 0; }

  @media (max-width: 768px) {
    .l-account { padding-top: var(--page-pad-top-mobile); }
    .l-account--split {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
    }
    .l-account--split .l-account__main { order: 0; margin-inline: auto; }
    .l-account__aside {
      order: 1;
      width: 100%;
      max-width: var(--account-form-w);
      margin-inline: auto;
    }
  }
</style>
