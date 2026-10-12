<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  type Props = {
    /** Mensaje corto: qué pasa. */
    message: string;
    /** Una línea opcional: por qué o qué probar. */
    detail?: string;
    /** Una sola acción clara. */
    actionLabel?: string;
    actionHref?: string;
    onaction?: (event: MouseEvent) => void;
    /** page: centrado en el área de resultados · inline: dentro de un bloque. */
    size?: 'page' | 'inline';
    /** Sustituye la acción por contenido propio. */
    action?: Snippet;
    class?: string;
  };

  let { message, detail, actionLabel, actionHref, onaction, size = 'page', action, class: className = '' }: Props = $props();
</script>

<div class="ui-state ui-state--{size} {className}" role="status">
  <p class="ui-state__message">{message}</p>
  {#if detail}<p class="ui-state__detail">{detail}</p>{/if}
  {#if action}
    <div class="ui-state__action">{@render action()}</div>
  {:else if actionLabel}
    <div class="ui-state__action">
      <Button variant="secondary" size={size === 'inline' ? 'sm' : 'md'} href={actionHref} onclick={onaction}>{actionLabel}</Button>
    </div>
  {/if}
</div>

<style>
  .ui-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
  }
  .ui-state--page { padding: var(--space-7) var(--space-4); }
  .ui-state--inline { align-items: flex-start; padding: var(--space-4) 0; text-align: left; }

  .ui-state__message {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 650;
    line-height: 1.3;
  }
  .ui-state--inline .ui-state__message { font-size: var(--text-md); }

  .ui-state__detail {
    max-width: 32rem;
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .ui-state__action { margin-top: var(--space-3); }
</style>
