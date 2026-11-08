<script lang="ts">
  import type { Snippet } from 'svelte';
  import { IconButton } from '$lib/ui';

  type Props = {
    /** Elementos seleccionados. */
    count: number;
    /** Una línea de contexto tras el conteo (por ejemplo, el límite de un lote). */
    note?: string;
    /** Acciones del lote, antes del ✕. */
    children: Snippet;
    /** ✕: suelta la selección. */
    onclear: () => void;
    class?: string;
  };

  let { count, note, children, onclear, class: className = '' }: Props = $props();
</script>

<!-- Barra de selección del Estudio (U21): ocupa la fila de búsqueda y filtros
     mientras hay algo seleccionado. Conteo, acciones y ✕. -->
<div class="selection-bar {className}" role="region" aria-label="Selección">
  <p class="selection-bar__count" role="status">
    <strong>{count}</strong> {count === 1 ? 'seleccionado' : 'seleccionados'}{#if note}<span class="selection-bar__note"> · {note}</span>{/if}
  </p>
  <div class="selection-bar__actions">
    {@render children()}
    <IconButton icon="cerrar" label="Quitar selección" size="sm" onclick={onclear} tooltipAlign="end" />
  </div>
</div>

<style>
  .selection-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--tool-gap-col);
    min-height: var(--density-control-h);
    padding: 0 var(--space-2) 0 var(--tool-pad-control);
    border: 1px solid var(--color-acento-border);
    border-radius: var(--radius-sm);
    background: var(--color-acento-tinte);
  }
  .selection-bar__count { margin: 0; color: var(--color-texto-medio); font-size: var(--density-text); }
  .selection-bar__count strong { color: var(--color-acento); }
  .selection-bar__note { color: var(--color-aviso); }
  .selection-bar__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
</style>
