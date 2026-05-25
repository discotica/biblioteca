<script>

  import RadarMini from './RadarMini.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  import { slugify } from '$lib/utils/slugify';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';

  export let lanzamiento;
  export let variant = 'detail';
  export let openInModal = false;

  const dispatch = createEventDispatcher();

  let copied = false;

  // Helpers seguros
  const safeStr = (v) => (v ?? '').toString();
  const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
  const joinMaybe = (v, sep = ', ') => (Array.isArray(v) ? v.join(sep) : safeStr(v));
  const prettyDate = (d) => safeStr(d).trim();

  const getPrimaryArtist = (a) => {
    if (Array.isArray(a)) {
      const first = a[0];
      return typeof first === 'string' ? first : (first?.name ?? '');
    }
    return typeof a === 'string' ? a : (a?.name ?? '');
  };

  function yearFromDDMMYYYY(raw) {
    const s = safeStr(raw).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return '';
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return y;
  }

  function clampList(arr, max = 3) {
    const a = asArray(arr).filter(Boolean);
    if (a.length <= max) return { items: a, more: 0 };
    return { items: a.slice(0, max), more: a.length - max };
  }

  function extraerIdSpotify(url) {
    const match = (url ?? '').toString().match(/album\/([\w\d]+)/);
    return match ? match[1] : '';
  }

  // slug estable
  let slug = '';
  $: slug = lanzamiento ? slugFromLanzamiento(lanzamiento) : '';
  $: hasBandcamp   = !!lanzamiento?.buy_link?.includes('bandcamp');
  $: hasSoundcloud = !!lanzamiento?.buy_link?.includes('soundcloud');
  $: hasSpotify    = !!lanzamiento?.buy_link?.includes('spotify');
  $: hasPlayer     = hasBandcamp || hasSoundcloud || hasSpotify;
  $: qs = $page?.url?.search ?? '';

  // Normalizaciones para blindar rendering
  $: cover = safeStr(lanzamiento?.cover).trim();
  $: title = safeStr(lanzamiento?.title).trim();
  $: label = safeStr(lanzamiento?.label).trim();

  // Radar siempre presente (evita crash en RadarMini si falta radar)
  $: radar = {
    experimental: Number(lanzamiento?.radar?.experimental ?? 0),
    denso: Number(lanzamiento?.radar?.denso ?? 0),
    sintetico: Number(lanzamiento?.radar?.sintetico ?? 0),
    bailable: Number(lanzamiento?.radar?.bailable ?? 0),
    rapido: Number(lanzamiento?.radar?.rapido ?? 0)
  };

  // artistas: soporta strings u objetos {name}
  let artistas = [];
  let manyArtists = false;
  $: artistas = asArray(lanzamiento?.artist)
    .map((x) => (typeof x === 'string' ? x : (x?.name ?? '')))
    .map((x) => safeStr(x).trim())
    .filter(Boolean);

  $: manyArtists = artistas.length > 2;

  // año para grid
  $: year = yearFromDDMMYYYY(lanzamiento?.release_date);

  // clamp para grid
  $: paisesGrid = clampList(lanzamiento?.country, 3);
  $: generosGrid = clampList(lanzamiento?.genre, 3);

  // menú artistas
  let showArtistsMenu = false;
  let artistsTriggerEl;
  let artistsMenuEl;
  $: menuId = `artists-menu-${slug || 'x'}`;

  function toggleArtistsMenu() {
    showArtistsMenu = !showArtistsMenu;
    if (showArtistsMenu) {
      requestAnimationFrame(() => {
        artistsMenuEl?.querySelector('button[role="menuitem"]')?.focus();
      });
    }
  }

  function closeArtistsMenu() {
    showArtistsMenu = false;
    artistsTriggerEl?.focus();
  }

  function onArtistChosen(nombre) {
    closeArtistsMenu();
    irAlArtista(nombre);
  }

  function onKeydownMenu(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeArtistsMenu();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(artistsMenuEl?.querySelectorAll('button[role="menuitem"]') ?? []);
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = (i + dir + items.length) % items.length;
      items[next]?.focus();
    }
  }

  function handleClickOutside(e) {
    if (!showArtistsMenu) return;
    const insideTrigger = artistsTriggerEl?.contains?.(e.target);
    const insideMenu = artistsMenuEl?.contains?.(e.target);
    if (!insideTrigger && !insideMenu) closeArtistsMenu();
  }

  onMount(() => {
    document.addEventListener('pointerdown', handleClickOutside, true);
    return () => document.removeEventListener('pointerdown', handleClickOutside, true);
  });

