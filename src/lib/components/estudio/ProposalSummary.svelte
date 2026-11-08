<script lang="ts">
  import ProposalDecisions from './ProposalDecisions.svelte';
  import type { ProposalOutcome } from './ProposalEditor.svelte';
  import { CONTRIBUTION_DOT_TONES } from '$lib/domain/contributionRows';
  import { proposalCover } from '$lib/domain/proposalEditor';
  import { studioReleaseHref } from '$lib/domain/studio';
  import { proposalAction, proposalFields, relativeInboxDate, type ProposalFieldKey } from '$lib/domain/studioInbox';
  import { Button, Cover, IconButton, SourceLink, StatusDot } from '$lib/ui';
  import { CONTRIBUTION_STATUS_LABELS, RELEASE_TYPE_OPTIONS, type Contribution } from '$lib/stores/contributionsStore';

  // Resumen de una propuesta en la bandeja (U23, tablero 4): la misma cabecera que el editor, los
  // campos en tres columnas con un punto ámbar en lo que difiere de la fuente, la nota como
  // comentario y las decisiones abajo. «Editar» abre el editor sin mover la cabecera.

  type Props = {
    item: Contribution;
    role: 'admin' | 'colaborador';
    userId: string;
    /** Nombre del grupo en la bandeja («Prioritaria», «Comunidad»). */
    group: string;
    catalogAvailable: boolean;
    /** El h2, para devolverle el foco. */
    heading?: HTMLHeadingElement;
    editHref: string;
    onedit: (event: MouseEvent) => void;
    ondone: (outcome: ProposalOutcome) => void;
  };

  let { item, role, userId, group, catalogAvailable, heading = $bindable(), editHref, onedit, ondone }: Props = $props();

  // Título y artistas van en la cabecera; el resto, en este orden.
  const ORDER: ProposalFieldKey[] = ['release_type', 'release_date', 'label', 'collaborators', 'genres', 'countries'];
  const EDITED = 'Cambiado frente a la fuente';
  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  let error = $state('');

  const fields = $derived(proposalFields(item, RELEASE_TYPE_OPTIONS));
  const field = (key: ProposalFieldKey) => fields.find((entry) => entry.key === key);
  const body = $derived(ORDER.map(field).filter((entry) => entry !== undefined));
  const action = $derived(proposalAction(item, role, userId));
  const title = $derived(item.payload.title?.trim() || 'Propuesta sin título');
  const artists = $derived(item.payload.primary_artists?.join(', ') ?? '');
  const cover = $derived(proposalCover(item));
  const sent = $derived(relativeInboxDate(item.submitted_at ?? item.updated_at));
  const note = $derived(item.payload.team_note?.trim() ?? '');
  const shownDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : value);

  // Reiniciar el aviso al cambiar de propuesta.
  $effect(() => {
    void item.id;
    error = '';
  });
</script>

