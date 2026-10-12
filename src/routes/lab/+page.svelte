<script lang="ts">
  // Catálogo interno de primitivas (U5 y U6), layouts (U7) y tarjeta y fila (U8). No se enlaza desde ninguna navegación
  // y no se indexa. Cada primitiva nueva o extendida se muestra aquí con todos
  // sus estados (contrato del plan de interfaz, sección 6.4).
  import {
    Breadcrumbs,
    Button,
    Checkbox,
    Chip,
    Combobox,
    Cover,
    CreditLine,
    Dialog,
    Menu,
    Sheet,
    SocialLinks,
    Sortable,
    EmptyState,
    ErrorState,
    Field,
    Icon,
    IconButton,
    LoadingIndicator,
    Notice,
    Pagination,
    PasswordField,
    Select,
    Skeleton,
    Textarea,
    ViewToggle,
    ICON_NAMES,
    SOCIAL_ICONS,
    readViewPreference,
    type ComboboxOption,
    type MenuItem,
    type ViewMode
  } from '$lib/ui';
  import { AccountLayout, Container, InboxDetail, InboxField, InboxItem, InboxLayout, ReadingLayout, ToolLayout, type ContainerSize } from '$lib/layouts';
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import LanzamientoFila from '$lib/components/LanzamientoFila.svelte';
  import CollectionTile from '$lib/components/colecciones/CollectionTile.svelte';
  import type { Crate } from '$lib/stores/cratesStore';

  const CONTAINERS: { size: ContainerSize; label: string }[] = [
    { size: 'narrow', label: 'narrow · 736 · lectura, formularios, cuenta' },
    { size: 'regular', label: 'regular · 960 · perfil y colecciones propias' },
    { size: 'wide', label: 'wide · 1200 · catálogo, artista, sello, colección, ficha' },
    { size: 'full', label: 'full · todo el viewport · herramienta' }
  ];
  import {
    ARTIST_OPTIONS,
    COUNTRY_OPTIONS,
    COVER_TONES,
    CREDIT_SAMPLES,
    GENRE_OPTIONS,
    RELEASE_SAMPLES,
    SOCIAL_SAMPLE,
    SORTABLE_SAMPLES,
    sampleCover
  } from './samples';

  const variants = ['primary', 'secondary', 'accent', 'ghost', 'destructive', 'link'] as const;
  const variantNames = { primary: 'Primario', secondary: 'Secundario', accent: 'Acento', ghost: 'Ghost', destructive: 'Destructivo', link: 'Enlace' };
  const sizes = ['sm', 'md', 'lg'] as const;
  const iconVariants = ['ghost', 'secondary', 'primary', 'destructive'] as const;

  /** U8: la tarjeta y la fila llaman a onabrir en lugar de abrir el modal. */
  let opened = $state('');

  // U14: interruptor, mosaico de colección y ordenable sin marco.
  let switchOn = $state(true);
  let switchOff = $state(false);
  let collectionCards = $state(RELEASE_SAMPLES.slice(0, 3));
  const labCrate = (id: string, name: string, count: number, isPublic = true): Crate => ({
    id, name, slug: id, description: null, is_public: isPublic, owner_id: 'lab',
    created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z', item_count: count
  });
  const MOSAIC_SAMPLES = [
    { crate: labCrate('cuatro', 'Para abrir el set', 6), covers: COVER_TONES.slice(0, 4).map((tone) => sampleCover(300, 300, tone, '')) },
    { crate: labCrate('dos', 'Dembow raro', 2, false), covers: COVER_TONES.slice(2, 4).map((tone) => sampleCover(300, 300, tone, '')) },
    { crate: labCrate('vacia', 'Pendientes por escuchar con calma este fin de semana largo', 0), covers: [] }
  ];

  let busy = $state(false);
  let pressed = $state(false);
  let search = $state('');
  let email = $state('nombre@correo');
  let note = $state('');
  let password = $state('');
  let passwordValid = $state(false);
  let currentPassword = $state('');
  let newsletter = $state(true);
  let privacy = $state(false);
  let filters = $state(['Colombia', 'Techno', 'Álbum', '2024', 'Electrónica latinoamericana experimental', 'Sello: Insurgentes']);
  let selectedGenre = $state('House');
  let page = $state(5);
  let compactPage = $state(1);
  let order = $state('recientes');
  let view = $state<ViewMode>(readViewPreference('lab') ?? 'grid');
  let retrying = $state(false);

  // ---- U6 -------------------------------------------------------------------
  let genres = $state(['techno', 'house']);
  let countries = $state<string[]>([]);
  let artists = $state(['Ela Minus', 'Nicola Cruz']);
  // U16
  let pickedArtists = $state(['Nicola Cruz']);

  // U17: bandeja del Estudio, con datos de ejemplo.
  type InboxDemoItem = { id: string; title: string; status: string; tone: 'neutral' | 'accent'; flag?: string; meta: string[] };
  const inboxGroups: { id: string; label: string; help?: string; empty: string; items: InboxDemoItem[] }[] = [
    { id: 'prioridad', label: 'Cola prioritaria', help: 'Aportes de colaboración y propuestas ya preparadas.', empty: '', items: [
      { id: 'p1', title: 'Fuego lento', status: 'Listo para administración', tone: 'accent', meta: ['Nicola Cruz', '20 de sept de 2026'] }
    ] },
    { id: 'comunidad', label: 'Cola comunitaria', empty: 'No hay propuestas comunitarias pendientes.', items: [
      { id: 'p2', title: 'Siete lunas', status: 'Pendiente', tone: 'neutral', flag: '1 campo editado', meta: ['Lido Pimienta', '21 de sept de 2026'] },
      { id: 'p3', title: 'Un título largo para ver cómo se corta en dos líneas dentro de la lista', status: 'Pendiente', tone: 'neutral', meta: ['Varios artistas', '22 de sept de 2026'] }
    ] }
  ];
  let inboxSelected = $state<string | null>('p2');
  const inboxCurrent = $derived(inboxGroups.flatMap((group) => group.items).find((item) => item.id === inboxSelected) ?? null);
  let artistOptions = $state<ComboboxOption[]>([...ARTIST_OPTIONS]);
  let lastAction = $state('Ninguna');
  let dialogOpen = $state(false);
  let confirmOpen = $state(false);
  let confirmTarget = $state('');
  let sheetOpen = $state(false);
  let shortSheetOpen = $state(false);
  let sheetGenres = $state(['cumbia']);
  let releases = $state([...SORTABLE_SAMPLES]);
  let gridReleases = $state([...SORTABLE_SAMPLES]);
  let sheetReleases = $state(SORTABLE_SAMPLES.slice(0, 4));
  let reorderLog = $state('Sin cambios');
  const tableRows = ['Pájaros de fuego', 'Miss Colombia', '¡Ay!', 'Prender el alma', 'Atlantic Oscillations', 'Llegó la cumbia'];

  function collectionActions(name: string): MenuItem[] {
    return [
      { label: 'Compartir', icon: 'compartir', onselect: () => (lastAction = `Compartir ${name}`) },
      { label: 'Editar nombre', onselect: () => (lastAction = `Editar ${name}`) },
      { label: 'Ver en el catálogo', icon: 'flecha-externa', href: '/' },
      { label: 'Duplicar (no disponible)', disabled: true },
      {
        label: 'Eliminar',
        tone: 'danger',
        onselect: () => {
          confirmTarget = name;
          confirmOpen = true;
        }
      }
    ];
  }

  function createArtist(text: string): ComboboxOption {
    const option = { value: text, label: text, hint: 'Nuevo' };
    artistOptions = [...artistOptions, option];
    return option;
  }

  function fakeBusy() {
    busy = true;
    setTimeout(() => (busy = false), 1600);
  }

  function retry() {
    retrying = true;
    setTimeout(() => (retrying = false), 1600);
  }
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="l-container l-container--wide lab">
  <header class="lab__intro">
    <h1>Primitivas</h1>
    <p>Página interna con cada primitiva y sus estados. No aparece en la navegación.</p>
  </header>

  <!-- ================================================================ -->
  <section class="lab__section" id="iconos" aria-labelledby="t-iconos">
    <h2 id="t-iconos">Iconos</h2>
    <p class="lab__note">SVG con <code>currentColor</code>; tamaños sm 16 · md 20 · lg 24.</p>
    <ul class="lab__icons">
      {#each ICON_NAMES as name}
        <li class:lab__icon--social={(SOCIAL_ICONS as readonly string[]).includes(name)}>
          <Icon {name} size="lg" />
          <span>{name}</span>
        </li>
      {/each}
    </ul>
    <div class="lab__row">
      <Icon name="buscar" size="sm" /><Icon name="buscar" size="md" /><Icon name="buscar" size="lg" />
      <span class="lab__accent"><Icon name="menu" size="lg" label="Menú" /></span>
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="botones" aria-labelledby="t-botones">
    <h2 id="t-botones">Button</h2>
    <p class="lab__note">sm 32 (área táctil 44) · md 44, como Comprar · lg 52.</p>
    <div class="lab__matrix">
      {#each variants as variant}
        <div class="lab__row">
          <span class="lab__label">{variantNames[variant]}</span>
          {#each sizes as size}
            <Button {variant} {size}>{variantNames[variant]} {size}</Button>
          {/each}
          <Button {variant} disabled>Deshabilitado</Button>
        </div>
      {/each}
    </div>

    <h3>Estados y composición</h3>
    <div class="lab__row">
      <Button icon="agregar">Añadir a colección</Button>
      <Button variant="secondary" iconEnd="flecha-derecha">Siguiente</Button>
      <Button variant="secondary" icon="buscar" href="/">Como enlace</Button>
      <Button variant="secondary" href="/" disabled>Enlace deshabilitado</Button>
      <Button loading={busy} onclick={fakeBusy}>{busy ? 'Guardando' : 'Guardar (ocupado 1.6 s)'}</Button>
      <Button variant="ghost" icon="salir">Salir</Button>
      <Button variant="secondary" {pressed} onclick={() => (pressed = !pressed)}>Alternar: {pressed ? 'sí' : 'no'}</Button>
    </div>
    <div class="lab__narrow">
      <Button block>Ver 2.790 lanzamientos</Button>
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="icon-button" aria-labelledby="t-icon-button">
    <h2 id="t-icon-button">IconButton</h2>
    <p class="lab__note">Siempre con nombre accesible y ayuda emergente (cursor o foco de teclado; Escape la oculta).</p>
    {#each iconVariants as variant}
      <div class="lab__row">
        <span class="lab__label">{variantNames[variant]}</span>
        {#each sizes as size}
          <IconButton icon="compartir" label={`Compartir (${size})`} {variant} {size} />
        {/each}
        <IconButton icon="reportar" label="Reportar un problema" {variant} />
        <IconButton icon="cerrar" label="Cerrar" {variant} disabled />
      </div>
    {/each}
    <div class="lab__row">
      <span class="lab__label">Ayuda</span>
      <IconButton icon="menu" label="Menú" tooltip="bottom" />
      <IconButton icon="mas-opciones" label="Más opciones" tooltipAlign="start" />
      <IconButton icon="flecha-externa" label="Abrir fuente original" href="/" tooltipAlign="end" />
      <IconButton icon="compartir" label="Compartir" loading />
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="campos" aria-labelledby="t-campos">
    <h2 id="t-campos">Field, Textarea y PasswordField</h2>
    <div class="lab__fields">
      <Field label="Buscar en el catálogo" type="search" icon="buscar" size="lg" placeholder="Artista, lanzamiento, sello o género" bind:value={search} hint="Escribe al menos dos letras." />
      <Field label="Correo" type="email" autocomplete="email" bind:value={email} error="Revisa el formato del correo." />
      <Field label="Usuario de Bandcamp" optional placeholder="https://bandcamp.com/usuario" />
      <Field label="Usuario" value="discotica" readonly hint="Solo lectura." />
      <Field label="Deshabilitado" value="No editable" disabled />
      <Textarea label="Nota para el equipo" optional maxlength={280} bind:value={note} hint="Cuéntanos de dónde sale el lanzamiento." />
      <Textarea label="Motivo del rechazo" required error="La nota es obligatoria al rechazar." />
      <Textarea label="Textarea deshabilitado" value="Sin edición" disabled rows={2} />
      <PasswordField bind:value={password} bind:valid={passwordValid} hint="Usa una frase que recuerdes." />
      <PasswordField label="Contraseña actual" autocomplete="current-password" bind:value={currentPassword} />
    </div>
    <p class="lab__note" aria-live="polite">Contraseña nueva {passwordValid ? 'válida' : 'todavía no válida'}.</p>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="checkbox-aviso" aria-labelledby="t-checkbox-aviso">
    <h2 id="t-checkbox-aviso">Checkbox y Notice</h2>
    <div class="lab__fields">
      <Checkbox bind:checked={newsletter}>Quiero recibir novedades de Discótica por correo.</Checkbox>
      <Checkbox bind:checked={privacy} error="Para crear la cuenta tienes que aceptar la política de privacidad.">
        Leí y acepto la <a href="#checkbox-aviso">política de privacidad</a>.
      </Checkbox>
      <Checkbox checked disabled>Deshabilitada</Checkbox>
      <div class="lab__row"><Checkbox hideLabel checked>Seleccionar «Killing mariposas»</Checkbox><Checkbox hideLabel>Seleccionar «Reflexiones»</Checkbox><span class="lab__note">hideLabel: la casilla de una fila de tabla (U15), con nombre accesible y 44 × 44.</span></div>
      <Notice tone="error">No pudimos entrar con esos datos. Revisa tu usuario o correo y la contraseña.</Notice>
      <Notice tone="success" title="Tu cuenta está confirmada">Ya puedes crear colecciones, compartirlas y sugerir lanzamientos.</Notice>
      <Notice tone="info" title="Cambio pendiente">
        Confírmalo desde el enlace que te enviamos.
        {#snippet actions()}<Button variant="secondary" size="sm">Reenviar</Button>{/snippet}
      </Notice>
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="chips" aria-labelledby="t-chips">
    <h2 id="t-chips">Chip</h2>
    <h3>Filtro activo compacto (banda desplazable)</h3>
    <div class="lab__band" role="list" aria-label="Filtros activos">
      {#each filters as filter (filter)}
        <span role="listitem"><Chip kind="filter" label={filter} onremove={() => (filters = filters.filter((f) => f !== filter))} /></span>
      {:else}
        <span class="lab__note">Sin filtros. <Button variant="link" size="sm" onclick={() => (filters = ['Colombia', 'Techno'])}>Restaurar</Button></span>
      {/each}
    </div>
    <h3>Género</h3>
    <div class="lab__row">
      <Chip kind="genre" label="Electrónica" />
      <Chip kind="genre" label="Cumbia" href="/?genero=cumbia" />
      {#each ['House', 'Techno', 'Ambient'] as genre}
        <Chip kind="genre" label={genre} selected={selectedGenre === genre} onclick={() => (selectedGenre = genre)} />
      {/each}
      <Chip kind="genre" label="Deshabilitado" disabled onclick={() => {}} />
    </div>
    <h3>Género compacto (sm, una sola línea: tarjeta y fila)</h3>
    <div class="lab__row">
      <Chip kind="genre" size="sm" label="Cumbia" href="/?genero=cumbia" />
      <Chip kind="genre" size="sm" label="Drum and bass" href="/?genero=drum-and-bass" />
    </div>
    <h3>Estado</h3>
    <div class="lab__row">
      <Chip kind="status" label="Borrador" />
      <Chip kind="status" tone="accent" label="Publicado" />
      <Chip kind="status" tone="warning" label="En revisión" />
      <Chip kind="status" tone="danger" label="Archivado" />
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="paginacion" aria-labelledby="t-paginacion">
    <h2 id="t-paginacion">Pagination</h2>
    <h3>Completa (desktop)</h3>
    <div class="lab__scroll">
      <Pagination variant="full" {page} totalPages={233} onchange={(next) => (page = next)} label="Paginación completa" />
      <Pagination variant="full" page={1} totalPages={4} label="Paginación corta" />
      <Pagination variant="full" size="sm" {page} totalPages={233} onchange={(next) => (page = next)} label="Paginación sm" />
    </div>
    <h3>Compacta junto a "Ordenar por" (móvil, U10)</h3>
    <div class="lab__results-bar">
      <Pagination variant="compact" page={compactPage} totalPages={233} onchange={(next) => (compactPage = next)} label="Paginación de resultados" />
      <Select
        class="lab__sort"
        label="Ordenar por"
        hideLabel="wide"
        inline
        icon="ordenar"
        bind:value={order}
        options={[{ value: 'recientes', label: 'Más reciente' }, { value: 'antiguos', label: 'Más antiguo' }]}
      />
    </div>
    <h3>Select</h3>
    <div class="lab__row">
      <Select label="Tipo" value="ep" options={[{ value: '', label: 'Todos' }, { value: 'ep', label: 'EP' }, { value: 'album', label: 'Álbum' }]} />
      <Select label="Año (sin etiqueta visible)" hideLabel value="2025" options={[{ value: '2026', label: '2026' }, { value: '2025', label: '2025' }]} />
      <Select label="Deshabilitado" disabled value="x" options={[{ value: 'x', label: 'Sin opciones' }]} />
    </div>
    <h3>Automática con enlaces (compacta bajo 768)</h3>
    <Pagination variant="auto" page={12} totalPages={233} hrefFor={(n) => `/lab?p=${n}`} onchange={(_, event) => event.preventDefault()} label="Paginación con enlaces" />
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="vista" aria-labelledby="t-vista">
    <h2 id="t-vista">ViewToggle</h2>
    <p class="lab__note">Se recuerda por contexto (aquí, <code>lab</code>). Recarga la página para comprobarlo.</p>
    <div class="lab__row">
      <ViewToggle bind:value={view} context="lab" />
      <ViewToggle value="list" size="sm" label="Vista (sm, sin recordar)" />
      <span class="lab__note">Vista actual: {view === 'grid' ? 'grilla' : 'lista'}</span>
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="carga" aria-labelledby="t-carga">
    <h2 id="t-carga">Carga</h2>
    <div class="lab__row">
      <LoadingIndicator label="Cargando lanzamientos" />
      <LoadingIndicator size="sm" label="Cargando" />
    </div>
    <h3>Esqueleto de tarjeta, con el indicador</h3>
    <div class="lab__loading">
      <LoadingIndicator label="Cargando lanzamientos" />
      <div class="lab__cards">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
    <h3>Esqueleto de fila</h3>
    <div class="lab__rows">
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="estados" aria-labelledby="t-estados">
    <h2 id="t-estados">EmptyState y ErrorState</h2>
    <div class="lab__states">
      <EmptyState message="No encontramos lanzamientos con estos filtros." detail="Quita algún filtro o busca otro término." actionLabel="Limpiar filtros" onaction={() => {}} />
      <ErrorState message="No pudimos cargar los lanzamientos." {retrying} onaction={retry} />
      <EmptyState size="inline" message="Esta colección todavía está vacía." actionLabel="Explorar el catálogo" actionHref="/" />
      <ErrorState size="inline" message="No pudimos guardar el cambio." detail="Revisa tu conexión e inténtalo otra vez." onaction={() => {}} />
    </div>
  </section>

  <!-- ================================================================ -->
  <section class="lab__section" id="migas" aria-labelledby="t-migas">
    <h2 id="t-migas">Breadcrumbs</h2>
    <Breadcrumbs items={[{ label: 'Catálogo', href: '/' }, { label: 'Artista' }]} />
    <Breadcrumbs
      label="Migas largas"
      items={[{ label: 'Catálogo', href: '/' }, { label: 'Sello', href: '/' }, { label: 'Un nombre de sello muy largo que no cabe en una línea a 390' }]}
    />
  </section>

  <!-- Primitivas compuestas (U6): envoltorio sin estilo para su captura propia en la suite visual. -->
  <div class="lab__u6">
    <!-- ================================================================ -->
    <section class="lab__section" id="combobox" aria-labelledby="t-combobox">
      <h2 id="t-combobox">Combobox con chips</h2>
      <p class="lab__note">Buscar sin tildes ni mayúsculas; ↑ ↓ e Intro eligen; con el campo vacío, Retroceso o ← van a los chips (← → entre chips, Retroceso o Supr los quitan).</p>
      <div class="lab__fields">
        <Combobox label="Géneros" options={GENRE_OPTIONS} bind:value={genres} placeholder="Buscar género" hint="Prueba «progressive» o «dnb»: grafías alternativas." />
        <Combobox label="Artistas" options={artistOptions} bind:value={artists} allowCreate oncreate={createArtist} placeholder="Buscar o añadir artista" hint="Si no existe, se puede añadir." />
        <Combobox label="Países" options={COUNTRY_OPTIONS} bind:value={countries} optional placeholder="Buscar país" />
        <Combobox label="Con error" options={COUNTRY_OPTIONS} value={[]} required error="Elige al menos un país." />
        <Combobox label="Deshabilitado" options={GENRE_OPTIONS} value={['ambient', 'dub']} disabled />
      </div>
      <p class="lab__note" aria-live="polite">Géneros: {genres.join(', ') || 'ninguno'} · Artistas: {artists.join(', ') || 'ninguno'}</p>
    </section>

    <!-- ================================================================ -->
    <section class="lab__section" id="menu" aria-labelledby="t-menu">
      <h2 id="t-menu">Menu "…"</h2>
      <p class="lab__note">En portal: nunca lo corta un contenedor. Flechas, Inicio, Fin y primera letra; Escape y Tab cierran y devuelven el foco al "…".</p>
      <div class="lab__menu-row">
        <span>Colección «Para el domingo»</span>
        <Menu label="Acciones de «Para el domingo»" items={collectionActions('Para el domingo')} />
      </div>
      <div class="lab__row">
        <Menu buttonLabel="Ordenar" label="Ordenar por" variant="secondary" align="start" groups={[
          { label: 'Fecha', items: [{ label: 'Más reciente', onselect: () => (lastAction = 'Más reciente') }, { label: 'Más antiguo', onselect: () => (lastAction = 'Más antiguo') }] },
          { label: 'Texto', items: [{ label: 'Título A–Z', onselect: () => (lastAction = 'Título A–Z') }] }
        ]} />
        <Menu label="Más opciones (sm)" size="sm" align="start" items={collectionActions('sm')} />
        <Menu label="Deshabilitado" disabled items={[]} />
        <span class="lab__note" aria-live="polite">Última acción: {lastAction}</span>
      </div>
      <h3>Dentro de una tabla con scroll y overflow (Estudio)</h3>
      <div class="lab__table-wrap" data-testid="lab-table">
        <table class="lab__table">
          <thead><tr><th scope="col">Lanzamiento</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {#each tableRows as row}
              <tr>
                <td>{row}</td>
                <td><Chip kind="status" tone="accent" label="Publicado" /></td>
                <td class="lab__table-actions"><Menu label={`Acciones de «${row}»`} size="sm" items={collectionActions(row)} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <!-- ================================================================ -->
    <section class="lab__section" id="dialog-sheet" aria-labelledby="t-dialog-sheet">
      <h2 id="t-dialog-sheet">Dialog y Sheet</h2>
      <p class="lab__note">Sobre <code>overlay.ts</code>: foco atrapado y devuelto, Escape, fondo inerte y scroll bloqueado. Menús y listas dentro van al portal del propio overlay.</p>
      <div class="lab__row">
        <Button variant="secondary" onclick={() => (dialogOpen = true)}>Abrir diálogo con scroll</Button>
        <Button variant="secondary" onclick={() => (sheetOpen = true)}>Abrir hoja con pie fijo</Button>
        <Button variant="secondary" onclick={() => (shortSheetOpen = true)}>Abrir hoja corta</Button>
      </div>
    </section>

    <!-- ================================================================ -->
    <section class="lab__section" id="sortable" aria-labelledby="t-sortable">
      <h2 id="t-sortable">Sortable</h2>
      <p class="lab__note">Arrastrar desde el asa con ratón o dedo (el resto de la fila desplaza la página). Con el asa enfocada: ↑ ↓ mueven, Inicio y Fin llevan a los extremos, Escape cancela un arrastre.</p>
      <h3>Lista con botones Subir y Bajar</h3>
      <div class="lab__narrow-list">
        <Sortable label="Orden de la colección" items={releases} key={(r) => r.id} itemLabel={(r) => r.title} moveButtons onreorder={(next, detail) => {
          releases = next;
          reorderLog = `${detail.from + 1} → ${detail.to + 1}`;
        }}>
          {#snippet item(release)}
            <div class="lab__release">
              <span class="lab__thumb"><Cover src={release.cover} alt="" /></span>
              <span class="lab__release-text"><strong>{release.title}</strong><span>{release.artist}</span></span>
            </div>
          {/snippet}
        </Sortable>
      </div>
      <p class="lab__note" aria-live="polite">Último cambio: {reorderLog} · Orden: {releases.map((r) => r.id).join(' ')}</p>
      <h3>Grilla de portadas</h3>
      <Sortable label="Orden de la colección (grilla)" layout="grid" bind:items={gridReleases} key={(r) => r.id} itemLabel={(r) => r.title}>
        {#snippet item(release)}
          <Cover src={release.cover} alt={release.title} radius="sm" />
          <span class="lab__grid-title">{release.title}</span>
        {/snippet}
      </Sortable>
    </section>

    <!-- ================================================================ -->
    <section class="lab__section" id="cover" aria-labelledby="t-cover">
      <h2 id="t-cover">Cover</h2>
      <p class="lab__note">Siempre cuadrada: una imagen que no lo es se recorta al centro. Sin portada o rota, el logo atenuado.</p>
      <div class="lab__covers">
        <figure><Cover src={sampleCover(320, 320, COVER_TONES[0], '1:1')} alt="Portada cuadrada" /><figcaption>Cuadrada</figcaption></figure>
        <figure><Cover src={sampleCover(640, 360, COVER_TONES[1], '16:9')} alt="Portada 16:9 recortada" /><figcaption>16:9, recortada</figcaption></figure>
        <figure><Cover src={sampleCover(300, 480, COVER_TONES[2], '5:8')} alt="Portada vertical recortada" radius="sm" /><figcaption>Vertical, radio sm</figcaption></figure>
        <figure><Cover src={null} alt="Sin portada" /><figcaption>Sin portada</figcaption></figure>
        <figure><Cover src="/img/no-existe.jpg" alt="Portada rota" /><figcaption>Rota</figcaption></figure>
      </div>
      <h3>Con fondo ambiental (el anfitrión recorta)</h3>
      <div class="lab__ambient-host">
        <span class="lab__ambient-cover"><Cover src={sampleCover(640, 360, COVER_TONES[3], '16:9')} alt="" ambient radius="sm" /></span>
        <div class="lab__ambient-text">
          <CreditLine release={CREDIT_SAMPLES[2].release} />
          <strong>Tarjeta de ejemplo</strong>
          <span>2024 · Colombia · Sello independiente</span>
        </div>
      </div>
    </section>

    <!-- ================================================================ -->
    <section class="lab__section" id="creditos" aria-labelledby="t-creditos">
      <h2 id="t-creditos">CreditLine</h2>
      <p class="lab__note">Regla de R2. Los nombres se truncan; "y N más" no. "Varios artistas" solo en Compilado, con todos los créditos en un menú.</p>
      <div class="lab__credits">
        {#each CREDIT_SAMPLES as sample}
          <div class="lab__credit-card">
            <span class="lab__label">{sample.title}</span>
            <CreditLine release={sample.release} />
          </div>
        {/each}
      </div>
      <h3>Ficha: todos los artistas por rol</h3>
      <div class="lab__credits">
        <CreditLine variant="roles" release={CREDIT_SAMPLES[2].release} />
        <CreditLine variant="roles" release={CREDIT_SAMPLES[3].release} />
      </div>
    </section>

    <!-- ================================================================ -->
    <section class="lab__section" id="redes" aria-labelledby="t-redes">
      <h2 id="t-redes">SocialLinks</h2>
      <p class="lab__note">Perfil de ejemplo con las cinco redes; las URL salen de <code>socialLinks()</code> (contrato D1).</p>
      <SocialLinks links={SOCIAL_SAMPLE} label="Redes del perfil de ejemplo" />
      <SocialLinks links={SOCIAL_SAMPLE.slice(1, 3)} size="sm" label="Redes (sm)" newTab />
    </section>
  </div>

  <!-- ================================================================ -->
  <!-- U7: shell y layouts ($lib/layouts) -->
  <div class="lab__u7">
    <section class="lab__section" id="contenedores" aria-labelledby="t-contenedores">
      <h2 id="t-contenedores">Contenedores</h2>
      <p class="lab__note">El ancho incluye el margen lateral (<code>--container-gutter</code>). En una ruta: <code>&lt;Container size&gt;</code>, la prop <code>container</code> de un layout o <code>class="l-container l-container--…"</code>.</p>
      <div class="lab__containers">
        {#each CONTAINERS as item}
          <Container size={item.size} class="lab__container"><span>{item.label}</span></Container>
        {/each}
      </div>
    </section>

    <section class="lab__section" id="menu-cuenta" aria-labelledby="t-menu-cuenta">
      <h2 id="t-menu-cuenta">Menú de cuenta</h2>
      <p class="lab__note"><code>Menu</code> con disparador propio (<code>trigger</code>): avatar y chevron. Grupo con la cuenta y Salir separado, con icono.</p>
      <div class="lab__row">
        <Menu
          label="Cuenta @persona"
          align="start"
          groups={[
            { label: '@persona', items: [{ label: 'Perfil', href: '#menu-cuenta' }, { label: 'Mis colecciones', href: '#menu-cuenta' }, { label: 'Mis aportes', href: '#menu-cuenta' }] },
            { items: [{ label: 'Salir', icon: 'salir', onselect: () => {} }] }
          ]}
        >
          {#snippet trigger()}<span class="lab__avatar" aria-hidden="true">P</span>{/snippet}
        </Menu>
      </div>
    </section>

    <section class="lab__section" id="layout-cuenta" aria-labelledby="t-layout-cuenta">
      <h2 id="t-layout-cuenta">AccountLayout</h2>
      <p class="lab__note">Título, ayuda, formulario y pie. <code>variant="split"</code>: beneficios a la izquierda desde 769 px; en móvil, primero el formulario.</p>
      <div class="lab__frame">
        <AccountLayout variant="split" title="Entrar" help="Con tu usuario o tu correo.">
          {#snippet aside()}
            <ul class="lab__benefits">
              <li><strong>Colecciones</strong> Guarda lanzamientos en listas propias.</li>
              <li><strong>Compártelas</strong> Cada colección pública tiene su enlace.</li>
              <li><strong>Aporta</strong> Sugiere lanzamientos que faltan.</li>
            </ul>
          {/snippet}
          <form class="lab__form" onsubmit={(event) => event.preventDefault()}>
            <Field label="Usuario o correo" />
            <PasswordField label="Contraseña actual" autocomplete="current-password" />
            <Button type="submit" block>Entrar</Button>
          </form>
          {#snippet footer()}
            <a href="#layout-cuenta">Olvidé mi contraseña</a>
            <span aria-hidden="true">·</span>
            <a href="#layout-cuenta">Crear cuenta</a>
          {/snippet}
        </AccountLayout>
      </div>
    </section>

    <section class="lab__section" id="layout-lectura" aria-labelledby="t-layout-lectura">
      <h2 id="t-layout-lectura">ReadingLayout</h2>
      <p class="lab__note">Manual y privacidad. Medida de 68 caracteres, interlineado 1,7 y paso entre secciones de 48. Con <code>toc</code>, índice lateral fijo (desplegable "Contenido" bajo 1024 px).</p>
      <div class="lab__frame">
        <ReadingLayout
          eyebrow="Información"
          title="Título de lectura"
          lead="Entrada un paso más grande que el texto, para orientar antes de empezar."
          meta="Última actualización: 7 de octubre de 2026"
          toc={[{ id: 'lab-lectura-1', label: 'Primera sección' }, { id: 'lab-lectura-2', label: 'Segunda sección' }]}
        >
          <section id="lab-lectura-1">
            <h2>Primera sección</h2>
            <p>Un párrafo de lectura con un <a href="#layout-lectura">enlace</a>, texto en <strong>negrita</strong> y <code>código</code>. La medida limita la línea para que el ojo no se pierda al volver.</p>
            <ul>
              <li>Listas con viñeta en el color de acento.</li>
              <li>Separación regular entre elementos.</li>
            </ul>
          </section>
          <section id="lab-lectura-2">
            <h2>Segunda sección</h2>
            <h3>Subtítulo</h3>
            <p>Las secciones se separan con el paso de lectura.</p>
          </section>
        </ReadingLayout>
      </div>
    </section>

    <section class="lab__section" id="layout-herramienta" aria-labelledby="t-layout-herramienta">
      <h2 id="t-layout-herramienta">ToolLayout</h2>
      <p class="lab__note">El Estudio (U15): barra lateral, ancho completo y densidad compacta. Una sección puede llevar vistas (<code>items</code>) con su tamaño; en móvil no se muestran y la vista ofrece un selector. Con el layout en un <code>+layout.svelte</code>, cada vista pone su <code>ToolHeader</code>.</p>
      <div class="lab__frame">
        <ToolLayout
          name="Estudio"
          current="#incompletos"
          title="Catálogo"
          sections={[
            {
              label: 'Catálogo', href: '#catalogo', icon: 'grilla',
              items: [
                { label: 'Borradores', href: '#borradores', count: 300 },
                { label: 'Incompletos', href: '#incompletos', count: 712 },
                { label: 'Sin portada', href: '#sin-portada', count: 30 },
                { label: 'Con reportes', href: '#con-reportes', count: 15 }
              ]
            },
            { label: 'Propuestas', href: '#propuestas', icon: 'lista', count: 4 },
            { label: 'Reportes', href: '#reportes', icon: 'reportar', count: 2 }
          ]}
        >
          {#snippet actions()}<Button size="sm" icon="agregar">Nuevo lanzamiento</Button>{/snippet}
          <EmptyState message="Contenido de la sección" detail="La tabla del catálogo llega en U15." size="inline" />
        </ToolLayout>
      </div>
    </section>

    <section class="lab__section" id="error-pagina" aria-labelledby="t-error-pagina">
      <h2 id="t-error-pagina">ErrorState como página</h2>
      <p class="lab__note"><code>heading="h1"</code> en <code>+error.svelte</code>: el mensaje es el título de la página.</p>
      <ErrorState heading="h3" message="No encontramos esta página" detail="El enlace puede estar mal escrito o la página ya no existe." actionLabel="Volver al catálogo" actionHref="#error-pagina" />
    </section>
  </div>

  <!-- ================================================================ -->
  <div class="lab__u8">
    <section class="lab__section" id="tarjeta" aria-labelledby="t-tarjeta">
      <h2 id="t-tarjeta">Tarjeta de lanzamiento</h2>
      <p class="lab__note">
        Todas miden lo mismo. Radar: con cursor, al pasar por la portada; con el dedo, el primer toque lo muestra y el segundo abre.
        La grilla nunca pasa de 3 columnas.
      </p>
      <div class="lanzamientos-grilla">
        {#each RELEASE_SAMPLES as release (release.slug)}
          <LanzamientoCard lanzamiento={release} onabrir={(item) => (opened = item.title)} />
        {/each}
      </div>
    </section>

    <section class="lab__section" id="fila" aria-labelledby="t-fila">
      <h2 id="t-fila">Fila (modo lista)</h2>
      <p class="lab__note">Las mismas piezas, densas. En móvil, sin géneros. Sin radar: a 56 px no se lee.</p>
      <div class="lanzamientos-lista">
        {#each RELEASE_SAMPLES as release (release.slug)}
          <LanzamientoFila lanzamiento={release} onabrir={(item) => (opened = item.title)} />
        {/each}
      </div>
      <p class="lab__note" role="status" data-testid="lab-abierto">{opened ? `Abriría la ficha de «${opened}».` : 'Ninguna ficha abierta.'}</p>
    </section>
  </div>

  <!-- ================================================================ -->
  <div class="lab__u14">
    <section class="lab__section" id="interruptor" aria-labelledby="t-interruptor">
      <h2 id="t-interruptor">Interruptor (Checkbox variant="switch")</h2>
      <p class="lab__note">Para preferencias que se aplican al momento. Se anuncia como interruptor; la fila entera es el área táctil.</p>
      <div class="lab__fields">
        <Checkbox variant="switch" bind:checked={switchOn} hint="Quien visite tu perfil ve los lanzamientos que aportaste y el equipo aceptó.">Mostrar mis aportes aceptados</Checkbox>
        <Checkbox variant="switch" bind:checked={switchOff} hint="Solo tú puedes verla.">Colección pública</Checkbox>
        <Checkbox variant="switch" checked disabled>Deshabilitado</Checkbox>
      </div>
    </section>

    <section class="lab__section" id="mosaico" aria-labelledby="t-mosaico">
      <h2 id="t-mosaico">Colección en mosaico</h2>
      <p class="lab__note">4 portadas en el orden de la colección y nombre. Toda la pieza abre; el resto de acciones, en el "…". Vacía: logo atenuado.</p>
      <ul class="lab__mosaics">
        {#each MOSAIC_SAMPLES as sample (sample.crate.id)}
          <li>
            <CollectionTile
              crate={sample.crate}
              covers={sample.covers}
              href="#mosaico"
              showVisibility
              actions={collectionActions(sample.crate.name)}
            />
          </li>
        {/each}
      </ul>
    </section>

    <section class="lab__section" id="sortable-bare" aria-labelledby="t-sortable-bare">
      <h2 id="t-sortable-bare">Sortable sin marco (colección)</h2>
      <p class="lab__note">`bare` y `listClass="lanzamientos-grilla"`: la grilla y la tarjeta de siempre, con el asa sobre la portada.</p>
      <Sortable
        label="Orden de la colección (tarjetas)"
        layout="grid"
        listClass="lanzamientos-grilla"
        bare
        bind:items={collectionCards}
        key={(r) => r.slug}
        itemLabel={(r) => r.title}
      >
        {#snippet item(release)}<LanzamientoCard lanzamiento={release} onabrir={(next) => (opened = next.title)} />{/snippet}
      </Sortable>
    </section>
  </div>

  <!-- U16: extensión del combobox para el editor del Estudio. -->
  <div class="lab__u16">
    <section class="lab__section" id="combobox-sin-chips" aria-labelledby="t-combobox-sin-chips">
      <h2 id="t-combobox-sin-chips">Combobox sin chips</h2>
      <p class="lab__note"><code>chips=&#123;false&#125;</code>: el campo busca y elige, y quien lo usa muestra lo elegido (los créditos del editor, en filas que se arrastran). Elegir una opción marcada la quita.</p>
      <div class="lab__fields">
        <Combobox label="Añadir artista" chips={false} options={artistOptions} bind:value={pickedArtists} allowCreate oncreate={createArtist} placeholder="Buscar artista…" />
      </div>
      <p class="lab__note" aria-live="polite">Elegidos: {pickedArtists.join(', ') || 'ninguno'}</p>
    </section>
  </div>

  <!-- U17: bandeja del Estudio (Propuestas y Reportes). -->
  <div class="lab__u17">
    <section class="lab__section" id="bandeja" aria-labelledby="t-bandeja">
      <h2 id="t-bandeja">Bandeja (InboxLayout)</h2>
      <p class="lab__note">Lista a la izquierda y detalle a la derecha; por debajo de 768, la lista y, al elegir, solo el detalle con "Volver". <code>InboxItem</code> es cada fila (estado, marca y datos); <code>InboxDetail</code> y <code>InboxField</code> el detalle, con "Editado" en lo que difiere de lo detectado.</p>
      <div class="lab__frame lab__inbox" data-density="compact">
        <InboxLayout label="Propuestas de ejemplo" groups={inboxGroups} key={(entry) => entry.id} open={!!inboxCurrent} onback={() => (inboxSelected = null)}>
          {#snippet item(entry)}
            <InboxItem href="#bandeja" title={entry.title} current={entry.id === inboxSelected} status={{ label: entry.status, tone: entry.tone }} flag={entry.flag} meta={entry.meta} onselect={() => (inboxSelected = entry.id)} />
          {/snippet}
          {#snippet detail()}
            {#if inboxCurrent}
              <InboxDetail title={inboxCurrent.title}>
                {#snippet eyebrow()}<Chip kind="status" label={inboxCurrent.status} tone={inboxCurrent.tone} /><span>Enviada el 21 de sept de 2026</span>{/snippet}
                <dl class="l-inbox-fields">
                  <InboxField label="Título" value={inboxCurrent.title} wide mark={{ label: 'Editado', description: 'Difiere de lo que detectó la fuente.' }} />
                  <InboxField label="Artistas principales" value={inboxCurrent.meta[0]} wide />
                  <InboxField label="Tipo" value="Álbum" />
                  <InboxField label="Sello" />
                </dl>
                <div class="l-inbox-note l-inbox-note--empty"><strong>Nota de quien propone</strong><p>Sin nota</p></div>
                {#snippet actions()}
                  <div class="l-inbox-buttons">
                    <Button>Revisar publicación</Button>
                    <Button variant="secondary">Solicitar cambios</Button>
                    <Button variant="destructive">Rechazar</Button>
                  </div>
                {/snippet}
              </InboxDetail>
            {/if}
          {/snippet}
        </InboxLayout>
      </div>
    </section>
  </div>
</div>

<Dialog bind:open={dialogOpen} title="Editar colección" description="El contenido largo hace scroll dentro; cabecera y pie quedan fijos.">
  <div class="lab__dialog-body">
    <Field label="Nombre" value="Para el domingo" />
    <Combobox label="Géneros" options={GENRE_OPTIONS} bind:value={genres} placeholder="Buscar género" />
    <div class="lab__menu-row">
      <span>Menú dentro del diálogo, junto al borde</span>
      <Menu label="Acciones dentro del diálogo" items={collectionActions('diálogo')} />
    </div>
    {#each Array.from({ length: 8 }, (_, i) => i + 1) as paragraph}
      <p>Párrafo {paragraph}. Un diálogo con contenido largo conserva la cabecera con el título y el cierre, y el pie con las acciones; solo el cuerpo se desplaza.</p>
    {/each}
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancelar</Button>
    <Button onclick={() => (dialogOpen = false)}>Guardar</Button>
  {/snippet}
</Dialog>

<Dialog bind:open={confirmOpen} size="sm" title={`¿Eliminar «${confirmTarget}»?`} description="La colección y su orden se borran. No se puede deshacer.">
  <p class="lab__note">Los lanzamientos siguen en el catálogo.</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (confirmOpen = false)}>Cancelar</Button>
    <Button variant="destructive" onclick={() => { lastAction = `Eliminar ${confirmTarget}`; confirmOpen = false; }}>Eliminar</Button>
  {/snippet}
</Dialog>

<Sheet bind:open={sheetOpen} title="Filtros">
  {#snippet header()}
    <div class="lab__band" role="list" aria-label="Filtros activos">
      {#each sheetGenres as genre (genre)}
        <span role="listitem"><Chip kind="filter" label={GENRE_OPTIONS.find((o) => o.value === genre)?.label ?? genre} onremove={() => (sheetGenres = sheetGenres.filter((g) => g !== genre))} /></span>
      {/each}
    </div>
  {/snippet}
  <div class="lab__dialog-body">
    <Combobox label="Géneros" options={GENRE_OPTIONS} bind:value={sheetGenres} placeholder="Buscar género" />
    <Combobox label="Países" options={COUNTRY_OPTIONS} bind:value={countries} placeholder="Buscar país" />
    <h3 class="lab__sheet-heading">Ordenable dentro de la hoja</h3>
    <Sortable label="Orden dentro de la hoja" bind:items={sheetReleases} key={(r) => r.id} itemLabel={(r) => r.title}>
      {#snippet item(release)}
        <div class="lab__release">
          <span class="lab__thumb"><Cover src={release.cover} alt="" /></span>
          <span class="lab__release-text"><strong>{release.title}</strong><span>{release.artist}</span></span>
        </div>
      {/snippet}
    </Sortable>
    {#each Array.from({ length: 4 }, (_, i) => i + 1) as paragraph}
      <p class="lab__note">Contenido {paragraph} para que la hoja llegue a su altura máxima y el cuerpo haga scroll bajo el pie fijo.</p>
    {/each}
  </div>
  {#snippet footer()}
    <Button block onclick={() => (sheetOpen = false)}>Ver 124 lanzamientos</Button>
  {/snippet}
</Sheet>

<Sheet bind:open={shortSheetOpen} title="Compartir colección" description="Altura según contenido.">
  <Field label="Enlace" value="https://discotica.com/coleccion/para-el-domingo" readonly />
  {#snippet footer()}
    <Button block icon="compartir" onclick={() => (shortSheetOpen = false)}>Copiar enlace</Button>
  {/snippet}
</Sheet>

<style>
  .lab { padding-block: var(--space-6) var(--space-8); }

  .lab__containers { display: flex; flex-direction: column; gap: var(--space-2); }
  .lab__containers :global(.lab__container) { padding-block: var(--space-2); background: var(--color-acento-tinte); outline: 1px dashed var(--color-acento-border); }
  .lab__containers span { display: block; padding: var(--space-1) var(--space-2); background: var(--color-superficie-2); color: var(--color-texto-medio); font-size: var(--text-xs); }
  .lab__inbox { padding: var(--space-4); }
  .lab__frame { position: relative; overflow: hidden; border: 1px solid var(--color-linea); border-radius: var(--radius-base); }
  .lab__avatar { display: inline-grid; place-items: center; width: var(--avatar-sm); height: var(--avatar-sm); border: 1px solid var(--color-acento-border); border-radius: 50%; background: var(--color-acento-suave); color: var(--color-acento); font-size: var(--text-2xs); }
  .lab__form { display: flex; flex-direction: column; gap: var(--space-4); }
  .lab__benefits { display: flex; flex-direction: column; gap: var(--space-4); margin: 0; padding: 0; list-style: none; color: var(--color-texto-medio); font-size: var(--text-sm); }
  .lab__benefits strong { display: block; color: var(--color-texto); }

  .lab__intro h1 { margin: 0; font-size: var(--text-display); line-height: 1.1; }
  .lab__intro p { margin: var(--space-2) 0 0; color: var(--color-texto-medio); }

  .lab__section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-top: var(--space-7);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-linea);
  }
  .lab__section h2 { margin: 0; font-size: var(--text-2xl); }
  .lab__section h3 {
    margin: var(--space-3) 0 0;
    color: var(--color-texto-medio);
    font-size: var(--nav-font-size);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    text-transform: var(--nav-text-transform);
  }

  .lab__note { margin: 0; color: var(--color-texto-medio); font-size: var(--text-sm); }
  .lab__note code { font-size: var(--text-code); }

  .lab__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  .lab__matrix { display: flex; flex-direction: column; gap: var(--space-3); }
  .lab__label {
    width: 7rem;
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--nav-letter-spacing);
  }
  .lab__narrow { max-width: 24rem; }
  /* La paginación completa es de desktop; a 390 se desplaza en lugar de ensanchar la página. */
  .lab__scroll { display: flex; flex-direction: column; gap: var(--space-3); overflow-x: auto; padding: var(--space-2); }
  .lab__accent { color: var(--color-acento); }

  .lab__icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lab__icons li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--target-touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-linea-sutil);
    border-radius: var(--radius-sm);
    color: var(--color-texto);
    font-size: var(--text-2xs);
  }
  .lab__icons span { color: var(--color-texto-medio); overflow-wrap: anywhere; }
  .lab__icons .lab__icon--social { color: var(--color-acento); }

  .lab__fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: var(--space-5);
    align-items: start;
  }

  /* Banda horizontal de filtros activos: el padding vertical deja sitio al área táctil. */
  .lab__band {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding: var(--space-2) 0;
    scrollbar-width: none;
  }

  /* Demostración de la línea móvil: paginación compacta y "Ordenar por" (Select, U10). */
  .lab__results-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    max-width: 100%;
  }
  .lab__results-bar > :global(.ui-pagination) { flex: none; }
  .lab__results-bar :global(.lab__sort) { min-width: 0; }

  .lab__loading { display: flex; flex-direction: column; align-items: center; gap: var(--space-5); }
  .lab__cards {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: var(--space-6);
  }
  .lab__rows { display: flex; flex-direction: column; gap: var(--space-2); }

  .lab__states {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: var(--space-5);
    align-items: start;
  }


  /* ---- U6 ---- */
  .lab__menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    max-width: 32rem;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
  }
  /* Simula la tabla del Estudio: overflow en los dos ejes y poca altura. Relativo
     para que el texto sr-only (absoluto) de la cabecera no escape del scroll y
     ensanche el viewport móvil. */
  .lab__table-wrap {
    position: relative;
    max-height: 12rem;
    overflow: auto;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
  }
  .lab__table { width: 100%; min-width: 32rem; border-collapse: collapse; font-size: var(--text-sm); }
  .lab__table th,
  .lab__table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-linea-sutil); text-align: left; }
  .lab__table th { color: var(--color-texto-tenue); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: var(--nav-letter-spacing); }
  .lab__table-actions { width: 1%; text-align: right; }

  .lab__dialog-body { display: flex; flex-direction: column; gap: var(--space-4); }
  .lab__dialog-body p { margin: 0; }
  .lab__sheet-heading {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--nav-font-size);
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }

  .lab__narrow-list { max-width: 36rem; }
  .lab__release { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
  .lab__thumb { width: var(--control-h-xl); flex: none; }
  .lab__release-text { display: flex; flex-direction: column; min-width: 0; font-size: var(--text-sm); }
  .lab__release-text strong { overflow-wrap: anywhere; }
  .lab__release-text span { color: var(--color-texto-medio); font-size: var(--text-xs); }
  .lab__grid-title { display: block; margin-top: var(--space-2); font-size: var(--text-xs); overflow-wrap: anywhere; }

  .lab__covers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-4);
  }
  .lab__covers figure { margin: 0; }
  .lab__covers figcaption { margin-top: var(--space-2); color: var(--color-texto-medio); font-size: var(--text-2xs); }

  /* Anfitrión del fondo ambiental: posicionado, contexto propio y recorte. */
  .lab__ambient-host {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    gap: var(--space-4);
    align-items: center;
    max-width: 32rem;
    padding: var(--space-4);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-base);
    background: var(--color-panel);
  }
  .lab__ambient-cover { width: 7rem; flex: none; }
  .lab__ambient-text { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; font-size: var(--text-sm); }
  .lab__ambient-text span { color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* Ancho de tarjeta: obliga a truncar los nombres largos. */
  .lab__credits {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: var(--space-4);
  }
  .lab__credit-card .lab__label { width: auto; }
  .lab__credit-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-3);
    border: 1px solid var(--color-linea-sutil);
    border-radius: var(--radius-sm);
  }

  @media (max-width: 767px) {
    .lab { padding-inline: var(--space-4); }
  }
  .lab__mosaics {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--mosaic-min-w), 1fr));
    gap: var(--space-6) var(--space-4);
    max-width: 48rem;
  }
</style>
