<script lang="ts">
  // Reportes del Estudio (U17, U24): bandeja solo para administración. La lista lleva el estado
  // como punto y la descripción; el detalle pone la descripción como titular, el lanzamiento
  // como bloque de acción («Corregir lanzamiento» abre el editor y al guardar vuelve aquí con
  // «Resuelto» elegido, sin guardarlo) y la clasificación de siempre
  // (`admin_update_problem_report`). El layout ya comprobó sesión y rol.
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button, Cover, EmptyState, ErrorState, Icon, IconButton, LoadingIndicator, Notice, Select, StatusDot, Textarea, type StatusTone } from '$lib/ui';
  import { InboxDetail, InboxField, InboxItem, InboxLayout, ToolHeader } from '$lib/layouts';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { InboxSelection } from '$lib/components/estudio/inboxSelection.svelte';
  import { studioReleaseHref, studioReportsHref, withParams } from '$lib/domain/studio';
  import { OPEN_REPORT_STATUSES, REPORT_STATUS_TONES, relativeInboxDate, reportContextRows, reportGroups, selectInboxItem } from '$lib/domain/studioInbox';
  import { dictionaries, getArtistsByIds, getCatalogRelease, type CatalogSnapshot, type CatalogStatus, type DictionaryEntry } from '$lib/services/adminCatalog';
  import {
    loadProblemReports,
    updateProblemReport,
    REPORT_CATEGORIES,
    REPORT_STATUSES,
    reportStatusLabel,
    type ProblemReport
  } from '$lib/services/problemReports';

  const studio = getStudioContext();
  const userId = studio.userId;
  const catalogAvailable = studio.sections.includes('catalogo');
  const selection = new InboxSelection('reporte');
  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
  const STATUS_OPTIONS = REPORT_STATUSES.map(([value, label]) => ({ value, label }));
  /** En la lista, la categoría en una palabra. */
  const SHORT_CATEGORIES: Record<string, string> = { catalog_error: 'Catálogo', technical_bug: 'Técnico', general_feedback: 'Comentario' };
  const RELEASE_STATUS: Record<CatalogStatus, { label: string; tone: StatusTone }> = {
    draft: { label: 'Borrador', tone: 'draft' },
    published: { label: 'Publicado', tone: 'ok' },
    archived: { label: 'Archivado', tone: 'danger' }
  };
  const NOTE_RULE = 'Solo la ve el equipo: no se envía a quien reportó ni sale por correo. La captura y el contexto técnico tampoco los ve quien reporta.';

  type ReleaseInfo = { state: 'loading' } | { state: 'error' } | { state: 'ok'; release: CatalogSnapshot; artists: string };

  let loaded = $state(false);
  let reports = $state<ProblemReport[]>([]);
  let loadError = $state('');
  let actionError = $state('');
  let flash = $state('');
  let busy = $state('');
  let reportNotes = $state<Record<string, string>>({});
  let reportStates = $state<Record<string, ProblemReport['status']>>({});
  let reportAssignees = $state<Record<string, string>>({});
  /** Lanzamientos reportados, leídos al abrir su reporte. */
  let releases = $state<Record<string, ReleaseInfo>>({});
  let names: Promise<{ labels: DictionaryEntry[]; countries: DictionaryEntry[]; types: DictionaryEntry[] }> | null = null;

  /** ?lanzamiento=<uuid>: solo los reportes de ese lanzamiento. ?autor=<uuid>: los de esa persona. */
  const releaseFilter = $derived(page.url.searchParams.get('lanzamiento'));
  const authorFilter = $derived(page.url.searchParams.get('autor'));
  const visible = $derived(
    reports.filter((report) => (!releaseFilter || report.release_id === releaseFilter) && (!authorFilter || report.author_id === authorFilter))
  );
  const groups = $derived(reportGroups(visible));
  const ordered = $derived(groups.flatMap((group) => group.items));
  const ids = $derived(ordered.map((report) => report.id));
  const selectedId = $derived(loaded ? selectInboxItem(ids, selection.requested, selection.wide) : null);
  const selected = $derived(ordered.find((report) => report.id === selectedId) ?? null);
  const openCount = $derived(visible.filter((report) => (OPEN_REPORT_STATUSES as readonly string[]).includes(report.status)).length);

  async function load() {
    loaded = false;
    loadError = '';
    try {
      reports = await loadProblemReports();
    } catch (cause: any) {
      reports = [];
      loadError = cause?.message || 'Inténtalo de nuevo en un momento.';
    } finally {
      loaded = true;
    }
  }

  $effect(() => {
    void load();
  });

  $effect(() => {
    void selectedId;
    actionError = '';
  });

  // Vuelta del editor (?corregido=1): «Resuelto» queda elegido, sin guardarlo. El parámetro sale
  // de la URL para que recargar no lo vuelva a elegir.
  $effect(() => {
    if (!loaded || !page.url.searchParams.has('corregido')) return;
    const id = page.url.searchParams.get('reporte');
    untrack(() => {
      const report = reports.find((entry) => entry.id === id);
      if (report) {
        if (report.status !== 'resolved' && report.status !== 'closed') reportStates[report.id] = 'resolved';
        flash = 'Lanzamiento guardado. Falta guardar el reporte.';
      }
      void goto(withParams(page.url, { corregido: null }), { replaceState: true, noScroll: true, keepFocus: true });
    });
  });

  // El lanzamiento del reporte abierto, una vez por lanzamiento.
  $effect(() => {
    const id = selected?.release_id;
    if (!id || !catalogAvailable) return;
    untrack(() => {
      if (!releases[id]) void readRelease(id);
    });
  });

  async function readRelease(id: string) {
    releases[id] = { state: 'loading' };
    try {
      names ??= dictionaries();
      const [release, dictionary] = await Promise.all([getCatalogRelease(id), names]);
      const artists = release.artist_ids.length ? await getArtistsByIds(release.artist_ids) : [];
      const byId = new Map(artists.map((artist) => [artist.id, artist.name]));
      releases[id] = { state: 'ok', release, artists: release.artist_ids.map((artist) => byId.get(artist)).filter(Boolean).join(', ') };
      typeNames = dictionary.types;
      labelNames = dictionary.labels;
      countryNames = dictionary.countries;
    } catch {
      names = null;
      releases[id] = { state: 'error' };
    }
  }

  let typeNames = $state<DictionaryEntry[]>([]);
  let labelNames = $state<DictionaryEntry[]>([]);
  let countryNames = $state<DictionaryEntry[]>([]);
  const nameIn = (entries: DictionaryEntry[], id: string | null) => entries.find((entry) => entry.id === id)?.name ?? '—';

  const category = (value: string) => REPORT_CATEGORIES.find((item) => item[0] === value)?.[1] ?? 'Reporte';
  const date = (value: string) => dateFormat.format(new Date(value)).replace(/ de /g, ' ');
  /** La ruta de la página, sin el origen (los reportes antiguos guardaban la URL completa). */
  const route = (value: string) => {
    try {
      const url = new URL(value, 'https://discotica.invalid');
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  };
  /** Otros reportes de la misma persona. */
  const othersBy = (report: ProblemReport) => reports.filter((entry) => entry.author_id === report.author_id && entry.id !== report.id).length;
  const assigneeOptions = (report: ProblemReport) => [
    { value: '', label: 'Sin asignar' },
    { value: userId, label: 'A mí' },
    ...(report.assigned_to && report.assigned_to !== userId ? [{ value: report.assigned_to, label: 'Otra persona del equipo' }] : [])
  ];
  // Como en E18, guardar asigna a quien clasifica salvo que elija otra cosa.
  const assignee = (report: ProblemReport) => reportAssignees[report.id] ?? report.assigned_to ?? userId;

  async function save(report: ProblemReport) {
    // Si pasa a "Cerrados", sigue abierto en el detalle.
    await selection.pin(report.id);
    busy = report.id;
    actionError = '';
    flash = '';
    try {
      const updated = await updateProblemReport(report.id, reportStates[report.id] ?? report.status, assignee(report) || null, reportNotes[report.id] ?? '');
      reports = reports.map((entry) => (entry.id === updated.id ? updated : entry));
      delete reportStates[report.id];
      delete reportNotes[report.id];
      delete reportAssignees[report.id];
      flash = `Reporte actualizado: ${reportStatusLabel(updated.status)}.`;
      studio.refreshCounts();
    } catch (cause: any) {
      actionError = cause?.message || 'No se pudo actualizar el reporte.';
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head><title>Reportes · Estudio — Discótica</title></svelte:head>

<ToolHeader title="Reportes" count={loaded && !loadError ? `${openCount} ${openCount === 1 ? 'abierto' : 'abiertos'}` : undefined}>
  {#snippet actions()}
    {#if releaseFilter || authorFilter}
      <Button size="sm" variant="secondary" href={studioReportsHref()}>Ver todos</Button>
      {#if releaseFilter && catalogAvailable}<Button size="sm" variant="secondary" href={studioReleaseHref(releaseFilter)}>Abrir el lanzamiento</Button>{/if}
    {/if}
  {/snippet}
</ToolHeader>

{#if flash}<Notice tone="success" class="reportes__notice">{flash}</Notice>{/if}

{#if !loaded}
  <div class="reportes__loading"><LoadingIndicator label="Cargando reportes" /></div>
{:else if loadError}
  <ErrorState size="inline" message="No se pudieron cargar los reportes." detail={loadError} onaction={load} />
{:else}
  <InboxLayout
    label={releaseFilter ? 'Reportes de este lanzamiento' : authorFilter ? 'Reportes de esta persona' : 'Reportes'}
    {groups}
    key={(report) => report.id}
    open={!!selected}
    backLabel="Volver a los reportes"
    onback={() => selection.back(selectedId)}
  >
    {#snippet item(report: ProblemReport)}
      <InboxItem
        href={selection.href(report.id)}
        title={report.description}
        current={report.id === selectedId}
        dot={{ label: reportStatusLabel(report.status), tone: REPORT_STATUS_TONES[report.status] }}
        dotPlacement="start"
        meta={[SHORT_CATEGORIES[report.category] ?? 'Reporte', relativeInboxDate(report.created_at)]}
        onselect={() => selection.select(report.id)}
        data-inbox-item={report.id}
      />
    {/snippet}

    {#snippet detail()}
      {#if selected}
        {@render Detail(selected)}
      {:else}
        <EmptyState
          size="inline"
          icon="bandeja"
          message={ids.length ? 'Elige un reporte de la lista.' : releaseFilter ? 'Este lanzamiento no tiene reportes.' : 'Sin reportes'}
        />
      {/if}
    {/snippet}
  </InboxLayout>
{/if}

{#snippet Detail(report: ProblemReport)}
  {@const context = reportContextRows(report.technical_context)}
  {@const others = othersBy(report)}
  {@const fixable = !!report.release_id && catalogAvailable}
  <InboxDetail title={report.description} bind:heading={selection.heading} class="reporte">
    {#snippet eyebrow()}
      <StatusDot label={reportStatusLabel(report.status)} tone={REPORT_STATUS_TONES[report.status]} />
      <span class="reporte__part">{category(report.category)}</span>
      <span class="reporte__part">{date(report.created_at)}</span>
    {/snippet}
    {#snippet meta()}
      <ul class="reporte__facts" aria-label="Datos del reporte">
        <li title="Página desde la que se reportó">
          <Icon name="enlace" size="sm" /><a class="reporte__route" href={route(report.page_url)}>{route(report.page_url)}</a>
        </li>
        <li title={report.screenshot_path ? 'Privada: solo la ve administración.' : undefined}>
          <Icon name={report.screenshot_path ? 'imagen' : 'imagen-off'} size="sm" />{report.screenshot_path ? 'Captura adjunta' : 'Sin captura'}
        </li>
        <li title="Quien reporta">
          <Icon name="persona" size="sm" />
          {#if others}
            <a href={withParams(page.url, { autor: report.author_id, reporte: null, lanzamiento: null })}>{others} {others === 1 ? 'reporte más' : 'reportes más'}</a>
          {:else}
            <span>Su único reporte</span>
          {/if}
        </li>
      </ul>
    {/snippet}

    {#if fixable && report.release_id}
      {@render Release(report, report.release_id)}
    {/if}

    <div class="reporte__fields">
      <Select
        label="Estado"
        options={STATUS_OPTIONS}
        value={reportStates[report.id] ?? report.status}
        onchange={(value) => (reportStates[report.id] = value as ProblemReport['status'])}
      />
      <Select
        label="Asignado"
        options={assigneeOptions(report)}
        value={assignee(report)}
        onchange={(value) => (reportAssignees[report.id] = value)}
      />
      <Textarea
        class="reporte__note"
        label="Nota interna"
        placeholder="Solo la ve el equipo"
        title={NOTE_RULE}
        rows={3}
        bind:value={() => reportNotes[report.id] ?? '', (value) => (reportNotes[report.id] = value)}
      />
    </div>

    {#if context.length}
      <details class="reportes__context">
        <summary>Contexto técnico</summary>
        <dl class="l-inbox-fields">
          {#each context as row (row.label)}<InboxField label={row.label} value={row.value} wide={row.label === 'Navegador'} />{/each}
        </dl>
      </details>
    {/if}

    {#snippet actions()}
      {#if actionError}<Notice tone="error">{actionError}</Notice>{/if}
      <div class="l-inbox-buttons reporte__buttons">
        <Button variant={fixable ? 'secondary' : 'primary'} onclick={() => save(report)} loading={busy === report.id} disabled={busy === report.id}>Guardar</Button>
      </div>
    {/snippet}
  </InboxDetail>
{/snippet}

{#snippet Release(report: ProblemReport, releaseId: string)}
  {@const info = releases[releaseId]}
  <section class="reporte__release" aria-label="Lanzamiento reportado">
    {#if info?.state === 'ok'}
      {@const release = info.release}
      <Cover class="reporte__cover" src={release.cover_url} alt="" radius="sm" />
      <div class="reporte__release-text">
        <p class="reporte__release-title"><strong>{release.title || 'Sin título'}</strong>{#if info.artists}<span>{info.artists}</span>{/if}</p>
        <dl class="reporte__release-facts">
          <div><dt>Tipo</dt><dd>{nameIn(typeNames, release.release_type_id)}</dd></div>
          <div><dt>País</dt><dd>{release.country_ids.map((id) => nameIn(countryNames, id)).join(', ') || '—'}</dd></div>
          <div><dt>Sello</dt><dd>{nameIn(labelNames, release.label_id)}</dd></div>
          <div><dt class="sr-only">Estado</dt><dd><StatusDot label={RELEASE_STATUS[release.status].label} tone={RELEASE_STATUS[release.status].tone} /></dd></div>
        </dl>
      </div>
    {:else if info?.state === 'error'}
      <p class="reporte__release-missing">No se pudo leer el lanzamiento.</p>
    {:else}
      <LoadingIndicator label="Cargando el lanzamiento" />
    {/if}
    <div class="reporte__release-actions">
      {#if info?.state === 'ok' && info.release.status === 'published'}
        <IconButton icon="flecha-externa" label="Ver la ficha pública" href={`/lanzamiento/${info.release.slug}`} />
      {/if}
      <Button
        icon="editar"
        href={studioReleaseHref(releaseId, report.id)}
        title="Abre el lanzamiento en el editor; al guardar vuelves aquí con «Resuelto» elegido."
      >Corregir lanzamiento</Button>
    </div>
  </section>
{/snippet}

<style>
  :global(.reportes__notice) { margin-bottom: var(--density-pad); }
  .reportes__loading { display: grid; place-items: center; min-height: 16rem; }

  /* Estado · tipo · fecha: el punto va con lo que sigue, así al partir la línea no queda suelto. */
  .reporte__part { white-space: nowrap; }
  .reporte__part::before { content: '·'; margin-right: var(--space-3); }

  /* Página, captura y quién reporta, en una fila de iconos. */
  .reporte__facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-5);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-texto-medio);
  }
  .reporte__facts li { display: inline-flex; align-items: center; gap: var(--space-2); min-width: 0; }
  .reporte__facts a { color: var(--color-acento); font-weight: 600; }
  .reporte__route { min-width: 0; overflow-wrap: anywhere; }

  /* El lanzamiento como bloque de acción: portada, datos y «Corregir lanzamiento». */
  .reporte__release {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
  }
  .reporte__release :global(.reporte__cover) {
    flex: 0 0 var(--tool-release-thumb);
    width: var(--tool-release-thumb);
    height: var(--tool-release-thumb);
  }
  .reporte__release-text { display: flex; flex: 1 1 10rem; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .reporte__release-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-2); margin: 0; }
  .reporte__release-title strong { color: var(--color-texto); font-size: var(--text-base); overflow-wrap: anywhere; }
  .reporte__release-title span { color: var(--color-texto-medio); font-size: var(--text-sm); }
  .reporte__release-facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-5);
    margin: 0;
    font-size: var(--text-2xs);
  }
  .reporte__release-facts div { display: inline-flex; align-items: center; gap: var(--space-2); }
  .reporte__release-facts dt { color: var(--color-texto-tenue); }
  .reporte__release-facts dd { margin: 0; color: var(--color-texto); }
  .reporte__release-missing { flex: 1 1 16rem; margin: 0; color: var(--color-texto-tenue); font-size: var(--text-sm); }
  .reporte__release-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }

  /* Estado y Asignado en dos columnas; la nota interna a todo el ancho. */
  .reporte__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--tool-gap-row) var(--tool-gap-col);
  }
  .reporte__fields :global(.reporte__note) { grid-column: 1 / -1; }

  .reporte__buttons { justify-content: flex-end; }

  .reportes__context summary {
    display: flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-size: var(--density-text);
    font-weight: 650;
    cursor: pointer;
  }
  .reportes__context[open] summary { margin-bottom: var(--space-3); }

  @media (max-width: 479px) {
    .reporte__fields { grid-template-columns: minmax(0, 1fr); }
    .reporte__release-actions { flex: 1 1 100%; }
    .reporte__release-actions :global(.ui-button) { flex: 1 1 auto; }
  }
</style>
