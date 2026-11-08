<script lang="ts" module>
  import type { Contribution } from '$lib/stores/contributionsStore';

  /** Lo que la bandeja necesita saber cuando se decide una propuesta en el editor. */
  export type ProposalOutcome = { contribution: Contribution | null; flash: string; releaseId: string | null };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import ReleaseForm from './ReleaseForm.svelte';
  import ProposalDecisions from './ProposalDecisions.svelte';
  import { describeContributionError } from '$lib/domain/contributionContract';
  import { CONTRIBUTION_DOT_TONES } from '$lib/domain/contributionRows';
  import { EDITOR_SECTIONS, changedFields, isPendingId, mergeById, missingFields, pendingName } from '$lib/domain/releaseEditor';
  import { relativeInboxDate } from '$lib/domain/studioInbox';
  import {
    missingForAccept,
    proposalCover,
    proposalEditorActions,
    proposalToSnapshot,
    snapshotToProposal
  } from '$lib/domain/proposalEditor';
  import { Button, Cover, ErrorState, IconButton, LoadingIndicator, Notice, SourceLink, StatusDot } from '$lib/ui';
  import { dictionaries, resolveCatalogNames, type Artist, type CatalogSnapshot, type DictionaryEntry } from '$lib/services/adminCatalog';
  import {
    CONTRIBUTION_STATUS_LABELS,
    loadContribution,
    saveContributionCorrection,
    sourceProviderFor
  } from '$lib/stores/contributionsStore';

  // U19 (G3): una propuesta abierta en el editor del Estudio. Admin la corrige y decide; el
  // colaborador la corrige y la marca lista, sin acceso al Catálogo. Cada guardado es una
  // corrección (save_contribution_correction): la primera la marca como tomada y desde entonces
  // quien la propuso ya no la edita. Abrirla solo para mirar no la toma.
  // U23 (tablero 5): la cabecera del editor con ‹ n de N ›; bajo ella, la nota de quien propone
  // como comentario y la marca «Sin tomar» o «Tomada» (la regla, en el tooltip); sin bloque
  // «Propuesta»; y en la barra las mismas decisiones que el resumen de la bandeja.

  type Props = {
    contributionId: string;
    role: 'admin' | 'colaborador';
    userId: string;
    /** Lo que ya se sabe de la bandeja, para pintar la cabecera mientras carga (sin salto). */
    preview?: { title: string; cover: string | null } | null;
    /** Posición en la bandeja: ‹ n de N ›. */
    position?: { index: number; total: number; prev: string | null; next: string | null } | null;
    /** Ir a otra propuesta de la misma bandeja sin volver. */
    onstep?: (id: string) => void;
    /** Volver a la bandeja sin decidir. */
    onclose: () => void;
    /** Se decidió (aceptada, lista, cambios pedidos o rechazada): la bandeja la quita y avisa. */
    ondone: (outcome: ProposalOutcome) => void;
  };

  let { contributionId, role, userId, preview = null, position = null, onstep, onclose, ondone }: Props = $props();

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
  let saving = $state(false);
  let deciding = $state(false);
  let feedback = $state<Feedback>(null);
  let titleError = $state('');

  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const date = (value: string | null | undefined) => (value ? dateFormat.format(new Date(value)) : '');

  const allowed = $derived(contribution ? proposalEditorActions(contribution, role, userId) : []);
  const dirty = $derived(draft ? JSON.stringify(draft) !== baseline : false);
  const changes = $derived(draft && dirty ? changedFields({ before_state: JSON.parse(baseline), after_state: $state.snapshot(draft) as Record<string, unknown> }) : []);
  const title = $derived(draft?.title.trim() || 'Propuesta sin título');
  const publishMissing = $derived(draft ? missingFields(draft) : []);
  const acceptMissing = $derived(draft ? missingForAccept(draft) : []);
  const nameOf = (id: string) => (isPendingId(id) ? pendingName(id) : artists.find((artist) => artist.id === id)?.name ?? '');
  const queueLabel = $derived(contribution?.queue_kind === 'collaborator' ? 'Prioritaria' : 'Comunidad');
  const takenRule = $derived(
    contribution?.taken_at
      ? `Tomada el ${date(contribution.taken_at)}: quien la propuso ya no puede editarla.`
      : 'Quien la propuso puede editarla hasta que alguien del equipo guarde una corrección, la marque lista o la acepte. Abrirla no la toma.'
  );
  const facts = $derived.by(() => {
    if (!draft) return { artists: '', label: '', date: '' };
    const label = draft.label_id ? (isPendingId(draft.label_id) ? `${pendingName(draft.label_id)} (nuevo)` : labels.find((entry) => entry.id === draft!.label_id)?.name ?? '') : '';
    return { artists: draft.artist_ids.map(nameOf).join(', '), label, date: draft.release_date ? date(`${draft.release_date}T12:00:00`) : '' };
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
    } catch (cause: any) {
      contribution = null;
      draft = null;
      loadError = cause?.message || 'No se pudo abrir la propuesta.';
    } finally {
      loading = false;
    }
  }

  function fail(text: string) {
    feedback = { tone: 'error', text };
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
      fail('El título es obligatorio.');
      return false;
    }
    const proposal = snapshotToProposal($state.snapshot(draft) as CatalogSnapshot, {
      base: contribution.payload, role, artists, labels, genres, countries, types
    });
    const sourceChanged = proposal.sourceUrl !== contribution.source_url;
    const sourceProvider = sourceProviderFor(proposal.sourceUrl);
    if (sourceChanged && !sourceProvider) {
      fail('El link de la fuente tiene que ser una URL HTTPS de Bandcamp, Spotify o SoundCloud.');
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

  /** Antes de decidir: guarda la corrección; sus errores se ven en la barra. */
  async function beforeDecision(): Promise<boolean> {
    feedback = null;
    try {
      return await persist();
    } catch (cause: any) {
      await showError(cause, 'No se pudo guardar la corrección.');
      return false;
    }
  }

  async function save() {
    if (saving || deciding) return;
    saving = true;
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
      saving = false;
    }
  }

  function decisionError(text: string, cause?: any) {
    if (cause?.code === '40001') void showError(cause, text);
    else fail(text);
  }
