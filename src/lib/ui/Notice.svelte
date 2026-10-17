<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  type Props = {
    /** error (rol alert) · success e info (rol status). */
    tone?: 'error' | 'success' | 'info';
    /** Línea en negrita antes del texto. */
    title?: string;
    children?: Snippet;
    /** Acciones al pie (enlaces o botones). */
    actions?: Snippet;
    class?: string;
    [attribute: string]: unknown;
  };

  let { tone = 'info', title, children, actions, class: className = '', ...rest }: Props = $props();
</script>

<!--
  Aviso en línea de formularios y pantallas de cuenta (U12). No es un toast:
  ocupa su sitio en el flujo y se lee con el resto del contenido.
-->
<div class="ui-notice ui-notice--{tone} {className}" role={tone === 'error' ? 'alert' : 'status'} {...rest}>
  {#if tone === 'success'}<span class="ui-notice__icon"><Icon name="check" size="sm" /></span>{/if}
  <div class="ui-notice__body">
    {#if title}<p class="ui-notice__title">{title}</p>{/if}
    {#if children}<div class="ui-notice__text">{@render children()}</div>{/if}
    {#if actions}<div class="ui-notice__actions">{@render actions()}</div>{/if}
  </div>
</div>

<style>
  .ui-notice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    background: var(--color-superficie-1);
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .ui-notice--error {
    border-color: var(--color-danger-borde);
    background: var(--color-danger-dim);
    color: var(--color-danger-texto);
  }
  .ui-notice--success {
    border-color: var(--color-acento-border);
    background: var(--color-acento-tinte);
  }

  .ui-notice__icon {
    display: inline-flex;
    margin-top: var(--space-1);
    color: var(--color-acento);
  }
  .ui-notice__body { min-width: 0; }
  .ui-notice__title {
    margin: 0;
    color: var(--color-texto);
    font-weight: 700;
  }
  .ui-notice--error .ui-notice__title { color: inherit; }
  .ui-notice__text :global(p) { margin: 0; }
  .ui-notice__title + .ui-notice__text { margin-top: var(--space-1); }
  .ui-notice__text :global(a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: .2em;
  }
  .ui-notice__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
</style>
