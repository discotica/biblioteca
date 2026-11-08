<script lang="ts">
  import type { Snippet } from 'svelte';
  import RadarPips from '$lib/components/RadarPips.svelte';
  import RadarVisual from '$lib/components/RadarVisual.svelte';
  import { normalizeSearch } from '$lib/ui/combobox';
  import EditorCredits from './EditorCredits.svelte';
  import { SimilarEntries } from './similarEntries.svelte';
  import { RADAR_AXES, completeRadar } from '$lib/domain/contributionContract';
  import { INDEPENDENT_LABEL } from '$lib/domain/suggestFlow';
  import {
    editorSectionAnchor,
    inferProvider,
    isPendingId,
    missingBySection,
    missingFields,
    pendingId,
    pendingName,
    primaryLink,
    withPrimaryLink,
    type EditorSection,
    type EditorSectionId
  } from '$lib/domain/releaseEditor';
  import { Button, Combobox, Cover, Field, Icon, IconButton, Notice, Select, type ComboboxOption } from '$lib/ui';
  import type { Artist, CatalogSnapshot, DictionaryEntry } from '$lib/services/adminCatalog';

  // Formulario del editor del Estudio (U16), compartido desde U19 por el editor del catálogo y el de
  // propuestas. U22 (tablero 7 del rediseño): una página sin tarjetas, con la etiqueta de cada
  // sección en el margen; sin índice (D1); lo que falta para publicar, en la cabecera; la reseña
  // fuera de la interfaz (el campo `review` viaja en el payload tal como llegó, nunca se escribe);
  // y la barra fija con el resumen de cambios, la observación y las acciones. Quien lo usa pone la
  // línea de estado, los iconos de la cabecera, las acciones y, si hace falta, una última sección.

  type Feedback = { tone: 'error' | 'success'; text: string } | null;

  type Props = {
    release: CatalogSnapshot;
    labels: DictionaryEntry[];
    genres: DictionaryEntry[];
    countries: DictionaryEntry[];
    types: DictionaryEntry[];
    /** Nombres de artistas conocidos, compartidos con la lista. */
    artists: Artist[];
    /**
     * Las secciones de la página, con su nombre. Si la última no es del formulario (Propuesta),
     * se pinta con `tail`.
     */
    sections: ReadonlyArray<EditorSection>;
    backLabel: string;
    onclose: () => void;
    /** Cuándo se crea un artista o sello nuevo: «al guardar» (catálogo) o «al aceptar» (propuesta). */
    createdWhen: string;
    titleError?: string;
    /** Portada en solo lectura, con el porqué (el colaborador no la cambia). */
    lockedNote?: string;
    technical?: boolean;
    /** Lo que va antes de los artistas en la línea bajo el título (estado y versión). */
    status?: Snippet;
    /** Iconos de la cabecera, a la derecha (fuente, historial, más acciones). */
    meta?: Snippet;
    /** Avisos sobre lo que se abrió, encima de las secciones. */
    intro?: Snippet;
    tail?: Snippet;
    feedback: Feedback;
    /**
     * Campos cambiados desde la última carga o guardado, con su nombre. Con ellos la barra dice
     * «n cambios · campos»; sin ellos, `statusText`.
     */
    changes?: string[];
    /** Texto de la barra cuando no hay aviso ni `changes`, y si es «sin cambios» (en móvil se oculta). */
    statusText?: string;
    clean: boolean;
    note?: string;
    /** Sin etiqueta, la barra no lleva campo de nota (propuestas, U23: la nota va en el diálogo de cada decisión). */
    noteLabel?: string;
    notePlaceholder?: string;
    noteRequired?: boolean;
    noteElement?: HTMLInputElement;
    onnoteenter?: () => void;
    actions: Snippet;
    /** Las acciones en su propia fila, debajo de la nota (cuando son muchas). */
    stackActions?: boolean;
    onmessage?: (text: string) => void;
    /**
     * Nombres de View Transition para la portada y el título (U23): el resumen de la bandeja usa
     * los mismos, así la cabecera no salta al pasar del uno al otro.
     */
    transition?: boolean;
  };

  let {
    release = $bindable(),
    labels = $bindable(),
    genres,
    countries,
    types,
    artists = $bindable(),
    sections,
    backLabel,
    onclose,
    createdWhen,
    titleError = $bindable(''),
    lockedNote = '',
    technical = false,
    status,
    meta,
    intro,
    tail,
    feedback,
    changes,
    statusText = '',
    clean,
    note = $bindable(''),
    noteLabel = '',
    notePlaceholder = '',
    noteRequired = false,
    noteElement = $bindable(),
    onnoteenter,
    actions,
    stackActions = false,
    onmessage,
    transition = false
  }: Props = $props();

  const FORM_IDS: ReadonlyArray<EditorSectionId> = ['datos', 'creditos', 'clasificacion', 'medios'];

  const labelSimilar = new SimilarEntries('labels');
  let techOpen = $state(false);

  const sectionName = (id: EditorSectionId) => sections.find((section) => section.id === id)?.label ?? id;
  const tailSection = $derived.by(() => {
    const last = sections[sections.length - 1];
    return last && !FORM_IDS.includes(last.id) ? last : null;
  });
  const missing = $derived(missingFields(release));
  const missingIn = $derived(missingBySection(release));
  const nameOf = (id: string) => (isPendingId(id) ? pendingName(id) : artists.find((artist) => artist.id === id)?.name ?? 'Artista sin resolver');
  const artistLine = $derived(release.artist_ids.map(nameOf).join(', '));
  const link = $derived(primaryLink(release));
  const extraLinks = $derived(release.links.filter((entry) => !entry.is_primary).length);
  const typeOptions = $derived([{ value: '', label: 'Selecciona un tipo' }, ...types.map((type) => ({ value: type.id, label: type.name }))]);
  // U19: géneros y países son listas cerradas. Se ofrecen los seleccionables; uno de legado que el
  // lanzamiento ya tiene se conserva y se puede quitar, pero no añadir.
  const offered = (entries: DictionaryEntry[], chosen: string[]) =>
    entries
      .filter((entry) => !entry.status || entry.status === 'selectable' || chosen.includes(entry.id))
      .map((entry) => ({ value: entry.id, label: entry.name, ...(entry.status && entry.status !== 'selectable' ? { hint: 'Fuera de la lista' } : {}) }));
  const genreOptions = $derived(offered(genres, release.genre_ids));
  const countryOptions = $derived(offered(countries, release.country_ids));
  const newHint = $derived(`Nuevo · se crea ${createdWhen}`);
  const newRule = $derived(`No está en el catálogo: se crea ${createdWhen}.`);
  const independent = $derived(labels.find((label) => normalizeSearch(label.name) === normalizeSearch(INDEPENDENT_LABEL)) ?? null);
  // «Independiente» fijo arriba, también si todavía no existe (se crearía como cualquier sello nuevo).
  const labelOptions = $derived.by<ComboboxOption[]>(() => {
    const pinned = independent ? { value: independent.id, label: independent.name } : { value: pendingId(INDEPENDENT_LABEL), label: INDEPENDENT_LABEL, hint: newHint };
    const pending = isPendingId(release.label_id) && release.label_id !== pinned.value ? [{ value: release.label_id, label: pendingName(release.label_id), hint: newHint }] : [];
    return [pinned, ...pending, ...labels.filter((label) => label.id !== independent?.id).map((label) => ({ value: label.id, label: label.name }))];
  });
  const pendingLabel = $derived(isPendingId(release.label_id) ? pendingName(release.label_id) : '');
  const hasRadar = $derived(!!completeRadar(release.radar));

  // «Falta portada» con un pendiente; «Faltan 3» con varios. La lista completa, en el tooltip.
  const missingTip = $derived(`Para publicar falta: ${missing.join(', ')}.`);
  const missingMark = $derived(missing.length === 1 ? `Falta ${missing[0].toLowerCase()}` : `Faltan ${missing.length}`);

  const changeCount = $derived(changes?.length ?? 0);

  function createLabel(text: string): ComboboxOption {
    const name = text.replace(/\s+/g, ' ').trim();
    labelSimilar.check(name);
    return { value: pendingId(name), label: name };
  }

  function useLabel(entry: DictionaryEntry) {
    if (!labels.some((label) => label.id === entry.id)) labels = [...labels, entry].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    release.label_id = entry.id;
  }

  const addRadar = () => (release.radar = Object.fromEntries(RADAR_AXES.map((axis) => [axis, 0])));
  // Sin radar el payload lleva {} y el servidor lo borra (U19, admin_update_catalog_release).
  const removeRadar = () => (release.radar = {});

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
      : 'Sin fecha';
