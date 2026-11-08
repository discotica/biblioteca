<script lang="ts">
  import { tick } from 'svelte';
  import { describeContributionError } from '$lib/domain/contributionContract';
  import { Button, Dialog, Menu, SplitButton, Textarea } from '$lib/ui';
  import {
    CONTRIBUTION_STATUS_LABELS,
    acceptContribution,
    prepareContributionForAdmin,
    reviewContribution,
    type Contribution
  } from '$lib/stores/contributionsStore';
  import type { ProposalOutcome } from './ProposalEditor.svelte';

  // Decisiones sobre una propuesta (U23), las mismas en el resumen de la bandeja y en el editor:
  // - admin: Devolver ▾ (Pedir cambios…, Rechazar…) y Aceptar y publicar │▾ (Aceptar como borrador);
  // - colaborador: Marcar lista para admin, con la nota interna opcional en su diálogo.
  // Pedir cambios y Rechazar piden la nota en un diálogo pequeño y no envían sin ella (la misma regla
  // que impone review_contribution). Los RPC y sus parámetros son los de U19; el editor guarda antes
  // con `before` y el resumen no tiene nada que guardar.

  type Props = {
    contribution: Contribution;
    role: 'admin' | 'colaborador';
    /** Título para los avisos («Pulso: aceptada y publicada.»). */
    title: string;
    /** Guarda lo pendiente antes de decidir (el editor). Devuelve false si no se pudo. */
    before?: () => Promise<boolean>;
    /** Lo que falta para publicar según el formulario; sin él, decide el servidor. */
    publishMissing?: string[];
    /** Lo que falta para aceptar según el formulario. */
    acceptMissing?: string[];
    /** Datos del diálogo de publicar. */
    facts: { artists: string; label: string; date: string };
    /** Ocupado fuera de aquí (guardando en el editor): deshabilita las decisiones. */
    disabled?: boolean;
    onbusy?: (busy: boolean) => void;
    onerror: (text: string, cause?: any) => void;
    ondone: (outcome: ProposalOutcome) => void;
  };

  let { contribution, role, title, before, publishMissing = [], acceptMissing = [], facts, disabled = false, onbusy, onerror, ondone }: Props = $props();

  type Kind = 'changes_requested' | 'rejected' | 'publish' | 'draft' | 'prepare';
  type Busy = Kind | '';

  let busy = $state<Busy>('');
  let open = $state(false);
  let kind = $state<Kind>('publish');
  let note = $state('');
  let noteError = $state('');
  let dialogError = $state('');
  let noteEl = $state<HTMLTextAreaElement>();

  const locked = $derived(disabled || !!busy);
  const dialogTitle = $derived(
    kind === 'changes_requested' ? 'Pedir cambios' : kind === 'rejected' ? 'Rechazar' : kind === 'prepare' ? 'Marcar lista para admin' : kind === 'draft' ? 'Aceptar como borrador' : 'Aceptar y publicar'
  );

  function setBusy(next: Busy) {
    busy = next;
    onbusy?.(!!next);
  }

  function ask(next: Kind) {
    if (locked) return;
    if (next === 'publish' || next === 'draft') {
      if (acceptMissing.length) return onerror(`Completa antes de aceptar: ${acceptMissing.join(', ')}.`);
      if (next === 'publish' && publishMissing.length) return onerror(`Completa antes de publicar: ${publishMissing.join(', ')}.`);
    }
    kind = next;
    note = '';
    noteError = '';
    dialogError = '';
    open = true;
  }

  function errorText(cause: any, fallback: string) {
    if (cause?.code === '23514') return 'Para publicar faltan datos: portada HTTPS, enlace principal, fecha, tipo, sello, artista, género y país.';
    return describeContributionError(cause)?.message ?? (cause?.message || fallback);
  }

  async function accept(publish: boolean) {
    if (busy) return;
    setBusy(publish ? 'publish' : 'draft');
    try {
      if (before && !(await before())) return void (open = false);
      const created = await acceptContribution(contribution.id, { publish, expectedUpdatedAt: contribution.updated_at, note: note.trim() || undefined });
      open = false;
      ondone({
        contribution: null,
        flash: publish ? `${title}: aceptada y publicada.` : `${title}: aceptada como borrador del catálogo.`,
        releaseId: created.release_id
      });
    } catch (cause: any) {
      open = false;
      onerror(errorText(cause, 'No se pudo aceptar la propuesta.'), cause);
    } finally {
      setBusy('');
    }
  }

  async function giveBack(action: 'changes_requested' | 'rejected') {
    if (!note.trim()) {
      noteError = action === 'rejected' ? 'Escribe una nota antes de rechazar.' : 'Escribe una nota para pedir cambios.';
      await tick();
      noteEl?.focus();
      return;
    }
    setBusy(action);
    dialogError = '';
    try {
      const updated = await reviewContribution(contribution.id, action, note.trim());
      open = false;
      ondone({ contribution: updated, flash: `${title}: ${CONTRIBUTION_STATUS_LABELS[updated.status]}.`, releaseId: null });
    } catch (cause: any) {
      dialogError = errorText(cause, 'No se pudo registrar la decisión.');
    } finally {
      setBusy('');
    }
  }

  async function prepare() {
    setBusy('prepare');
    dialogError = '';
    try {
      if (before && !(await before())) return void (open = false);
      // Ya guardada: se marca lista sin payload, así la nota interna no va al historial del autor.
      const updated = await prepareContributionForAdmin(contribution.id, {}, note.trim());
      open = false;
      ondone({ contribution: updated, flash: `${title} quedó lista para administración.`, releaseId: null });
    } catch (cause: any) {
      open = false;
      onerror(errorText(cause, 'No se pudo marcar la propuesta como lista.'), cause);
    } finally {
      setBusy('');
    }
  }

  function confirm() {
    if (kind === 'publish' || kind === 'draft') void accept(kind === 'publish');
    else if (kind === 'prepare') void prepare();
    else void giveBack(kind);
  }
