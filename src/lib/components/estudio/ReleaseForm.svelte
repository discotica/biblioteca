<script lang="ts">
  import type { Snippet } from 'svelte';
  import RadarControls from '$lib/components/RadarControls.svelte';
  import { normalizeSearch } from '$lib/ui/combobox';
  import EditorCredits from './EditorCredits.svelte';
  import { SimilarEntries } from './similarEntries.svelte';
  import { completeRadar } from '$lib/domain/contributionContract';
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
  import { Button, Combobox, Cover, Field, Icon, IconButton, Notice, Select, Textarea, type ComboboxOption } from '$lib/ui';
  import type { Artist, CatalogSnapshot, DictionaryEntry } from '$lib/services/adminCatalog';

  // Formulario del editor del Estudio (U16), compartido desde U19 por el editor del catálogo y el de
  // propuestas: cabecera, índice, las secciones del lanzamiento y la barra de guardar. Quien lo usa
  // pone la última sección (historial o propuesta), las acciones y lo que pasa al guardar.

  type Feedback = { tone: 'error' | 'success'; text: string } | null;

  type Props = {
    release: CatalogSnapshot;
    labels: DictionaryEntry[];
    genres: DictionaryEntry[];
    countries: DictionaryEntry[];
    types: DictionaryEntry[];
    /** Nombres de artistas conocidos, compartidos con la lista. */
    artists: Artist[];
    sections: ReadonlyArray<EditorSection>;
    eyebrow: string;
    backLabel: string;
    onclose: () => void;
    /** Cuándo se crea un artista o sello nuevo: «al guardar» (catálogo) o «al aceptar» (propuesta). */
    createdWhen: string;
    titleError?: string;
    /** Reseña y portada en solo lectura, con el porqué (el colaborador no las cambia). */
    lockedNote?: string;
    reviewHint?: string;
    /** Número junto a la última sección del índice (las entradas del historial). */
    tally?: number;
    tailNote?: string;
    technical?: boolean;
    meta?: Snippet;
    /** Avisos sobre lo que se abrió, encima de las secciones. */
    intro?: Snippet;
    tail: Snippet;
    feedback: Feedback;
    /** Texto de la barra cuando no hay aviso, y si es «sin cambios» (en móvil se oculta). */
    statusText: string;
    clean: boolean;
    note: string;
    noteLabel: string;
    notePlaceholder: string;
    noteRequired?: boolean;
    noteElement?: HTMLInputElement;
    onnoteenter?: () => void;
    actions: Snippet;
    /** Las acciones en su propia fila, debajo de la nota (cuando son muchas). */
    stackActions?: boolean;
    onmessage?: (text: string) => void;
  };

  let {
    release = $bindable(),
    labels = $bindable(),
    genres,
    countries,
    types,
    artists = $bindable(),
    sections,
    eyebrow,
    backLabel,
    onclose,
    createdWhen,
    titleError = $bindable(''),
    lockedNote = '',
    reviewHint,
    tally = 0,
    tailNote = '',
    technical = false,
    meta,
    intro,
    tail,
    feedback,
    statusText,
    clean,
    note = $bindable(''),
    noteLabel,
    notePlaceholder,
    noteRequired = false,
    noteElement = $bindable(),
    onnoteenter,
    actions,
    stackActions = false,
    onmessage
  }: Props = $props();

  let activeSection = $state<EditorSectionId>('datos');
  const labelSimilar = new SimilarEntries('labels');

  const tailSection = $derived(sections[sections.length - 1]);
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
  const independent = $derived(labels.find((label) => normalizeSearch(label.name) === normalizeSearch(INDEPENDENT_LABEL)) ?? null);
  // «Independiente» fijo arriba, también si todavía no existe (se crearía como cualquier sello nuevo).
  const labelOptions = $derived.by<ComboboxOption[]>(() => {
    const pinned = independent ? { value: independent.id, label: independent.name } : { value: pendingId(INDEPENDENT_LABEL), label: INDEPENDENT_LABEL, hint: newHint };
    const pending = isPendingId(release.label_id) && release.label_id !== pinned.value ? [{ value: release.label_id, label: pendingName(release.label_id), hint: newHint }] : [];
    return [pinned, ...pending, ...labels.filter((label) => label.id !== independent?.id).map((label) => ({ value: label.id, label: label.name }))];
  });
  const pendingLabel = $derived(isPendingId(release.label_id) ? pendingName(release.label_id) : '');
  const sectionOptions = $derived(sections.map((section) => ({ value: section.id, label: sectionLabel(section.id, section.label) })));
  const hasRadar = $derived(!!completeRadar(release.radar));

  function sectionLabel(id: EditorSectionId, label: string) {
    if (id === tailSection.id) return tally ? `${label} (${tally})` : label;
    const count = missingIn[id].length;
    return count ? `${label} · falta ${count}` : label;
  }

  function createLabel(text: string): ComboboxOption {
    const name = text.replace(/\s+/g, ' ').trim();
    labelSimilar.check(name);
    return { value: pendingId(name), label: name };
  }

  function useLabel(entry: DictionaryEntry) {
    if (!labels.some((label) => label.id === entry.id)) labels = [...labels, entry].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    release.label_id = entry.id;
  }

  // ---------------------------------------------------------------------------
  // Índice: lleva a cada sección y marca la que se está viendo.

  async function goTo(id: EditorSectionId) {
    activeSection = id;
    const target = document.getElementById(editorSectionAnchor(id));
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // El foco va un frame después. Con el salto instantáneo, el header veía el
    // scroll unas veces con el foco aún en el selector (se queda) y otras ya en
    // el h2 (se oculta); así siempre lo ve antes del cambio de foco.
    const heading = target.querySelector<HTMLElement>('h2');
    requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
  }

  $effect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeSection = entry.target.getAttribute('data-section') as EditorSectionId;
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    for (const section of sections) {
      const element = document.getElementById(editorSectionAnchor(section.id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  });

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
      : 'Sin fecha';
</script>

<div class="editor">
  <header class="editor__head">
    <IconButton icon="flecha-izquierda" label={backLabel} variant="secondary" tooltip="bottom" tooltipAlign="start" onclick={onclose} />
    <Cover class="editor__thumb" src={release.cover_url} alt="" radius="sm" loading="eager" />
    <div class="editor__identity">
      <p class="editor__eyebrow">{eyebrow}</p>
      <h1 class="editor__title">{release.title || 'Sin título'}</h1>
      <p class="editor__artists">{artistLine || 'Añade un artista principal'}</p>
    </div>
    {#if meta}<div class="editor__meta">{@render meta()}</div>{/if}
  </header>


  <div class="editor__layout">
    <aside class="editor__aside">
      <nav class="editor__index" aria-label="Secciones del lanzamiento">
        <ol>
          {#each sections as section (section.id)}
            {@const count = section.id === tailSection.id ? tally : missingIn[section.id].length}
            <li>
              <a
                class="editor__index-link"
                href="#{editorSectionAnchor(section.id)}"
                aria-current={activeSection === section.id ? 'location' : undefined}
                onclick={(event) => { event.preventDefault(); void goTo(section.id); }}
              >
                <span>{section.label}</span>
                {#if section.id === tailSection.id}
                  {#if count}<span class="editor__tally">{count}</span>{/if}
                {:else if count}
                  <span class="editor__tally editor__tally--missing">falta {count}</span>
                {/if}
              </a>
            </li>
          {/each}
        </ol>
      </nav>
      <div class="editor__jump">
        <Select label="Ir a la sección" hideLabel icon="lista" options={sectionOptions} value={activeSection} onchange={(value) => void goTo(value as EditorSectionId)} />
      </div>
      <p class="editor__readiness" class:editor__readiness--ok={!missing.length}>
        {#if missing.length}<span class="editor__readiness-label">Para publicar falta:</span> {missing.join(', ')}{:else}Listo para publicar.{/if}
      </p>
    </aside>

    <div class="editor__body">
      {#if intro}{@render intro()}{/if}

      <section class="editor__section" id={editorSectionAnchor('datos')} data-section="datos" aria-labelledby="editor-h-datos">
        <header class="editor__section-head">
          <h2 id="editor-h-datos" tabindex="-1">Datos</h2>
          {#if missingIn.datos.length}<span class="editor__section-missing">Falta: {missingIn.datos.join(', ')}</span>{/if}
        </header>
        <div class="editor__grid">
          <Field
            class="editor__span-4"
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
          <Select
            class="editor__span-2"
            label="Tipo"
            options={typeOptions}
            value={release.release_type_id ?? ''}
            onchange={(value) => (release.release_type_id = value || null)}
          />
          <Field
            class="editor__span-2"
            label="Fecha de lanzamiento"
            type="date"
            value={release.release_date ?? ''}
            oninput={(event: Event) => (release.release_date = (event.currentTarget as HTMLInputElement).value)}
          />
          <div class="editor__span-4 editor__stack">
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
              hint={pendingLabel ? `«${pendingLabel}» es nuevo: se crea ${createdWhen}.` : 'Si es autoeditado, elige «Independiente».'}
              removeLabel={(text) => `Quitar sello ${text}`}
            />
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
        </div>
        <details class="editor__more">
          <summary><span class="editor__chevron" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span>Reseña <span class="editor__optional">(opcional)</span></summary>
          <Textarea
            label="Texto editorial"
            hideLabel
            rows={4}
            bind:value={release.review}
            readonly={!!lockedNote}
            hint={lockedNote || reviewHint}
            placeholder="Añade una reseña solo cuando aporte contexto."
          />
        </details>
        {#if technical && release.id}
          <details class="editor__more">
            <summary><span class="editor__chevron" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span>Datos técnicos</summary>
            <dl class="editor__tech">
              <dt>ID</dt><dd>{release.id}</dd>
              <dt>Identificador</dt><dd>{release.slug}</dd>
              <dt>Última edición</dt><dd>{formatDate(release.updated_at)}</dd>
            </dl>
          </details>
        {/if}
      </section>

      <section class="editor__section" id={editorSectionAnchor('creditos')} data-section="creditos" aria-labelledby="editor-h-creditos">
        <header class="editor__section-head">
          <h2 id="editor-h-creditos" tabindex="-1">Créditos</h2>
          {#if missingIn.creditos.length}<span class="editor__section-missing">Falta: {missingIn.creditos.join(', ')}</span>{/if}
        </header>
        <EditorCredits bind:release bind:artists {createdWhen} {onmessage} />
      </section>

      <section class="editor__section" id={editorSectionAnchor('clasificacion')} data-section="clasificacion" aria-labelledby="editor-h-clasificacion">
        <header class="editor__section-head">
          <h2 id="editor-h-clasificacion" tabindex="-1">Clasificación</h2>
          {#if missingIn.clasificacion.length}<span class="editor__section-missing">Falta: {missingIn.clasificacion.join(', ')}</span>{/if}
        </header>
        <div class="editor__pair">
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
          <RadarControls bind:value={release.radar} />
        {:else}
          <div class="editor__radar-empty">
            <span>Sin radar.</span>
            <Button variant="link" size="sm" onclick={() => (release.radar = { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 })}>Añadir radar</Button>
          </div>
        {/if}
      </section>

      <section class="editor__section" id={editorSectionAnchor('medios')} data-section="medios" aria-labelledby="editor-h-medios">
        <header class="editor__section-head">
          <h2 id="editor-h-medios" tabindex="-1">Medios</h2>
          {#if missingIn.medios.length}<span class="editor__section-missing">Falta: {missingIn.medios.join(', ')}</span>{/if}
        </header>
        <div class="editor__media">
          <Cover class="editor__cover" src={release.cover_url} alt={release.cover_url ? `Portada de ${release.title || 'lanzamiento'}` : ''} radius="sm" />
          <div class="editor__media-fields">
            <Field
              label="Link de compra o escucha"
              type="url"
              value={link?.url ?? ''}
              placeholder="https://bandcamp.com/…"
              hint={link?.url ? `Proveedor: ${inferProvider(link.url)}.` : 'Detectamos el proveedor a partir de la URL.'}
              oninput={(event: Event) => (release.links = withPrimaryLink(release.links, (event.currentTarget as HTMLInputElement).value))}
            />
            <Field
              label="URL de portada"
              type="url"
              value={release.cover_url ?? ''}
              readonly={!!lockedNote}
              oninput={(event: Event) => (release.cover_url = (event.currentTarget as HTMLInputElement).value)}
              placeholder="https://…"
              hint={lockedNote || 'Pega una URL HTTPS. La detección automática llegará después.'}
            />
            {#if extraLinks}<p class="editor__extra">{extraLinks === 1 ? 'Hay 1 enlace adicional' : `Hay ${extraLinks} enlaces adicionales`}; se conservan al guardar.</p>{/if}
          </div>
        </div>
      </section>

      <section class="editor__section" id={editorSectionAnchor(tailSection.id)} data-section={tailSection.id} aria-labelledby="editor-h-{tailSection.id}">
        <header class="editor__section-head">
          <h2 id="editor-h-{tailSection.id}" tabindex="-1">{tailSection.label}</h2>
          {#if tailNote}<span class="editor__section-note">{tailNote}</span>{/if}
        </header>
        {@render tail()}
      </section>

      <div class="editor__bar" role="region" aria-label="Guardar">
        <div class="editor__bar-status" aria-live="polite">
          {#if feedback}
            <p class="editor__feedback editor__feedback--{feedback.tone}" role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>
          {:else}
            <p class="editor__dirty" class:editor__dirty--clean={clean}>{statusText}</p>
          {/if}
        </div>
        <div class="editor__bar-row" class:editor__bar-row--stacked={stackActions}>
          <Field
            class="editor__note"
            label={noteLabel}
            hideLabel
            required={noteRequired}
            bind:value={note}
            bind:element={noteElement}
            placeholder={notePlaceholder}
            autocomplete="off"
            onkeydown={(event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); onnoteenter?.(); } }}
          />
          <div class="editor__bar-actions">{@render actions()}</div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .editor { color: var(--color-texto); }

  /* ---- Cabecera -------------------------------------------------------- */
  .editor__head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--density-gap);
  }
  .editor__head :global(.editor__thumb) {
    flex: 0 0 var(--tool-thumb);
    width: var(--tool-thumb);
    height: var(--tool-thumb);
  }
  .editor__identity { flex: 1; min-width: 0; }
  .editor__eyebrow {
    margin: 0;
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }
  .editor__title {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: var(--leading-heading);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .editor__artists {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .editor__meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }


  /* ---- Índice y cuerpo ------------------------------------------------- */
  .editor__layout {
    display: grid;
    grid-template-columns: var(--tool-index-w) minmax(0, 1fr);
    gap: var(--space-5);
    align-items: start;
  }

  .editor__aside {
    position: sticky;
    top: calc(var(--header-offset) + var(--space-5));
    transition: top var(--motion-slow) var(--ease-emphasized);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .editor__index ol {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--color-linea);
  }
  .editor__index-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: var(--target-touch);
    margin-left: -1px;
    padding: 0 var(--space-3);
    border-left: 2px solid transparent;
    color: var(--color-texto-medio);
    font-size: var(--density-text);
    font-weight: 600;
    text-decoration: none;
    transition: color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
  }
  .editor__index-link:hover { color: var(--color-texto); }
  .editor__index-link[aria-current='location'] { border-left-color: var(--color-acento); color: var(--color-acento); }
  .editor__tally { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-weight: 500; font-variant-numeric: tabular-nums; }
  .editor__tally--missing { color: var(--color-aviso); }

  .editor__jump { display: none; }

  .editor__readiness {
    margin: 0;
    padding: var(--space-3) var(--space-3) 0;
    border-top: 1px solid var(--color-linea);
    color: var(--color-aviso);
    font-size: var(--text-2xs);
    line-height: 1.5;
  }
  .editor__readiness-label { color: var(--color-texto-tenue); }
  .editor__readiness--ok { color: var(--color-acento); }

  .editor__body { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }

  .editor__section {
    padding: var(--density-pad);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    /* El alto del header lo reserva el scroll-padding de html (U18). */
    scroll-margin-top: var(--space-5);
  }
  .editor__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    margin-bottom: var(--space-3);
  }
  .editor__section-head h2 { margin: 0; font-size: var(--text-md); font-weight: 700; }
  .editor__section-head h2:focus { outline: none; }
  .editor__section-missing { color: var(--color-aviso); font-size: var(--text-2xs); }
  .editor__section-note { color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* ---- Datos ------------------------------------------------------------ */
  .editor__grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-3) var(--density-gap);
  }
  .editor__grid :global(.editor__span-4) { grid-column: span 4; }
  .editor__grid :global(.editor__span-2) { grid-column: span 2; }
  .editor__stack { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }

  .editor__more { margin-top: var(--space-3); }
  .editor__more summary {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .editor__more summary { gap: var(--space-1); list-style: none; }
  .editor__more summary::-webkit-details-marker { display: none; }
  .editor__chevron { display: flex; color: var(--color-texto-tenue); transition: transform var(--motion-fast) var(--ease-standard); }
  .editor__more[open] .editor__chevron { transform: rotate(90deg); }
  .editor__optional { margin-left: .3em; color: var(--color-texto-tenue); font-weight: 400; }
  .editor__tech {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-1) var(--space-3);
    margin: 0;
    font-size: var(--text-2xs);
  }
  .editor__tech dt { color: var(--color-texto-tenue); }
  .editor__tech dd { margin: 0; overflow-wrap: anywhere; color: var(--color-texto-alto); font-variant-numeric: tabular-nums; }

  /* ---- Clasificación ---------------------------------------------------- */
  .editor__pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3) var(--density-gap);
    align-items: start;
  }
  .editor__radar-empty {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-borde);
    color: var(--color-texto-tenue);
    font-size: var(--text-sm);
  }

  /* ---- Medios ----------------------------------------------------------- */
  .editor__media {
    display: grid;
    grid-template-columns: var(--tool-cover) minmax(0, 1fr);
    gap: var(--density-gap);
    align-items: start;
  }
  .editor__media :global(.editor__cover) { width: var(--tool-cover); height: var(--tool-cover); }
  .editor__media-fields { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .editor__extra { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* ---- Barra de guardar: fija abajo mientras se edita ------------------ */
  .editor__bar {
    position: sticky;
    bottom: 0;
    z-index: var(--layer-sticky);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding: var(--space-3) var(--density-pad) calc(var(--space-3) + var(--safe-area-bottom));
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    box-shadow: var(--shadow-flotante);
  }
  .editor__bar-status p { margin: 0; font-size: var(--text-2xs); }
  .editor__dirty { color: var(--color-texto-tenue); }
  .editor__feedback--error { color: var(--color-danger-texto); font-weight: 600; }
  .editor__feedback--success { color: var(--color-acento); }
  .editor__bar-row { display: flex; align-items: center; gap: var(--space-3); }
  .editor__bar-row :global(.editor__note) { flex: 1; }
  .editor__bar-actions { display: flex; gap: var(--space-2); }
  /* Muchas acciones (propuesta como admin): debajo de la nota, en dos grupos. */
  .editor__bar-row--stacked { flex-direction: column; align-items: stretch; gap: var(--space-2); }
  .editor__bar-row--stacked .editor__bar-actions { flex-wrap: wrap; justify-content: space-between; }
  .editor__bar-actions :global(.editor__bar-group) { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  /* ---- Tablet: el índice sigue al lado, más estrecho ------------------- */
  @media (max-width: 1023px) {
    .editor__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* Título y sello a todo el ancho; tipo y fecha comparten fila. */
    .editor__grid :global(.editor__span-4) { grid-column: 1 / -1; }
    .editor__grid :global(.editor__span-2) { grid-column: span 1; }
    .editor__pair { grid-template-columns: minmax(0, 1fr); }
  }

  /* ---- Móvil: una columna, el índice es un selector y la barra va abajo - */
  @media (max-width: 767px) {
    .editor__head { flex-wrap: wrap; }
    .editor__meta { flex-basis: 100%; justify-content: flex-start; }
    /* En bloque, no en grilla: el selector fijo necesita toda la página como
       bloque contenedor (en una grilla sería solo su fila). */
    .editor__layout { display: block; }
    .editor__body { margin-top: var(--space-3); }
    .editor__aside {
      top: var(--header-offset);
      z-index: var(--layer-sticky);
      gap: var(--space-1);
      margin-inline: calc(-1 * var(--container-gutter));
      padding: var(--space-2) var(--container-gutter);
      border-bottom: 1px solid var(--color-linea);
      background: var(--color-fondo);
    }
    .editor__index { display: none; }
    .editor__jump { display: block; }
    .editor__readiness { padding: 0; border: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .editor__section { margin-inline: calc(-1 * var(--container-gutter)); border-inline: 0; border-radius: 0; scroll-margin-top: calc(var(--field-h-md) + var(--space-7)); }
    .editor__grid { grid-template-columns: minmax(0, 1fr); }
    .editor__grid :global(.editor__span-4),
    .editor__grid :global(.editor__span-2) { grid-column: 1 / -1; }
    .editor__media { grid-template-columns: minmax(0, 1fr); }
    .editor__bar {
      margin-inline: calc(-1 * var(--container-gutter));
      padding-inline: var(--container-gutter);
      border-inline: 0;
      border-radius: 0;
    }
    .editor__bar-status:has(.editor__dirty--clean) { display: none; }
    .editor__bar-row { flex-direction: column; align-items: stretch; gap: var(--space-2); }
    /* Dos acciones largas (colaborador) no caben en una fila de 390: bajan de línea. */
    .editor__bar-actions { flex-wrap: wrap; }
    .editor__bar-actions > :global(*) { flex: 1 1 auto; }
    .editor__bar-actions :global(.editor__bar-group > *) { flex: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .editor__index-link,
    .editor__chevron,
    .editor__aside { transition: none; }
  }
</style>
