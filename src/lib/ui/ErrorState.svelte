<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  type Props = {
    /** Mensaje corto en lenguaje de la persona, nunca un código interno. */
    message: string;
    detail?: string;
    /** Por defecto "Reintentar" si hay onaction o actionHref. */
    actionLabel?: string;
    actionHref?: string;
    onaction?: (event: MouseEvent) => void;
    /** El reintento está en curso. */
    retrying?: boolean;
    size?: 'page' | 'inline';
    /** Renderiza el mensaje como encabezado (h1 en +error.svelte). Por defecto, párrafo. */
    heading?: 'h1' | 'h2' | 'h3';
    action?: Snippet;
    class?: string;
  };

  let {
    message,
    detail,
    actionLabel = 'Reintentar',
    actionHref,
    onaction,
    retrying = false,
    size = 'page',
    heading,
    action,
    class: className = ''
  }: Props = $props();
</script>

<div class="ui-error ui-error--{size} {className}" role="alert">
  <svelte:element this={heading ?? 'p'} class="ui-error__message">{message}</svelte:element>
  {#if detail}<p class="ui-error__detail">{detail}</p>{/if}
  {#if action}
    <div class="ui-error__action">{@render action()}</div>
  {:else if onaction || actionHref}
    <div class="ui-error__action">
      <Button variant="secondary" size={size === 'inline' ? 'sm' : 'md'} href={actionHref} loading={retrying} onclick={onaction}>{actionLabel}</Button>
    </div>
  {/if}
</div>

<style>
  .ui-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
  }
  .ui-error--page { padding: var(--space-7) var(--space-4); }
  .ui-error--inline {
    align-items: flex-start;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-danger-borde);
    border-radius: var(--radius-sm);
    background: var(--color-danger-dim);
    text-align: left;
  }

  .ui-error__message {
    margin: 0;
    color: var(--color-danger-texto);
    font-size: var(--text-lg);
    font-weight: 650;
    line-height: 1.3;
  }
  .ui-error--inline .ui-error__message { font-size: var(--text-md); }

  .ui-error__detail {
    max-width: 32rem;
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .ui-error__action { margin-top: var(--space-3); }
</style>