</script>

<svelte:head><title>{draft ? `${title} · ` : ''}Propuestas · Estudio — Discótica</title></svelte:head>

{#if loading && !draft}
  <div class="proposal__head" aria-busy="true">
    <IconButton icon="flecha-izquierda" label="Volver a las propuestas" variant="secondary" onclick={onclose} />
    <span class="proposal__thumb" style="view-transition-name: proposal-cover"><Cover src={preview?.cover ?? null} alt="" radius="sm" loading="eager" /></span>
    {#if preview}<p class="proposal__title" style="view-transition-name: proposal-title">{preview.title}</p>{/if}
  </div>
  <div class="proposal__state"><LoadingIndicator label="Abriendo la propuesta" /></div>
{:else if loadError || !draft || !contribution}
  <ErrorState size="inline" message={loadError || 'No se pudo abrir la propuesta.'} actionLabel="Volver a las propuestas" onaction={onclose} />
{:else}
  {@const item = contribution}
  {@const note = item.payload.team_note?.trim() ?? ''}
  <ReleaseForm
    bind:release={draft}
    bind:labels
    bind:artists
    bind:titleError
    {genres}
    {countries}
    {types}
    sections={EDITOR_SECTIONS}
    backLabel="Volver a las propuestas"
    {onclose}
    createdWhen="al aceptar"
    lockedNote={role === 'admin' ? '' : 'Solo admin cambia la portada.'}
    {feedback}
    {changes}
    clean={!dirty}
    transition
    onmessage={(text) => fail(text)}
  >
    {#snippet status()}
      <StatusDot label={CONTRIBUTION_STATUS_LABELS[item.status]} tone={CONTRIBUTION_DOT_TONES[item.status]} />
      <span class="proposal__sep" aria-hidden="true">·</span>
      <span>{queueLabel}</span>
    {/snippet}
    {#snippet meta()}
      <SourceLink href={item.source_url} provider={item.source_provider} tooltip="bottom" />
      {#if position && position.total > 1}
        <span class="proposal__pager" role="group" aria-label="Propuestas de la bandeja">
          <IconButton icon="chevron-izquierda" label="Propuesta anterior" tooltip="bottom" disabled={!position.prev} onclick={() => position?.prev && onstep?.(position.prev)} />
          <span class="proposal__pager-count">{position.index + 1} de {position.total}</span>
          <IconButton icon="chevron-derecha" label="Propuesta siguiente" tooltip="bottom" tooltipAlign="end" disabled={!position.next} onclick={() => position?.next && onstep?.(position.next)} />
        </span>
      {/if}
    {/snippet}
    {#snippet intro()}
      <div class="proposal__note">
        {#if note}
          <span class="proposal__avatar" aria-hidden="true">“</span>
          <div class="proposal__note-body">
            <span class="proposal__note-head"><strong>Nota de quien propone</strong>{#if item.submitted_at}<time datetime={item.submitted_at}>{relativeInboxDate(item.submitted_at)}</time>{/if}</span>
            <p>{note}</p>
          </div>
        {:else}
          <span class="proposal__note-none">Sin nota de quien propone</span>
        {/if}
        <span class="proposal__taken" title={takenRule}>
          {item.taken_at ? 'Tomada' : 'Sin tomar'}<span class="sr-only">: {takenRule}</span>
        </span>
      </div>
      {#if item.reviewer_note}
        <div class="proposal__note proposal__note--review">
          <span class="proposal__avatar proposal__avatar--team" aria-hidden="true">✓</span>
          <div class="proposal__note-body">
            <span class="proposal__note-head"><strong>Revisión anterior</strong>{#if item.reviewed_at}<time datetime={item.reviewed_at}>{relativeInboxDate(item.reviewed_at)}</time>{/if}</span>
            <p>{item.reviewer_note}</p>
          </div>
        </div>
      {/if}
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
    {#snippet actions()}
      {#if allowed.length}
        <Button variant="secondary" disabled={deciding} loading={saving} onclick={save}>{role === 'admin' ? 'Guardar' : 'Guardar corrección'}</Button>
        <ProposalDecisions
          contribution={item}
          {role}
          {title}
          before={beforeDecision}
          {publishMissing}
          {acceptMissing}
          {facts}
          disabled={saving}
          onbusy={(busy) => (deciding = busy)}
          onerror={decisionError}
          {ondone}
        />
      {/if}
    {/snippet}
  </ReleaseForm>
{/if}

<style>
  .proposal__state { display: grid; place-items: center; min-height: 16rem; }
  .proposal__sep { color: var(--color-texto-tenue); }

  /* Mientras carga: la misma cabecera, para que la transición no salte. */
  .proposal__head {
    display: flex;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    padding-bottom: var(--tool-gap-header);
    border-bottom: 1px solid var(--color-linea);
  }
  .proposal__thumb { display: block; flex: 0 0 var(--tool-editor-thumb); width: var(--tool-editor-thumb); height: var(--tool-editor-thumb); }
  .proposal__title { margin: 0; color: var(--color-texto); font-size: var(--text-xl); font-weight: 800; line-height: var(--leading-heading); }

  .proposal__pager { display: inline-flex; align-items: center; gap: var(--space-1); }
  .proposal__pager-count { color: var(--color-texto-medio); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* La nota de quien propone, como comentario; la marca de «tomada» a la derecha. */
  .proposal__note {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3) var(--space-4);
    padding-block: var(--tool-pad-panel-y);
    border-bottom: 1px solid var(--color-linea-sutil);
  }
  .proposal__note--review { padding-top: 0; }
  .proposal__avatar {
    display: inline-flex;
    flex: 0 0 var(--space-6);
    align-items: center;
    justify-content: center;
    width: var(--space-6);
    height: var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-3);
    color: var(--color-texto-alto);
    font-size: var(--text-2xs);
    font-weight: 700;
  }
  .proposal__avatar--team { background: var(--color-acento-tinte); color: var(--color-acento); }
  .proposal__note-body { display: flex; flex: 1 1 auto; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .proposal__note-head { display: flex; align-items: baseline; gap: var(--space-2); font-size: var(--text-xs); }
  .proposal__note-head strong { color: var(--color-texto); font-weight: 700; }
  .proposal__note-head time { color: var(--color-texto-tenue); font-size: var(--text-2xs); }
  .proposal__note-body p { margin: 0; color: var(--color-texto-alto); font-size: var(--density-text); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .proposal__note-none { flex: 1 1 auto; color: var(--color-texto-tenue); font-size: var(--text-xs); }
  .proposal__taken {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: var(--space-5);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-2);
    color: var(--color-texto-medio);
    font-size: var(--text-2xs);
    font-weight: 600;
    cursor: default;
  }

  @media (max-width: 767px) {
    .proposal__note { flex-wrap: wrap; }
  }
</style>