</script>

{#snippet sectionLabel(id: EditorSectionId, label: string)}
  <div class="editor__label">
    <h2 id="editor-h-{id}" tabindex="-1">{label}</h2>
    {#if missingIn[id]?.length}
      <span class="editor__label-flag" title={`Falta: ${missingIn[id].join(', ')}`}><span class="sr-only">Falta: {missingIn[id].join(', ')}</span></span>
    {/if}
  </div>
{/snippet}

<div class="editor">
  <header class="editor__head">
    <IconButton icon="flecha-izquierda" label={backLabel} variant="secondary" tooltip="bottom" tooltipAlign="start" onclick={onclose} />
    <span class="editor__thumb" style={transition ? 'view-transition-name: proposal-cover' : undefined}><Cover src={release.cover_url} alt="" radius="sm" loading="eager" /></span>
    <div class="editor__identity">
      <h1 class="editor__title" title={release.title || undefined} style={transition ? 'view-transition-name: proposal-title' : undefined}>{release.title || 'Sin título'}</h1>
      <p class="editor__line">
        {#if status}{@render status()}<span class="editor__sep" aria-hidden="true">·</span>{/if}
        <span class="editor__artists" title={artistLine || undefined}>{artistLine || 'Añade un artista principal'}</span>
      </p>
    </div>
    <div class="editor__meta">
      {#if missing.length}
        <span class="editor__readiness" title={missingTip}>
          <Icon name={missing.length === 1 && missing[0] === 'Portada' ? 'imagen-off' : 'aviso'} size="sm" />
          <span aria-hidden="true">{missingMark}</span><span class="sr-only">{missingTip}</span>
        </span>
      {:else}
        <span class="editor__readiness editor__readiness--ok"><Icon name="check" size="sm" />Lista para publicar</span>
      {/if}
      {#if meta}{@render meta()}{/if}
    </div>
  </header>

  <div class="editor__body">
    {#if intro}{@render intro()}{/if}

    <section class="editor__section" id={editorSectionAnchor('datos')} data-section="datos" aria-labelledby="editor-h-datos">
      {@render sectionLabel('datos', sectionName('datos'))}
      <div class="editor__content">
        <div class="editor__row editor__row--data">
          <Field
            label="Título"
            required
            value={release.title}
            error={titleError}
            placeholder="Título del lanzamiento"
            oninput={(event: Event) => {
              release.title = (event.currentTarget as HTMLInputElement).value;
              if (release.title.trim()) titleError = '';
            }}
          />
          <Select label="Tipo" options={typeOptions} value={release.release_type_id ?? ''} onchange={(value) => (release.release_type_id = value || null)} />
          <Field
            label="Fecha"
            type="date"
            value={release.release_date ?? ''}
            oninput={(event: Event) => (release.release_date = (event.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="editor__row editor__row--pair">
          <div class="editor__stack editor__label-field">
            <Combobox
              label="Sello"
              single
              options={labelOptions}
              value={release.label_id ? [release.label_id] : []}
              onchange={(next) => (release.label_id = next[0] ?? null)}
              allowCreate
              createLabel={(text) => `Añadir «${text}» como sello nuevo`}
              oncreate={createLabel}
              placeholder="Busca un sello o escribe uno nuevo"
              removeLabel={(text) => `Quitar sello ${text}`}
            />
            {#if pendingLabel}
              <span class="editor__new editor__new--label" title={newRule}>Nuevo<span class="sr-only">: «{pendingLabel}» se crea {createdWhen}</span></span>
            {/if}
            {#if pendingLabel && labelSimilar.of(pendingLabel).length}
              <Notice class="editor__similar" title={`«${pendingLabel}» no está en el catálogo y se creará como nuevo.`}>
                Hay nombres parecidos. Si es el mismo, usa el que ya existe.
                {#snippet actions()}
                  {#each labelSimilar.of(pendingLabel) as other (other.id)}
                    <Button variant="link" size="sm" onclick={() => useLabel(other)}>Usar «{other.name}»</Button>
                  {/each}
                {/snippet}
              </Notice>
            {/if}
          </div>
          {#if technical && release.id}
            <div class="editor__tech-toggle">
              <button type="button" class="editor__more" aria-expanded={techOpen} aria-controls="editor-tech" onclick={() => (techOpen = !techOpen)}>
                <span class="editor__more-icon" aria-hidden="true"><Icon name="agregar" size="sm" /></span>Datos técnicos
              </button>
            </div>
          {/if}
        </div>
        {#if technical && release.id && techOpen}
          <dl class="editor__tech" id="editor-tech">
            <dt>ID</dt><dd>{release.id}</dd>
            <dt>Identificador</dt><dd>{release.slug}</dd>
            <dt>Última edición</dt><dd>{formatDate(release.updated_at)}</dd>
          </dl>
        {/if}
      </div>
    </section>

    <section class="editor__section" id={editorSectionAnchor('creditos')} data-section="creditos" aria-labelledby="editor-h-creditos">
      {@render sectionLabel('creditos', sectionName('creditos'))}
      <div class="editor__content">
        <EditorCredits bind:release bind:artists {createdWhen} {onmessage} />
      </div>
    </section>

    <section class="editor__section" id={editorSectionAnchor('clasificacion')} data-section="clasificacion" aria-labelledby="editor-h-clasificacion">
      {@render sectionLabel('clasificacion', sectionName('clasificacion'))}
      <div class="editor__content">
        <div class="editor__row editor__row--pair">
          <Combobox
            label="Géneros"
            options={genreOptions}
            bind:value={release.genre_ids}
            placeholder="Selecciona uno o más valores"
            removeLabel={(text) => `Quitar género ${text}`}
          />
          <Combobox
            label="Países"
            options={countryOptions}
            bind:value={release.country_ids}
            placeholder="Selecciona uno o más valores"
            removeLabel={(text) => `Quitar país ${text}`}
          />
        </div>
        {#if hasRadar}
          <div class="editor__radar" role="group" aria-labelledby="editor-radar-title">
            <div class="editor__radar-head">
              <span class="editor__field-label" id="editor-radar-title">Radar</span>
              <IconButton size="sm" icon="cerrar" label="Quitar radar" onclick={removeRadar} />
            </div>
            <div class="editor__radar-box">
              <RadarPips bind:value={release.radar} spine={false} />
              <div class="editor__radar-chart" aria-hidden="true"><RadarVisual valores={release.radar} /></div>
            </div>
          </div>
        {:else}
          <div class="editor__more-row">
            <button type="button" class="editor__more" onclick={addRadar}>
              <span class="editor__more-icon" aria-hidden="true"><Icon name="agregar" size="sm" /></span>Radar
            </button>
          </div>
        {/if}
      </div>
    </section>

    <section class="editor__section" id={editorSectionAnchor('medios')} data-section="medios" aria-labelledby="editor-h-medios">
      {@render sectionLabel('medios', sectionName('medios'))}
      <div class="editor__content editor__media">
        <Cover class="editor__cover" src={release.cover_url} alt={release.cover_url ? `Portada de ${release.title || 'lanzamiento'}` : ''} radius="sm" />
        <div class="editor__media-fields">
          <Field
            label={link?.url ? `Compra o escucha · ${inferProvider(link.url)}` : 'Compra o escucha'}
            type="url"
            value={link?.url ?? ''}
            placeholder="https://bandcamp.com/…"
            oninput={(event: Event) => (release.links = withPrimaryLink(release.links, (event.currentTarget as HTMLInputElement).value))}
          />
          <Field
            label="Portada · URL HTTPS"
            type="url"
            value={release.cover_url ?? ''}
            readonly={!!lockedNote}
            oninput={(event: Event) => (release.cover_url = (event.currentTarget as HTMLInputElement).value)}
            placeholder="https://…"
            hint={lockedNote || undefined}
          />
          {#if extraLinks}<p class="editor__extra">{extraLinks === 1 ? 'Hay 1 enlace adicional' : `Hay ${extraLinks} enlaces adicionales`}; se conservan al guardar.</p>{/if}
        </div>
      </div>
    </section>

    {#if tailSection && tail}
      <section class="editor__section" id={editorSectionAnchor(tailSection.id)} data-section={tailSection.id} aria-labelledby="editor-h-{tailSection.id}">
        {@render sectionLabel(tailSection.id, tailSection.label)}
        <div class="editor__content">{@render tail()}</div>
      </section>
    {/if}

    <div class="editor__bar" role="region" aria-label="Guardar">
      <div class="editor__bar-row" class:editor__bar-row--stacked={stackActions} class:editor__bar-row--no-note={!noteLabel}>
        <div class="editor__bar-status" aria-live="polite">
          {#if feedback}
            <p class="editor__feedback editor__feedback--{feedback.tone}" role={feedback.tone === 'error' ? 'alert' : 'status'} title={feedback.text}>{feedback.text}</p>
          {:else if changes}
            <p class="editor__dirty" class:editor__dirty--clean={clean} title={changeCount ? changes.join(', ') : undefined}>
              {#if !clean && changeCount}<strong>{changeCount === 1 ? '1 cambio' : `${changeCount} cambios`}</strong> · {changes.join(', ').toLowerCase()}{:else if clean}Sin cambios{:else}Cambios sin guardar{/if}
            </p>
          {:else}
            <p class="editor__dirty" class:editor__dirty--clean={clean}>{statusText}</p>
          {/if}
        </div>
        {#if noteLabel}<Field
          class="editor__note"
          label={noteLabel}
          hideLabel
          required={noteRequired}
          bind:value={note}
          bind:element={noteElement}
          placeholder={notePlaceholder}
          autocomplete="off"
          onkeydown={(event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); onnoteenter?.(); } }}
        />{/if}
        <div class="editor__bar-actions">{@render actions()}</div>
      </div>
    </div>
  </div>
</div>

<style>
  .editor { color: var(--color-texto); }

  /* ---- Cabecera -------------------------------------------------------- */
  .editor__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    padding-bottom: var(--tool-gap-header);
    border-bottom: 1px solid var(--color-linea);
  }
  .editor__thumb {
    display: block;
    flex: 0 0 var(--tool-editor-thumb);
    width: var(--tool-editor-thumb);
    height: var(--tool-editor-thumb);
  }
  .editor__identity { display: flex; flex: 1 1 16rem; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .editor__title {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto);
    font-size: var(--text-xl);
    font-weight: 800;
    line-height: var(--leading-heading);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .editor__line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-2xs);
  }
  /* Solo los artistas se recortan: el estado y la versión se leen enteros. */
  .editor__line :global(.ui-status) { flex: none; color: var(--color-texto-medio); }
  .editor__sep { color: var(--color-texto-tenue); }
  .editor__artists { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .editor__meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }

  /* Marca de publicación: ámbar si falta algo (la lista, en el tooltip); verde tenue si está lista. */
  .editor__readiness {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--space-5);
    margin-right: var(--space-2);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-aviso-dim);
    color: var(--color-aviso);
    font-size: var(--text-2xs);
    font-weight: 600;
    white-space: nowrap;
    cursor: default;
  }
  .editor__readiness--ok { background: var(--color-acento-tinte); color: var(--color-acento); }

  /* ---- Secciones: etiqueta en el margen, línea fina entre ellas -------- */
  .editor__body { display: flex; flex-direction: column; min-width: 0; }

  .editor__section {
    display: grid;
    grid-template-columns: var(--tool-editor-label) minmax(0, 1fr);
    gap: var(--tool-gap-col);
    padding-block: var(--tool-pad-section);
    border-bottom: 1px solid var(--color-linea-sutil);
    /* El alto del header lo reserva el scroll-padding de html (U18). */
    scroll-margin-top: var(--space-5);
  }
  .editor__label {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    /* Alineada con el primer control: la altura de una etiqueta de campo y su separación. */
    padding-top: calc(var(--density-label) * 1.5 + var(--tool-gap-label));
  }
  .editor__label h2 { margin: 0; color: var(--color-texto-medio); font-size: var(--text-xs); font-weight: 700; }
  .editor__label h2:focus { outline: none; }
  .editor__label-flag {
    flex: none;
    width: calc(var(--icon-sm) / 2);
    height: calc(var(--icon-sm) / 2);
    border-radius: var(--radius-pill);
    background: var(--color-aviso);
    cursor: default;
  }
  .editor__content { display: flex; flex-direction: column; gap: var(--tool-gap-row); min-width: 0; }

  .editor__row { display: grid; gap: var(--tool-gap-row) var(--tool-gap-col); align-items: start; }
  .editor__row--data { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(var(--tool-date-min), 1fr); }
  .editor__row--pair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .editor__stack { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }

  .editor__field-label { color: var(--color-texto-medio); font-size: var(--density-label); font-weight: 600; }

  /* «Nuevo»: la regla completa va en el tooltip. */
  .editor__label-field { position: relative; }
  .editor__new {
    color: var(--color-aviso);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
    white-space: nowrap;
    cursor: default;
  }
  .editor__new--label { position: absolute; top: 0; right: 0; line-height: 1.5; }

  /* «+ Datos técnicos» y «+ Radar»: se despliegan en el sitio. */
  .editor__tech-toggle { display: flex; align-items: flex-end; align-self: stretch; }
  .editor__more {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-texto-medio);
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
  }
  .editor__tech-toggle .editor__more { margin-bottom: calc((var(--density-control-h) - var(--target-touch)) / 2); }
  .editor__more:hover { color: var(--color-texto); }
  .editor__more:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; border-radius: var(--radius-xs); }
  .editor__more-icon { display: flex; color: var(--color-acento); transition: transform var(--motion-fast) var(--ease-standard); }
  .editor__more[aria-expanded='true'] .editor__more-icon { transform: rotate(45deg); }
  .editor__more-row { display: flex; }
  .editor__tech {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-1) var(--space-3);
    margin: 0;
    font-size: var(--text-2xs);
  }
  .editor__tech dt { color: var(--color-texto-tenue); }
  .editor__tech dd { margin: 0; overflow-wrap: anywhere; color: var(--color-texto-alto); font-variant-numeric: tabular-nums; }

  /* ---- Radar: los puntos de la búsqueda y el pentágono al lado --------- */
  .editor__radar { display: flex; flex-direction: column; gap: var(--tool-gap-label); }
  .editor__radar-head { display: flex; align-items: center; gap: var(--tool-gap-remove); min-height: var(--control-h-sm); }
  .editor__radar-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-5) var(--tool-pad-section);
    width: fit-content;
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--space-4) var(--tool-pad-panel-x);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
  }
  /* Las letras del pentágono salen del dibujo: margen para que no se corten. */
  .editor__radar-chart { width: var(--tool-editor-radar); }
  .editor__radar-chart :global(svg) { overflow: visible; }

  /* ---- Medios ----------------------------------------------------------- */
  .editor__media { display: grid; grid-template-columns: var(--tool-cover) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
  .editor__media :global(.editor__cover) { width: var(--tool-cover); height: var(--tool-cover); }
  .editor__media-fields { display: flex; flex-direction: column; gap: var(--tool-gap-row); min-width: 0; }
  .editor__extra { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* ---- Barra de guardar: fija abajo, una línea -------------------------- */
  .editor__bar {
    position: sticky;
    bottom: 0;
    z-index: var(--layer-sticky);
    padding: var(--space-3) 0 calc(var(--space-3) + var(--safe-area-bottom));
    border-top: 1px solid var(--color-linea);
    background: var(--color-fondo);
  }
  .editor__bar-row { display: flex; align-items: center; gap: var(--space-3); }
  .editor__bar-status { flex: 0 1 auto; min-width: 0; max-width: 40%; }
  .editor__bar-status p {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto-medio);
    font-size: var(--text-2xs);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .editor__dirty strong { color: var(--color-texto); font-weight: 700; }
  .editor__bar-status .editor__feedback--error { color: var(--color-danger-texto); font-weight: 600; }
  .editor__bar-status .editor__feedback--success { color: var(--color-acento); }
  .editor__bar-row :global(.editor__note) { flex: 1 1 20rem; min-width: 0; }
  .editor__bar-actions { display: flex; align-items: center; gap: var(--space-2); }
  /* Sin nota (propuestas): el estado ocupa el hueco y las acciones van a la derecha. */
  .editor__bar-row--no-note .editor__bar-status { flex: 1 1 auto; max-width: none; }
  /* Muchas acciones (propuesta como admin): debajo de la nota, en dos grupos. */
  .editor__bar-row--stacked { flex-wrap: wrap; }
  .editor__bar-row--stacked .editor__bar-actions { flex: 1 1 100%; flex-wrap: wrap; justify-content: space-between; }
  .editor__bar-actions :global(.editor__bar-group) { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  /* ---- Tablet ------------------------------------------------------------ */
  @media (max-width: 1023px) {
    .editor__row--data { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .editor__row--data > :global(:first-child) { grid-column: 1 / -1; }
  }

  /* ---- Móvil: una columna; la etiqueta de la sección va encima ------------ */
  @media (max-width: 767px) {
    /* Título junto a la portada; la marca y los iconos, en la fila de abajo. */
    .editor__identity { flex-basis: 10rem; }
    .editor__meta { flex-basis: 100%; justify-content: flex-start; }
    .editor__section { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); padding-block: var(--tool-gap-row); }
    .editor__label { padding-top: 0; }
    .editor__row--data,
    .editor__row--pair { grid-template-columns: minmax(0, 1fr); }
    .editor__tech-toggle { align-self: auto; }
    .editor__tech-toggle .editor__more { margin-bottom: 0; }
    .editor__radar-box { width: 100%; justify-content: space-between; padding-inline: var(--space-4); }
    .editor__media { grid-template-columns: minmax(0, 1fr); }
    .editor__bar {
      margin-inline: calc(-1 * var(--container-gutter));
      padding-inline: var(--container-gutter);
    }
    .editor__bar-status:has(.editor__dirty--clean) { display: none; }
    .editor__bar-status { max-width: none; }
    .editor__bar-row { flex-direction: column; align-items: stretch; gap: var(--space-2); }
    .editor__bar-row :global(.editor__note) { flex: none; }
    /* Dos acciones largas (colaborador) no caben en una fila de 390: bajan de línea. */
    .editor__bar-actions { flex-wrap: wrap; }
    .editor__bar-actions > :global(*) { flex: 1 1 auto; }
    .editor__bar-actions :global(.editor__bar-group > *) { flex: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .editor__more-icon { transition: none; }
  }
</style>
