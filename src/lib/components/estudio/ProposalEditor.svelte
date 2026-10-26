<script lang="ts" module>
  import type { Contribution } from '$lib/stores/contributionsStore';

  /** Lo que la bandeja necesita saber cuando se decide una propuesta en el editor. */
  export type ProposalOutcome = { contribution: Contribution | null; flash: string; releaseId: string | null };
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import ReleaseForm from './ReleaseForm.svelte';
  import { describeContributionError } from '$lib/domain/contributionContract';
  import { CONTRIBUTION_ROW_TONES } from '$lib/domain/contributionRows';
  import { PROPOSAL_EDITOR_SECTIONS, isPendingId, mergeById, missingFields, pendingName } from '$lib/domain/releaseEditor';
  import {
    missingForAccept,
    proposalEditorActions,
    proposalToSnapshot,
    snapshotToProposal,
    type ProposalEditorAction
  } from '$lib/domain/proposalEditor';
  import { Button, Chip, Dialog, ErrorState, Icon, LoadingIndicator, Notice } from '$lib/ui';
  import { dictionaries, resolveCatalogNames, type Artist, type CatalogSnapshot, type DictionaryEntry } from '$lib/services/adminCatalog';
  import {
    CONTRIBUTION_STATUS_LABELS,
    acceptContribution,
    loadContribution,
    prepareContributionForAdmin,
    reviewContribution,
    saveContributionCorrection,
    sourceProviderFor
  } from '$lib/stores/contributionsStore';

  // U19 (G3): una propuesta abierta en el editor del Estudio. Admin la corrige y decide; el
  // colaborador la corrige y la marca lista, sin acceso al Catálogo. Cada guardado es una
  // corrección (save_contribution_correction): la primera la marca como tomada y desde entonces
  // quien la propuso ya no la edita. Abrirla solo para mirar no la toma.

  type Props = {
    contributionId: string;
    role: 'admin' | 'colaborador';
    userId: string;
    /** Volver a la bandeja sin decidir. */
    onclose: () => void;
    /** Se decidió (aceptada, lista, cambios pedidos o rechazada): la bandeja la quita y avisa. */
    ondone: (outcome: ProposalOutcome) => void;
  };

  let { contributionId, role, userId, onclose, ondone }: Props = $props();

  type Feedback = { tone: 'error' | 'success'; text: string } | null;

  let contribution = $state<Contribution | null>(null);
  let draft = $state<CatalogSnapshot | null>(null);
  let baseline = $state('');
  let labels = $state<DictionaryEntry[]>([]);
  let genres = $state<DictionaryEntry[]>([]);
  let countries = $state<DictionaryEntry[]>([]);
  let types = $state<DictionaryEntry[]>([]);
  let artists = $state<Artist[]>([]);
  let unknown = $state<{ genres: string[]; countries: string[] }>({ genres: [], countries: [] });
  let loading = $state(true);
  let loadError = $state('');
  let busy = $state<ProposalEditorAction | ''>('');
  let feedback = $state<Feedback>(null);
  let titleError = $state('');
  let note = $state('');
  let noteEl = $state<HTMLInputElement>();
  let publishOpen = $state(false);
  let publishTrigger = $state<HTMLElement | null>(null);

  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const date = (value: string | null | undefined) => (value ? dateFormat.format(new Date(value)) : '');

  // «allowed» y no «actions»: el snippet de las acciones de la barra se llama así.
  const allowed = $derived(contribution ? proposalEditorActions(contribution, role, userId) : []);
  const can = (action: ProposalEditorAction) => allowed.includes(action);
  const dirty = $derived(draft ? JSON.stringify(draft) !== baseline : false);
  const title = $derived(draft?.title.trim() || 'Propuesta sin título');
  const publishMissing = $derived(draft ? missingFields(draft) : []);
  const nameOf = (id: string) => (isPendingId(id) ? pendingName(id) : artists.find((artist) => artist.id === id)?.name ?? '');
  const queueLabel = $derived(contribution?.queue_kind === 'collaborator' ? 'Cola prioritaria' : 'Cola comunitaria');
  const provider = $derived.by(() => {
    const name = contribution?.source_provider ?? '';
    return name ? name.charAt(0).toLocaleUpperCase('es') + name.slice(1) : 'la fuente';
  });

  // Un aviso de éxito deja de valer en cuanto se vuelve a editar.
  $effect(() => {
    if (dirty) untrack(() => feedback?.tone === 'success' && (feedback = null));
  });

  $effect(() => {
    const id = contributionId;
    untrack(() => void load(id));
  });

  async function load(id: string) {
    loading = true;
    loadError = '';
    feedback = null;
    try {
      const [item, dicts] = await Promise.all([loadContribution(id), dictionaries()]);
      if (!item) throw Object.assign(new Error('Esa propuesta no existe o no está en tu cola.'), { code: 'P0002' });
      const credits = [...(item.payload.primary_artists ?? []), ...(item.payload.collaborators ?? [])];
      const [artistNames, labelNames] = await Promise.all([
        resolveCatalogNames('artist', credits),
        resolveCatalogNames('label', item.payload.label?.trim() ? [item.payload.label] : [])
      ]);
      const mapped = proposalToSnapshot(item, dicts, { artists: artistNames, labels: labelNames });
      labels = mergeById(dicts.labels, mapped.labels);
      genres = dicts.genres;
      countries = dicts.countries;
      types = dicts.types;
      artists = mergeById(artists, mapped.artists);
      unknown = mapped.unknown;
      contribution = item;
      draft = mapped.snapshot;
      baseline = JSON.stringify(mapped.snapshot);
      titleError = '';
      note = '';
    } catch (cause: any) {
      contribution = null;
      draft = null;
      loadError = cause?.message || 'No se pudo abrir la propuesta.';
    } finally {
      loading = false;
    }
  }

  async function fail(text: string, focusNote = false) {
    feedback = { tone: 'error', text };
    if (focusNote) {
      await tick();
      noteEl?.focus();
    }
  }

  /** Error de un RPC de propuestas, en palabras; el conflicto de versión recarga la propuesta. */
  async function showError(cause: any, fallback: string) {
    if (cause?.code === '40001') {
      await load(contributionId);
      feedback = { tone: 'error', text: 'Otra persona guardó esta propuesta después de que la abriste. Cargamos la versión más reciente; revisa antes de guardar.' };
      return;
    }
    feedback = { tone: 'error', text: describeContributionError(cause)?.message ?? (cause?.message || fallback) };
  }

  /** Guarda lo que haya sin guardar como corrección. Devuelve false si no se pudo. */
  async function persist(): Promise<boolean> {
    if (!draft || !contribution) return false;
    if (!dirty) return true;
    if (!draft.title.trim()) {
      titleError = 'El título es obligatorio.';
      await fail('El título es obligatorio.');
      return false;
    }
    const proposal = snapshotToProposal($state.snapshot(draft) as CatalogSnapshot, {
      base: contribution.payload, role, artists, labels, genres, countries, types
    });
    const sourceChanged = proposal.sourceUrl !== contribution.source_url;
    const sourceProvider = sourceProviderFor(proposal.sourceUrl);
    if (sourceChanged && !sourceProvider) {
      await fail('El link de la fuente tiene que ser una URL HTTPS de Bandcamp, Spotify o SoundCloud.');
      return false;
    }
    const saved = await saveContributionCorrection(contribution.id, {
      expectedUpdatedAt: contribution.updated_at,
      payload: proposal.payload,
      ...(sourceChanged ? { sourceUrl: proposal.sourceUrl, sourceProvider: sourceProvider! } : {})
    });
    contribution = saved;
    baseline = JSON.stringify(draft);
    return true;
  }

  async function save() {
    if (busy) return;
    busy = 'save';
    feedback = null;
    const firstTime = !contribution?.taken_at;
    try {
      if (!dirty) return void (feedback = { tone: 'success', text: 'No hay cambios que guardar.' });
      if (await persist()) {
        feedback = {
          tone: 'success',
          text: firstTime ? 'Corrección guardada. Desde ahora quien la propuso ya no puede editarla.' : 'Corrección guardada.'
        };
      }
    } catch (cause: any) {
      await showError(cause, 'No se pudo guardar la corrección.');
    } finally {
      busy = '';
    }
  }

  async function prepare() {
    if (busy || !contribution) return;
    busy = 'prepare';
    feedback = null;
    try {
      if (!(await persist())) return;
      // Ya guardada: se marca lista sin payload, así la nota interna no va al historial del autor.
      const updated = await prepareContributionForAdmin(contribution.id, {}, note.trim());
      ondone({ contribution: updated, flash: `${title} quedó lista para administración.`, releaseId: null });
    } catch (cause: any) {
      await showError(cause, 'No se pudo marcar la propuesta como lista.');
    } finally {
      busy = '';
    }
  }

  function askPublish(trigger: HTMLElement) {
    if (!draft) return;
    const missing = missingForAccept(draft);
    if (missing.length) return void fail(`Completa antes de aceptar: ${missing.join(', ')}.`);
    if (publishMissing.length) return void fail(`Completa antes de publicar: ${publishMissing.join(', ')}.`);
    feedback = null;
    publishTrigger = trigger;
    publishOpen = true;
  }

  async function accept(publish: boolean) {
    if (busy || !draft || !contribution) return;
    const missing = missingForAccept(draft);
    if (missing.length) return void fail(`Completa antes de aceptar: ${missing.join(', ')}.`);
    busy = publish ? 'accept_publish' : 'accept_draft';
    feedback = null;
    try {
      if (!(await persist())) return;
      const created = await acceptContribution(contribution.id, { publish, expectedUpdatedAt: contribution.updated_at, note: note.trim() || undefined });
      publishOpen = false;
      ondone({
        contribution: null,
        flash: publish ? `${title}: aceptada y publicada.` : `${title}: aceptada como borrador del catálogo.`,
        releaseId: created.release_id
      });
    } catch (cause: any) {
      publishOpen = false;
      if (cause?.code === '23514') feedback = { tone: 'error', text: 'Para publicar faltan datos: portada HTTPS, enlace principal, fecha, tipo, sello, artista, género y país.' };
      else await showError(cause, 'No se pudo aceptar la propuesta.');
    } finally {
      busy = '';
    }
  }

  async function review(action: 'changes_requested' | 'rejected') {
    if (busy || !contribution) return;
    if (!note.trim()) {
      return void fail(action === 'rejected' ? 'Escribe una nota antes de rechazar.' : 'Escribe una nota para pedir cambios.', true);
    }
    busy = action === 'rejected' ? 'reject' : 'changes';
    feedback = null;
    try {
      const updated = await reviewContribution(contribution.id, action, note.trim());
      ondone({ contribution: updated, flash: `${title}: ${CONTRIBUTION_STATUS_LABELS[updated.status]}.`, releaseId: null });
    } catch (cause: any) {
      await showError(cause, 'No se pudo registrar la decisión.');
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head><title>{draft ? `${title} · ` : ''}Propuestas · Estudio — Discótica</title></svelte:head>

{#if loading && !draft}
  <div class="proposal__state"><LoadingIndicator label="Abriendo la propuesta" /></div>
{:else if loadError || !draft || !contribution}
  <ErrorState size="inline" message={loadError || 'No se pudo abrir la propuesta.'} actionLabel="Volver a las propuestas" onaction={onclose} />
{:else}
  {@const item = contribution}
  <ReleaseForm
    bind:release={draft}
    bind:labels
    bind:artists
    bind:titleError
    bind:note
    bind:noteElement={noteEl}
    {genres}
    {countries}
    {types}
    sections={PROPOSAL_EDITOR_SECTIONS}
    eyebrow="Corregir propuesta"
    backLabel="Volver a las propuestas"
    {onclose}
    createdWhen="al aceptar"
    lockedNote={role === 'admin' ? '' : 'Solo admin cambia la reseña y la portada.'}
    reviewHint={role === 'admin' && item.payload.team_note?.trim() ? 'Empieza con la nota de quien propone. Si la dejas vacía, se publica esa nota.' : undefined}
    {feedback}
    statusText={dirty ? 'Cambios sin guardar.' : item.taken_at ? 'Sin cambios.' : 'Sin cambios. Abrirla no la toma.'}
    clean={!dirty}
    noteLabel={role === 'admin' ? 'Nota para quien propone' : 'Nota interna para admin'}
    notePlaceholder={role === 'admin' ? 'Nota para quien propone (obligatoria al pedir cambios o rechazar)' : 'Nota interna para admin (opcional)'}
    onnoteenter={() => void (can('save') && save())}
    stackActions={role === 'admin'}
    onmessage={(text) => fail(text)}
  >
    {#snippet meta()}
      <Chip kind="status" label={CONTRIBUTION_STATUS_LABELS[item.status]} tone={CONTRIBUTION_ROW_TONES[item.status]} />
      <span class="proposal__queue">{queueLabel}</span>
    {/snippet}
    {#snippet intro()}
      {#if !allowed.length}
        <Notice>Esta propuesta ya no está en tu cola: puedes mirarla, pero no corregirla.</Notice>
      {/if}
      {#if unknown.genres.length || unknown.countries.length}
        <Notice tone="warning" title="Valores fuera de la lista">
          {[...unknown.genres, ...unknown.countries].map((value) => `«${value}»`).join(', ')}
          {unknown.genres.length + unknown.countries.length === 1 ? 'no está' : 'no están'} en la lista de géneros y países, así que no se cargaron. Elige un valor de la lista antes de guardar.
        </Notice>
      {/if}
    {/snippet}
    {#snippet tail()}
      <dl class="proposal__facts">
        <dt>Cola</dt><dd>{queueLabel}</dd>
        {#if item.submitted_at}<dt>Enviada</dt><dd>{date(item.submitted_at)}</dd>{/if}
        <dt>Quien propone</dt>
        <dd>
          {#if item.taken_at}
            Ya no puede editarla: el equipo la tomó el {date(item.taken_at)}.
          {:else}
            Todavía puede editarla. Deja de poder en cuanto alguien del equipo guarde una corrección, la marque lista o la acepte.
          {/if}
        </dd>
        <dt>Fuente</dt>
        <dd><a class="proposal__link" href={item.source_url} target="_blank" rel="noreferrer">Abrir la fuente en {provider}<Icon name="flecha-externa" size="em" /></a></dd>
      </dl>
      {#if item.payload.team_note?.trim()}
        <div class="l-inbox-note"><strong>Nota de quien propone</strong><p>{item.payload.team_note}</p></div>
      {:else}
        <div class="l-inbox-note l-inbox-note--empty"><strong>Nota de quien propone</strong><p>Sin nota</p></div>
      {/if}
      {#if item.reviewer_note}
        <div class="l-inbox-note"><strong>Nota de la revisión anterior</strong><p>{item.reviewer_note}</p></div>
      {/if}
    {/snippet}
    {#snippet actions()}
      {#if role === 'admin' && can('accept_draft')}
        <div class="editor__bar-group">
          <Button variant="secondary" disabled={!!busy} loading={busy === 'changes'} onclick={() => review('changes_requested')}>Pedir cambios</Button>
          <Button variant="destructive" disabled={!!busy} loading={busy === 'reject'} onclick={() => review('rejected')}>Rechazar</Button>
        </div>
        <div class="editor__bar-group">
          <Button variant="secondary" disabled={!!busy} loading={busy === 'save'} onclick={save}>Guardar</Button>
          <Button disabled={!!busy} loading={busy === 'accept_draft'} onclick={() => accept(false)}>Aceptar como borrador</Button>
          <Button variant="accent" disabled={!!busy || publishMissing.length > 0} onclick={(event: MouseEvent) => askPublish(event.currentTarget as HTMLElement)}>Aceptar y publicar</Button>
        </div>
      {:else if can('prepare')}
        <Button variant="secondary" disabled={!!busy} loading={busy === 'save'} onclick={save}>Guardar corrección</Button>
        <Button disabled={!!busy} loading={busy === 'prepare'} onclick={prepare}>Marcar lista para admin</Button>
      {/if}
    {/snippet}
  </ReleaseForm>
{/if}

{#if draft}
  {@const release = draft}
  <Dialog bind:open={publishOpen} title="Aceptar y publicar" size="sm" dismissible={!busy} returnFocus={publishTrigger} initialFocus="[data-dialog-focus]">
    <p class="proposal__dialog-text"><strong>{title}</strong> se crea en el catálogo y queda visible. Los artistas y el sello nuevos se crean en la misma operación.</p>
    <dl class="proposal__dialog-facts">
      <dt>Artistas</dt><dd>{release.artist_ids.map(nameOf).join(', ')}</dd>
      <dt>Sello</dt><dd>{release.label_id ? (isPendingId(release.label_id) ? `${pendingName(release.label_id)} (nuevo)` : labels.find((label) => label.id === release.label_id)?.name) : ''}</dd>
      <dt>Fecha</dt><dd>{release.release_date ? date(`${release.release_date}T12:00:00`) : 'Sin fecha'}</dd>
    </dl>
    {#snippet footer()}
      <Button variant="secondary" disabled={!!busy} onclick={() => (publishOpen = false)}>Seguir editando</Button>
      <Button loading={busy === 'accept_publish'} onclick={() => accept(true)} data-dialog-focus>Confirmar y publicar</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .proposal__state { display: grid; place-items: center; min-height: 16rem; }
  .proposal__queue { color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  .proposal__facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-3);
    font-size: var(--density-text);
  }
  .proposal__facts dt { color: var(--color-texto-tenue); }
  .proposal__facts dd { margin: 0; color: var(--color-texto); overflow-wrap: anywhere; }
  .proposal__link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--target-touch);
    color: var(--color-acento);
  }

  .proposal__dialog-text { margin: 0 0 var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .proposal__dialog-facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-4);
    margin: 0;
    font-size: var(--text-sm);
  }
  .proposal__dialog-facts dt { color: var(--color-texto-tenue); }
  .proposal__dialog-facts dd { margin: 0; color: var(--color-texto); }

  @media (max-width: 679px) {
    .proposal__facts { grid-template-columns: minmax(0, 1fr); gap: var(--space-1); }
    .proposal__facts dd + dt { margin-top: var(--space-2); }
  }
</style>