function compartir() {
  const path = `/?modal=${slug}`;

  // Base: usa el origin actual si existe, pero fuerza el dominio final
  const base = (() => {
    try {
      // En browser: toma protocolo real (http/https), luego fuerza host
      const u = new URL(window.location.href);
      u.host = 'biblioteca.discotica.com';
      u.pathname = '/';
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, ''); // sin slash final
    } catch {
      // fallback ultra seguro
      return 'https://biblioteca.discotica.com';
    }
  })();

  const url = `${base}${path}`;

  navigator.clipboard?.writeText?.(url)
    ?.then(() => {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    })
    .catch(() => {});
}


  function irAlArtista(artist) {
    goto(`/artista/${slugify(artist)}${qs}`);
  }

  function irAlSello(labelStr) {
    goto(`/sello/${slugify(labelStr)}${qs}`);
  }

  // ─────────────────────────────────────────────
  // Navegación a búsqueda con filtros (género / país)
  // Importante: NO setear p=1 -> evita volver a "mostrando 12"
  // ─────────────────────────────────────────────
  function buildSearchHrefWithParam(key, value) {
    const v = safeStr(value).trim();
    const params = new URLSearchParams($page?.url?.search ?? '');

    params.set(key, v);

    // Mantener el modo sin paginación (si tu buscador usa p= para paginar)
    params.delete('p');
    params.delete('page');
    params.delete('offset');

    const q = params.toString();
    return q ? `/?${q}` : '/';
  }

  function irABusquedaConFiltro(key, value) {
    goto(buildSearchHrefWithParam(key, value), { invalidateAll: true });
  }

  function onFiltroClick(key, value, event) {
    event.preventDefault();
    event.stopPropagation();
    irABusquedaConFiltro(key, value);
  }

  function isInteractiveTarget(el) {
    return !!el?.closest?.(
      'a, button, [role="menu"], [role="menuitem"], .artistas-menu, .artistas-trigger, .share-button, .buy-link, .meta-link'
    );
  }

  function handleCardClick(event) {
    if (variant !== 'grid') return;
    if (event.defaultPrevented) return;
    if (isInteractiveTarget(event.target)) return;
    if (!slug) return;
    if (openInModal) {
      dispatch('abrir', lanzamiento);
    } else {
      goto(`/lanzamiento/${slug}${qs}`);
    }
  }

  function handleDetailNav(event) {
    if (!openInModal) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch('abrir', lanzamiento);
  }

  let pressedArtist = '';

  function onArtistClick(nombre, event) {
    event.preventDefault();
    event.stopPropagation();
    pressedArtist = nombre;
    setTimeout(() => (pressedArtist = ''), 120);
    irAlArtista(nombre);
  }
</script>


<article
  class="card card--{variant} {$$props.class}"
  class:card--menu-open={showArtistsMenu}
  style={`--fondo-cover: url('${cover}')`}
  on:click={handleCardClick}
