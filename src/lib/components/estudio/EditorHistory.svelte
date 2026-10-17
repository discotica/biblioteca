<script lang="ts">
  import { Button, Chip } from '$lib/ui';
  import { changedFields, operationLabel } from '$lib/domain/releaseEditor';
  import type { CatalogHistory } from '$lib/services/adminCatalog';

  type Props = {
    history: CatalogHistory[];
    /** El lanzamiento aún no existe (alta nueva). */
    unsaved?: boolean;
    disabled?: boolean;
    onrevert: (entry: CatalogHistory, trigger: HTMLElement) => void;
  };

  let { history, unsaved = false, disabled = false, onrevert }: Props = $props();

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
</script>

{#if unsaved}
  <p class="history__empty">El historial aparecerá después de crear el borrador.</p>
{:else if !history.length}
  <p class="history__empty">Todavía no hay cambios auditados.</p>
{:else}
  <ol class="history">
    {#each history as entry (entry.change_set_id)}
      {@const fields = changedFields(entry)}
      <li class="history__entry" class:history__entry--reverted={entry.status === 'reverted'}>
        <div class="history__main">
          <p class="history__line">
            <span class="history__operation">{operationLabel(entry.operation)}</span>
            <strong class="history__reason">{entry.reason}</strong>
          </p>
          <p class="history__meta">
            {entry.actor.display_name || entry.actor.username} · versión {entry.base_version ?? '—'} → {entry.result_version} · <time datetime={entry.created_at}>{formatDate(entry.created_at)}</time>
          </p>
          {#if fields.length}<p class="history__fields">{fields.join(' · ')}</p>{/if}
          <details class="history__compare">
            <summary>Ver comparación técnica</summary>
            <div class="history__states">
              <section><span>Antes</span><pre>{JSON.stringify(entry.before_state, null, 2)}</pre></section>
              <section><span>Después</span><pre>{JSON.stringify(entry.after_state, null, 2)}</pre></section>
            </div>
          </details>
        </div>
        <div class="history__action">
          {#if entry.status === 'applied'}
            <Button size="sm" variant="secondary" {disabled} onclick={(event: MouseEvent) => onrevert(entry, event.currentTarget as HTMLElement)}>Revertir este cambio</Button>
          {:else}
            <Chip kind="status" tone="neutral" label="Revertido" />
          {/if}
        </div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .history { margin: 0; padding: 0; list-style: none; }

  .history__entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-borde);
  }
  .history__entry:first-child { padding-top: 0; border-top: 0; }
  .history__entry--reverted .history__reason { color: var(--color-texto-medio); }

  .history__main { min-width: 0; }
  .history__line { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-2); margin: 0; }
  .history__operation {
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }
  .history__reason { color: var(--color-texto); font-size: var(--text-sm); font-weight: 600; }
  .history__meta,
  .history__fields { margin: var(--space-1) 0 0; color: var(--color-texto-tenue); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; }
  .history__fields { color: var(--color-texto-medio); }

  .history__compare { margin-top: var(--space-1); }
  .history__compare summary {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    margin-block: calc((var(--text-2xs) * 1.5 - var(--target-touch)) / 2);
    color: var(--color-texto-medio);
    font-size: var(--text-2xs);
    cursor: pointer;
  }
  .history__states { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); margin-top: var(--space-2); }
  .history__states section { min-width: 0; }
  .history__states span { color: var(--color-texto-tenue); font-size: var(--text-2xs); }
  .history__states pre {
    max-height: var(--tool-dialog-list-max-h);
    margin: var(--space-1) 0 0;
    padding: var(--space-2);
    overflow: auto;
    border-radius: var(--radius-xs);
    background: var(--color-fondo);
    color: var(--color-texto-alto);
    font-size: var(--text-2xs);
    white-space: pre-wrap;
  }

  .history__action { align-self: start; }

  .history__empty { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-sm); }

  @media (max-width: 767px) {
    .history__entry { grid-template-columns: minmax(0, 1fr); }
    .history__states { grid-template-columns: minmax(0, 1fr); }
  }
</style>