{#snippet edited(on: boolean | undefined, label: string)}
  {#if on}<span class="summary__edited" title={EDITED} data-edited={label}><span class="sr-only">{EDITED}</span></span>{/if}
{/snippet}

<article class="summary" aria-label={title}>
  <header class="summary__head">
    <span class="summary__cover" style="view-transition-name: proposal-cover"><Cover src={cover} alt="" radius="sm" /></span>
    <div class="summary__identity">
      <h2 class="summary__title" tabindex="-1" bind:this={heading} style="view-transition-name: proposal-title">{title}{@render edited(field('title')?.edited, 'Título')}</h2>
      <p class="summary__artists">{artists || 'Sin artistas'}{@render edited(field('primary_artists')?.edited, 'Artistas principales')}</p>
      <p class="summary__line">
        <StatusDot label={CONTRIBUTION_STATUS_LABELS[item.status]} tone={CONTRIBUTION_DOT_TONES[item.status]} />
        {#if group}<span class="summary__part">{group}</span>{/if}
        {#if sent}<span class="summary__part">{sent}</span>{/if}
      </p>
    </div>
    <div class="summary__icons">
      {#if item.release_id && catalogAvailable}
        <IconButton icon="grilla" variant="secondary" href={studioReleaseHref(item.release_id)} label="Abrir el lanzamiento en el Catálogo" tooltip="bottom" tooltipAlign="end" />
      {/if}
      <SourceLink href={item.source_url} provider={item.source_provider} tooltip="bottom" tooltipAlign="end" />
    </div>
  </header>

  <dl class="summary__fields">
    {#each body as entry (entry.key)}
      <div class="summary__field">
        <dt>{entry.key === 'countries' ? 'País' : entry.label}{@render edited(entry.edited, entry.label)}</dt>
        <dd class:summary__empty={!entry.value}>{entry.value ? (entry.key === 'release_date' ? shownDate(entry.value) : entry.value) : '—'}</dd>
      </div>
    {/each}
  </dl>

  {#if note}
    <figure class="summary__comment">
      <span class="summary__avatar" aria-hidden="true">“</span>
      <figcaption class="summary__comment-body">
        <span class="summary__comment-head"><strong>Nota de quien propone</strong>{#if item.submitted_at}<time datetime={item.submitted_at}>{relativeInboxDate(item.submitted_at)}</time>{/if}</span>
        <p>{note}</p>
      </figcaption>
    </figure>
  {/if}
  {#if item.reviewer_note && action === 'none'}
    <figure class="summary__comment">
      <span class="summary__avatar summary__avatar--team" aria-hidden="true">✓</span>
      <figcaption class="summary__comment-body">
        <span class="summary__comment-head"><strong>Revisión</strong>{#if item.reviewed_at}<time datetime={item.reviewed_at}>{relativeInboxDate(item.reviewed_at)}</time>{/if}</span>
        <p>{item.reviewer_note}</p>
      </figcaption>
    </figure>
  {/if}

  {#if action === 'review' || action === 'prepare' || action === 'waiting'}
    <footer class="summary__actions">
      {#if error}<p class="summary__error" role="alert" title={error}>{error}</p>{/if}
      <div class="summary__buttons">
        {#if action === 'waiting'}
          <span class="summary__waiting">Espera a admin</span>
        {:else}
          <Button variant={action === 'prepare' ? 'primary' : 'secondary'} icon="editar" href={editHref} onclick={onedit}>Editar</Button>
          {#if action === 'review'}
            <span class="summary__spacer"></span>
            <ProposalDecisions
              contribution={item}
              {role}
              {title}
              facts={{ artists, label: item.payload.label ?? '', date: item.payload.release_date ? shownDate(item.payload.release_date) : '' }}
              onerror={(text) => (error = text)}
              {ondone}
            />
          {/if}
        {/if}
      </div>
    </footer>
  {/if}
</article>

<style>
  .summary {
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
    background: var(--color-superficie-1);
  }

  /* ---- Cabecera: la del editor, con la portada más grande -------------- */
  .summary__head {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--tool-pad-panel-y) var(--tool-pad-panel-x);
    border-bottom: 1px solid var(--color-linea-sutil);
  }
  .summary__cover {
    display: block;
    flex: 0 0 var(--tool-summary-thumb);
    width: var(--tool-summary-thumb);
    height: var(--tool-summary-thumb);
  }
  .summary__identity { display: flex; flex: 1 1 auto; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .summary__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: var(--leading-heading);
    overflow-wrap: anywhere;
  }
  .summary__title:focus { outline: none; }
  .summary__title:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; }
  .summary__artists { margin: 0; color: var(--color-texto-alto); font-size: var(--density-text); overflow-wrap: anywhere; }
  .summary__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    margin: var(--space-1) 0 0;
    overflow: hidden;
    color: var(--color-texto-medio);
    font-size: var(--text-2xs);
  }
  /* El punto vive en el hueco: si la parte abre línea, cae fuera de la caja y no queda suelto. */
  .summary__part { position: relative; }
  .summary__part::before { content: '·'; position: absolute; left: calc(var(--space-4) / -2); transform: translateX(-50%); }
  .summary__line :global(.ui-status) { color: var(--color-texto-medio); }
  .summary__icons { display: flex; flex: none; gap: var(--space-2); align-self: flex-start; }

  /* Punto ámbar: el campo difiere de lo que detectó la fuente. */
  .summary__edited {
    display: inline-block;
    width: calc(var(--icon-sm) / 2.5);
    height: calc(var(--icon-sm) / 2.5);
    margin-left: var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-aviso);
    vertical-align: middle;
    cursor: default;
  }

  /* ---- Campos: tres columnas (dos bajo 680) --------------------------- */
  .summary__fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--tool-gap-row) var(--tool-gap-col);
    margin: 0;
    padding: var(--tool-pad-panel-x);
  }
  .summary__field { min-width: 0; }
  .summary__field dt {
    margin-bottom: var(--tool-gap-label);
    color: var(--color-texto-tenue);
    font-size: var(--density-label);
    font-weight: 600;
  }
  .summary__field dd { margin: 0; color: var(--color-texto); font-size: var(--density-text); overflow-wrap: anywhere; }
  .summary__field dd.summary__empty { color: var(--color-texto-tenue); }

  /* ---- Nota como comentario ------------------------------------------ */
  .summary__comment {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    margin: 0 var(--tool-pad-panel-x) var(--tool-pad-panel-x);
    padding-top: var(--tool-pad-panel-y);
    border-top: 1px solid var(--color-linea-sutil);
  }
  .summary__comment + .summary__comment { border-top: 0; padding-top: 0; }
  .summary__avatar {
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
  .summary__avatar--team { background: var(--color-acento-tinte); color: var(--color-acento); }
  .summary__comment-body { display: flex; flex: 1 1 auto; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .summary__comment-head { display: flex; align-items: baseline; gap: var(--space-2); font-size: var(--text-xs); }
  .summary__comment-head strong { color: var(--color-texto); font-weight: 700; }
  .summary__comment-head time { color: var(--color-texto-tenue); font-size: var(--text-2xs); }
  .summary__comment p { margin: 0; color: var(--color-texto-alto); font-size: var(--density-text); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }

  /* ---- Decisiones ----------------------------------------------------- */
  .summary__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--tool-pad-panel-x);
    border-top: 1px solid var(--color-linea);
  }
  .summary__buttons { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .summary__spacer { flex: 1 1 auto; }
  .summary__waiting { color: var(--color-texto-medio); font-size: var(--text-xs); }
  .summary__error { margin: 0; color: var(--color-danger-texto); font-size: var(--text-xs); font-weight: 600; }

  @media (max-width: 679px) {
    .summary__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 479px) {
    .summary__head { flex-wrap: wrap; }
    .summary__cover { flex-basis: var(--tool-editor-thumb); width: var(--tool-editor-thumb); height: var(--tool-editor-thumb); }
    .summary__identity { flex-basis: 10rem; }
    .summary__icons { align-self: center; }
    .summary__spacer { display: none; }
    .summary__buttons > :global(*) { flex: 1 1 auto; }
    /* La decisión principal ocupa su propia fila, a todo el ancho. */
    .summary__buttons > :global(.ui-split) { flex: 1 1 100%; }
    .summary__buttons :global(.ui-split__main) { flex: 1 1 auto; }
  }
</style>