>
  <header class="cover-container">
    <a class="cover-link" href={`/lanzamiento/${slug}${qs}`} aria-label={`Abrir ${title || 'lanzamiento'}`} on:click={handleDetailNav}>
      <img
        class="cover"
        src={cover}
        alt={`Portada de ${title || 'lanzamiento'}`}
        loading="lazy"
        decoding="async"
      />
    </a>

    <div class="cover-dim" aria-hidden={true}></div>

    <div class="radar-overlay" aria-hidden={true} on:click={handleDetailNav}>
      <div class="radar-scale">
        <RadarMini valores={radar} />
      </div>
    </div>
  </header>

  {#if variant === 'grid'}
    <!-- GRID -->
    <section class="info info--grid">

      <!-- Row 1: Artist -->
      <div class="grid-artist">
        {#if manyArtists}
          <button
            class="artistas-trigger"
            bind:this={artistsTriggerEl}
            aria-haspopup="true"
            aria-expanded={showArtistsMenu}
            aria-controls={menuId}
            on:click|preventDefault|stopPropagation={toggleArtistsMenu}
          >
            Varios artistas <span aria-hidden={true}>▾</span>
          </button>

          {#if showArtistsMenu}
            <div
              class="artistas-menu"
              role="menu"
              id={menuId}
              tabindex="-1"
              bind:this={artistsMenuEl}
              on:keydown={onKeydownMenu}
            >
              {#each artistas as nombre (nombre)}
                <button
                  role="menuitem"
                  class="artista-item"
                  on:click|stopPropagation={() => onArtistChosen(nombre)}
                >
                  {nombre}
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          {#each artistas as nombre, i (nombre)}
            <a
              class="artista-link {pressedArtist === nombre ? 'is-pressed' : ''}"
              href={`/artista/${slugify(nombre)}${qs}`}
              on:click={(e) => onArtistClick(nombre, e)}
            >{nombre}</a>{#if i < artistas.length - 1}<span class="sep">,&nbsp;</span>{/if}
          {/each}
        {/if}
      </div>

      <!-- Row 2: Title + Share -->
      <div class="grid-title">
        <h3 class="titulo titulo--grid">
          <a
            class="titulo-link"
            href={`/lanzamiento/${slug}${qs}`}
            on:click|preventDefault={(e) => openInModal ? dispatch('abrir', lanzamiento) : goto(`/lanzamiento/${slug}${qs}`)}
            aria-label={`Abrir ${title || 'lanzamiento'}`}
          >
            {title}
          </a>
        </h3>

        <button
          class="share-button share-button--grid"
          type="button"
          on:click|stopPropagation={compartir}
          aria-label="Copiar enlace"
        >
          <img src="/img/share.svg" alt="" aria-hidden={true} />
          {#if copied}
            <span class="tooltip" role="status" aria-live="polite">Copiado</span>
          {/if}
        </button>
      </div>

      <!-- Row 3: Year · Country · Label -->
      <div class="grid-meta-row">
        {#if year}<span class="year">{year}</span>{/if}
        {#each paisesGrid.items.slice(0,1) as c (`kr-pais-${c}`)}
          <a
            class="kicker-meta kicker-meta--pais"
            href={buildSearchHrefWithParam('pais', c)}
            on:click={(e) => onFiltroClick('pais', c, e)}
          >{c}</a>
        {/each}
        {#if label}
          <a
            class="kicker-meta kicker-meta--sello"
            href={`/sello/${slugify(label)}${qs}`}
            on:click|preventDefault|stopPropagation={() => irAlSello(label)}
          >{label}</a>
        {/if}
      </div>

      <div class="chips-meta">
        {#each generosGrid.items as g (`gen-${g}`)}
          <a
            class="chip-meta chip-meta--genero"
            href={buildSearchHrefWithParam('genero', g)}
            on:click={(e) => onFiltroClick('genero', g, e)}
          >{g}</a>
        {/each}
        {#if generosGrid.more}<span class="chip-more">+{generosGrid.more}</span>{/if}
      </div>
    </section>

  {:else}
    <!-- DETAIL -->
    <section class="info info--detail">
      <div class="top">
        <div class="kicker">
          <div class="artistas">
            {#if manyArtists}
              <button
                class="artistas-trigger"
                bind:this={artistsTriggerEl}
                aria-haspopup="true"
                aria-expanded={showArtistsMenu}
                aria-controls={menuId}
                on:click|preventDefault|stopPropagation={toggleArtistsMenu}
              >
                Varios artistas <span aria-hidden={true}>▾</span>
              </button>

              {#if showArtistsMenu}
                <div
                  class="artistas-menu"
                  role="menu"
                  id={menuId}
                  tabindex="-1"
                  bind:this={artistsMenuEl}
                  on:keydown={onKeydownMenu}
                >
                  {#each artistas as nombre, i (`${nombre}-${i}`)}
                    <button
                      role="menuitem"
                      class="artista-item"
                      on:click|stopPropagation={() => onArtistChosen(nombre)}
                    >
                      {nombre}
                    </button>
                  {/each}
                </div>
              {/if}
            {:else}
              {#each artistas as nombre, i (`${nombre}-${i}`)}
                <a
                  class="artista-link"
                  href={`/artista/${slugify(nombre)}${qs}`}
                  on:click|preventDefault={() => irAlArtista(nombre)}
                >
                  {nombre}
                </a>{#if i < artistas.length - 1}<span class="sep">,</span>{/if}
              {/each}
            {/if}
          </div>

        </div>

        <h3 class="titulo">
          <a
            class="titulo-link"
            href={`/lanzamiento/${slug}${qs}`}
            on:click|preventDefault={(e) => openInModal ? dispatch('abrir', lanzamiento) : goto(`/lanzamiento/${slug}${qs}`)}
          >
            {title}
          </a>
        </h3>
      </div>

      <dl class="meta">
        {#if lanzamiento?.type}
          <div class="meta-row">
            <dt>Tipo</dt>
            <dd>{lanzamiento.type}</dd>
          </div>
        {/if}

        {#if lanzamiento?.country}
          <div class="meta-row">
            <dt>País</dt>
            <dd>
              {#each asArray(lanzamiento?.country).filter(Boolean) as c, i (`detail-country-${c}-${i}`)}
                <a
                  class="meta-link"
                  href={buildSearchHrefWithParam('pais', c)}
                  on:click={(e) => onFiltroClick('pais', c, e)}
                >
                  {c}
                </a>
                {#if i < asArray(lanzamiento?.country).filter(Boolean).length - 1}
                  <span class="sep"> / </span>
                {/if}
              {/each}
            </dd>
          </div>
        {/if}

{#if lanzamiento?.genre}
  <div class="meta-row">
    <dt>Género</dt>
    <dd class="tags">
      {#each asArray(lanzamiento?.genre).filter(Boolean) as g, i (`detail-genre-${g}-${i}`)}
        <a
          class="tag"
          href={buildSearchHrefWithParam('genero', g)}
          on:click|preventDefault|stopPropagation={(e) => onFiltroClick('genero', g, e)}
        >
          {g}
        </a>
      {/each}
    </dd>
  </div>
{/if}

        {#if label}
          <div class="meta-row">
            <dt>Sello</dt>
            <dd>
              <a
                class="meta-link"
                href={`/sello/${slugify(label)}${qs}`}
                on:click|preventDefault={() => irAlSello(label)}
              >
                {label}
              </a>
            </dd>
          </div>
        {/if}

        {#if lanzamiento?.release_date}
          <div class="meta-row">
            <dt>Fecha</dt>
            <dd>{prettyDate(lanzamiento.release_date)}</dd>
          </div>
        {/if}
      </dl>

      {#if lanzamiento?.review}
        <blockquote class=”review”>”{lanzamiento.review}”</blockquote>
      {/if}

      {#if hasPlayer}
        <div class=”detail-player”>
          {#if hasBandcamp}
            {@const bcH = Math.min(380, 100 + ((lanzamiento.track_count || 1) * 55))}
            <iframe
              title=”Bandcamp player”
              style:border=”0”
              style:width=”100%”
              style:height={bcH + 'px'}
              src={`https://bandcamp.com/EmbeddedPlayer/url=${encodeURIComponent(lanzamiento.buy_link)}/size=large/bgcol=111111/linkcol=96f719/artwork=small/transparent=true/`}
              seamless
            ></iframe>
          {:else if hasSoundcloud}
            <iframe
              title=”SoundCloud player”
              style:width=”100%”
              height=”120”
              scrolling=”no”
              frameborder=”no”
              allow=”autoplay”
              src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(lanzamiento.buy_link)}&color=%2396f719&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
            ></iframe>
          {:else if hasSpotify}
            <iframe
              title=”Spotify player”
              style:border-radius=”8px”
              style:width=”100%”
              height=”152”
              frameBorder=”0”
              allow={'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'}
              loading=”lazy”
              src={`https://open.spotify.com/embed/album/${extraerIdSpotify(lanzamiento.buy_link)}?utm_source=generator&theme=0`}
            ></iframe>
          {/if}
        </div>
      {/if}

      <div class=”acciones”>
        {#if lanzamiento?.buy_link}
          <a class=”buy-link” href={lanzamiento.buy_link} target=”_blank” rel=”noopener noreferrer”>
            Comprar
          </a>
        {/if}

        <button
          class=”share-button share-button--detail”
          type=”button”
          on:click|stopPropagation={compartir}
          aria-label=”Copiar enlace”
        >
          <img src=”/img/share.svg” alt=”” aria-hidden={true} />
          {#if copied}
            <span class=”tooltip” role=”status” aria-live=”polite”>Copiado</span>
          {/if}
        </button>
      </div>
    </section>
  {/if}
</article>


<style>
  /* ─── Shell ─── */
  .card {
    display: flex;
    flex-direction: column;
    background: var(--color-panel);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-base);
    width: 100%;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    padding: 0;
    margin: 0;
  }

  /* Blurred ambient cover behind the card */
  .card::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: var(--fondo-cover);
    background-size: cover;
    background-position: center;
    opacity: 0.14;
    filter: blur(55px) saturate(1.3);
    z-index: 0;
    pointer-events: none;
    transition: opacity 350ms ease;
  }

  /* ─── Cover image area ─── */
  .cover-container {
    position: relative;
    z-index: 1;
    overflow: hidden;
    background: #111;
  }

  .cover-container::before {
    content: "";
    display: block;
    padding-top: 100%;
  }

  .cover-link {
    position: absolute;
    inset: 0;
    display: block;
    z-index: 1;
  }

  .cover {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    z-index: 1;
    transition: transform 400ms cubic-bezier(.25,.1,.25,1), opacity 300ms ease;
  }

  .cover-dim {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: rgba(0,0,0,0);
    transition: background .25s ease;
    pointer-events: none;
  }

  .radar-overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity .25s ease;
    pointer-events: none;
  }
  .radar-overlay * { pointer-events: none; }

  @media (pointer: coarse) {
    .radar-overlay {
      pointer-events: auto;
      cursor: pointer;
    }
  }

  .radar-scale {
    transform: scale(1.6);
    transition: transform .25s ease;
  }

  .cover-container:hover .cover       { transform: scale(1.05); opacity: .18; }
  .cover-container:hover .cover-dim   { background: rgba(0,0,0,.5); }
  .cover-container:hover .radar-overlay { opacity: 1; }

  /* ─── GRID variant ─── */
  .card--grid {
    cursor: pointer;
    /* overflow: visible so the artist dropdown isn't clipped;
       cover-container keeps its own overflow:hidden for the image */
    overflow: visible;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .card--grid:hover {
    border-color: var(--color-borde-hover);
    box-shadow: 0 8px 32px rgba(0,0,0,.5);
  }

  .card--menu-open {
    z-index: 10;
  }

  .card--grid:hover::before { opacity: 0.22; }

  .info--grid {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px 16px 15px;
  }

  /* Row 1: artist (full width, bigger) */
  .grid-artist {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 3px;
    min-height: 20px;
  }

  .artista-link {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-acento);
    opacity: 0.75;
    text-decoration: none;
    transition: opacity 0.15s;
    font-family: var(--font-base);
  }
  .artista-link:hover,
  .artista-link.is-pressed { opacity: 1; }

  .sep { color: rgba(248,255,238,.2); font-size: 0.78rem; }

  /* Row 2: title + share */
  .grid-title {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .titulo--grid {
    flex: 1;
    font-size: clamp(0.95rem, 1.5vw, 1.15rem);
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: -0.005em;
    margin: 0;
    font-style: normal;
    color: var(--color-texto);
  }

  /* Row 3: year · country · label */
  .grid-meta-row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .year {
    font-size: 0.67rem;
    font-weight: 400;
    color: rgba(248,255,238,.3);
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  .kicker-meta {
    font-size: 0.67rem;
    font-weight: 500;
    color: rgba(248,255,238,.32);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    transition: color .15s;
    font-family: var(--font-base);
  }
  .kicker-meta:hover { color: rgba(248,255,238,.65); }

  .kicker-meta--pais { color: rgba(248,255,238,.32); }

  .kicker-meta--sello {
    font-style: italic;
    color: rgba(248,255,238,.26);
  }
  .kicker-meta--sello:hover { color: rgba(248,255,238,.55); }

  /* dot separator between every meta-row item except the last */
  .grid-meta-row > :not(:last-child)::after {
    content: "·";
    margin-left: 5px;
    color: rgba(248,255,238,.15);
    font-style: normal;
    pointer-events: none;
  }

  /* Chip meta row (replaces 3-col dl) */
  .chips-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-top: 1px;
  }

  .chip-meta {
    font-size: 0.68rem;
    color: rgba(248,255,238,.38);
    text-decoration: none;
    padding: 2px 7px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: rgba(255,255,255,.03);
    line-height: 1.45;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    white-space: nowrap;
    font-family: var(--font-base);
  }
  .chip-meta:hover {
    color: rgba(248,255,238,.7);
    border-color: rgba(248,255,238,.1);
    background: rgba(255,255,255,.06);
  }

  .chip-meta--genero {
    color: rgba(150,247,25,.55);
  }
  .chip-meta--genero:hover {
    color: rgba(150,247,25,.9);
    border-color: rgba(150,247,25,.2);
    background: rgba(150,247,25,.05);
  }

  .chip-more {
    font-size: 0.62rem;
    font-weight: 700;
    color: rgba(248,255,238,.25);
    border: 1px solid rgba(248,255,238,.07);
    padding: 2px 5px;
    border-radius: 999px;
    white-space: nowrap;
    align-self: center;
  }

  /* ─── Shared artist menu ─── */
  .artistas-trigger {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-acento);
    opacity: 0.75;
    background: transparent;
    border: 1px solid rgba(150,247,25,.2);
    border-radius: 4px;
    padding: 0.15rem 0.45rem;
    cursor: pointer;
    line-height: 1.4;
    font-family: var(--font-base);
    transition: opacity .15s, border-color .15s;
  }
  .artistas-trigger:hover,
  .artistas-trigger:focus-visible {
    opacity: 1;
    border-color: rgba(150,247,25,.5);
    outline: none;
  }
  .artistas-trigger:active { opacity: 1; }

  .artistas-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    background: #1a1a1a;
    border: 1px solid var(--color-borde);
    border-radius: 10px;
    box-shadow: 0 14px 36px rgba(0,0,0,.55);
    min-width: 190px;
    max-width: min(80vw, 300px);
    max-height: 210px;
    overflow-y: auto;
    padding: 4px;
  }

  .artista-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.5rem 0.65rem;
    border-radius: 7px;
    color: var(--color-texto);
    cursor: pointer;
    font-family: var(--font-base);
    font-size: 0.85rem;
    transition: background .12s;
  }
  .artista-item:hover,
  .artista-item:focus {
    outline: none;
    background: rgba(150,247,25,.08);
    color: var(--color-acento);
  }

  /* ─── Share button ─── */
  .share-button {
    position: relative;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .share-button--grid {
    background: var(--color-acento);
    border: none;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    padding: 0;
    border-radius: 5px;
    margin-top: 1px;
    transition: background .15s, transform .1s;
  }
  .share-button--grid:hover { background: #baff4e; transform: scale(1.06); }
  .share-button--grid img  { width: 11px; height: 11px; filter: brightness(0.2); }

  .share-button--detail {
    background: rgba(255,255,255,.06);
    border: 1px solid var(--color-borde);
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 8px;
    transition: background .15s, border-color .15s;
  }
  .share-button--detail:hover {
    background: rgba(150,247,25,.1);
    border-color: var(--color-acento-border);
  }
  .share-button--detail img {
    width: 15px;
    height: 15px;
    filter: brightness(0) invert(1) opacity(.55);
  }

  .tooltip {
    position: absolute;
    bottom: 110%;
    right: 0;
    background: #1e1e1e;
    border: 1px solid var(--color-borde);
    color: var(--color-texto-secundario);
    font-size: 0.7rem;
    padding: 0.2rem 0.45rem;
    border-radius: 6px;
    white-space: nowrap;
    z-index: 10;
  }

  /* ─── DETAIL variant ─── */
  .card--detail {
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
  }

  .info--detail {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0 0.15rem;
  }

  .top  { display: flex; flex-direction: column; gap: 0.3rem; }

  .kicker {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .card--detail .artistas { gap: 0 3px; }

  .card--detail .artista-link {
    font-size: 0.8rem;
    font-weight: 700;
    opacity: 0.8;
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .card--detail .artistas-trigger {
    font-size: 0.8rem;
    text-transform: none;
    letter-spacing: 0.02em;
    opacity: 0.8;
  }

  .type {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    border: 1px solid rgba(248,255,238,.12);
    background: rgba(248,255,238,.03);
    color: rgba(248,255,238,.45);
    line-height: 1;
  }

  .titulo {
    margin: 0;
    line-height: 1.1;
    font-size: clamp(1.55rem, 2.2vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.015em;
    color: var(--color-texto);
  }

  .titulo-link {
    text-decoration: none;
    color: inherit;
    transition: color .15s;
  }
  .titulo-link:hover { color: rgba(248,255,238,.75); }

  .acciones {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .buy-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    padding: 0.55rem 1.35rem;
    background: var(--color-acento);
    color: #0e0e0e;
    border-radius: 8px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: background .15s;
  }
  .buy-link:hover { background: #baff4e; }

  /* Meta (detail) */
  .meta {
    margin: 0;
    display: grid;
    gap: 0.55rem;
    padding-top: 0.1rem;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 0.65rem;
    align-items: baseline;
  }

  .meta dt {
    font-size: 0.62rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: rgba(248,255,238,.32);
    font-weight: 600;
    line-height: 1.6;
  }

  .meta dd {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.55;
    color: rgba(248,255,238,.85);
  }

  .meta-link {
    color: rgba(248,255,238,.75);
    text-decoration: none;
    transition: color .15s;
  }
  .meta-link:hover { color: var(--color-acento); }

  /* Genre tags */
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0;
  }

  .tag {
    font-size: 0.73rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    background: rgba(10,10,10,.5);
    border: 1px solid rgba(248,255,238,.1);
    color: rgba(248,255,238,.65);
    text-decoration: none;
    transition: background .15s, border-color .15s, color .15s;
    line-height: 1;
  }
  .tag:hover {
    background: rgba(150,247,25,.07);
    border-color: rgba(150,247,25,.3);
    color: var(--color-acento);
  }
  .tag:active { transform: translateY(1px); }
  .tag:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(150,247,25,.2);
  }

  /* Radar display in detail */
  .detail-bottom {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
  }

  .radar-display {
    flex-shrink: 0;
    width: 96px;
  }

  /* Review */
  .review {
    flex: 1;
    margin: 0;
    padding: 0;
    font-style: italic;
    font-size: 0.9rem;
    line-height: 1.6;
    color: rgba(248,255,238,.5);
    border-left: 2px solid rgba(150,247,25,.28);
    padding-left: 0.85rem;
    quotes: none;
    white-space: pre-wrap;
    align-self: center;
  }

  /* Inline player in detail variant */
  .detail-player {
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0,0,0,.25);
  }

  .detail-player iframe {
    display: block;
    width: 100%;
    border: none;
  }

  /* Wider meta on large screens */
  @media (min-width: 840px) {
    .card--detail .meta { grid-template-columns: 1fr 1fr; column-gap: 1.25rem; }
    .card--detail .meta-row { grid-template-columns: 68px 1fr; }
  }

  /* detail-bottom: stack on narrow screens */
  @media (max-width: 600px) {
    .detail-bottom { flex-direction: column; }
    .radar-display { width: 100px; }
  }
</style>