</script>

{#if role === 'admin'}
  <Menu
    buttonLabel="Devolver"
    label="Devolver"
    variant="secondary"
    align="end"
    disabled={locked}
    items={[
      { label: 'Pedir cambios…', onselect: () => ask('changes_requested') },
      { label: 'Rechazar…', tone: 'danger', onselect: () => ask('rejected') }
    ]}
  />
  <SplitButton
    label="Aceptar y publicar"
    menuLabel="Más formas de aceptar"
    disabled={locked}
    items={[{ label: 'Aceptar como borrador…', onselect: () => ask('draft') }]}
    onclick={() => ask('publish')}
  />
{:else}
  <Button disabled={locked} loading={busy === 'prepare'} onclick={() => ask('prepare')}>Marcar lista para admin</Button>
{/if}

<Dialog bind:open title={dialogTitle} size="sm" dismissible={!busy} initialFocus="[data-dialog-focus]">
  {#if kind === 'publish' || kind === 'draft'}
    <p class="decisions__text"><strong>{title}</strong> {kind === 'publish' ? 'se crea en el catálogo y queda visible.' : 'se crea en el catálogo como borrador, sin publicar.'}</p>
    <dl class="decisions__facts">
      <dt>Artistas</dt><dd>{facts.artists || '—'}</dd>
      <dt>Sello</dt><dd>{facts.label || '—'}</dd>
      <dt>Fecha</dt><dd>{facts.date || 'Sin fecha'}</dd>
    </dl>
    <Textarea class="decisions__note" label="Nota para quien propone" optional rows={2} bind:value={note} />
  {:else if kind === 'prepare'}
    <Textarea label="Nota interna para admin" optional rows={3} bind:value={note} data-dialog-focus />
  {:else}
    <Textarea
      label={kind === 'rejected' ? 'Por qué se rechaza' : 'Qué tiene que cambiar'}
      hint="Le llega a quien la propuso."
      required
      rows={3}
      bind:value={note}
      bind:element={noteEl}
      error={noteError}
      oninput={() => (noteError = '')}
      data-dialog-focus
    />
  {/if}
  {#if dialogError}<p class="decisions__error" role="alert">{dialogError}</p>{/if}
  {#snippet footer()}
    <Button variant="secondary" disabled={!!busy} onclick={() => (open = false)}>Cancelar</Button>
    {#if kind === 'publish'}
      <Button loading={busy === 'publish'} onclick={confirm} data-dialog-focus>Confirmar y publicar</Button>
    {:else if kind === 'draft'}
      <Button loading={busy === 'draft'} onclick={confirm} data-dialog-focus>Aceptar como borrador</Button>
    {:else if kind === 'prepare'}
      <Button loading={busy === 'prepare'} onclick={confirm}>Marcar lista</Button>
    {:else}
      <Button variant={kind === 'rejected' ? 'destructive' : 'primary'} loading={busy === kind} onclick={confirm}>
        {kind === 'rejected' ? 'Rechazar' : 'Pedir cambios'}
      </Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .decisions__text { margin: 0 0 var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .decisions__facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
  }
  .decisions__facts dt { color: var(--color-texto-tenue); }
  .decisions__facts dd { margin: 0; color: var(--color-texto); }
  .decisions__error { margin: var(--space-3) 0 0; color: var(--color-danger-texto); font-size: var(--text-sm); }
</style>
