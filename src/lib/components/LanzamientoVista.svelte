<script>
  import RadarMini from './RadarMini.svelte';
  import { slugify } from '$lib/utils/slugify';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';

  export let lanzamiento;

  let copied = false;
  let showArtistsMenu = false;
  let artistsTriggerEl;
  let artistsMenuEl;

  const safeStr = (v) => (v ?? '').toString();
  const asArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);

  function yearFromDDMMYYYY(raw) {
    const s = safeStr(raw).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return '';
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return y;
  }

  function extraerIdSpotify(url) {
    const match = (url ?? '').toString().match(/album\/([\w\d]+)/);
    return match ? match[1] : '';
  }

  $: cover    = safeStr(lanzamiento?.cover).trim();
  $: title    = safeStr(lanzamiento?.title).trim();
  $: label    = safeStr(lanzamiento?.label).trim();
  $: year     = yearFromDDMMYYYY(lanzamiento?.release_date);
  $: slug     = lanzamiento ? slugFromLanzamiento(lanzamiento) : '';
  $: qs       = $page?.url?.search ?? '';
  $: menuId   = `vista-artists-${slug || 'x'}`;

  $: artistas = asArray(lanzamiento?.artist)
      .map(x => typeof x === 'string' ? x : (x?.name ?? ''))
      .map(x => safeStr(x).trim())
      .filter(Boolean);
  $: manyArtists = artistas.length > 2;

  $: paises  = asArray(lanzamiento?.country).filter(Boolean);
  $: generos = asArray(lanzamiento?.genre).filter(Boolean);

  $: radar = {
    experimental: Number(lanzamiento?.radar?.experimental ?? 0),
    denso:        Number(lanzamiento?.radar?.denso        ?? 0),
    sintetico:    Number(lanzamiento?.radar?.sintetico    ?? 0),
    bailable:     Number(lanzamiento?.radar?.bailable     ?? 0),
    rapido:       Number(lanzamiento?.radar?.rapido       ?? 0),
  };
  $: hasRadar = Object.values(radar).some(v => v > 0);

  $: hasBandcamp   = !!lanzamiento?.buy_link?.includes('bandcamp');
  $: hasSoundcloud = !!lanzamiento?.buy_link?.includes('soundcloud');
  $: hasSpotify    = !!lanzamiento?.buy_link?.includes('spotify');
  $: hasPlayer     = hasBandcamp || hasSoundcloud || hasSpotify;

  // ─── Artists dropdown ───
  function toggleArtistsMenu() {
    showArtistsMenu = !showArtistsMenu;
    if (showArtistsMenu) {
      requestAnimationFrame(() =>
        artistsMenuEl?.querySelector('button[role="menuitem"]')?.focus()
      );
    }
  }

  function closeArtistsMenu() {
    showArtistsMenu = false;
    artistsTriggerEl?.focus();
  }

  function onArtistChosen(nombre) {
    closeArtistsMenu();
    navArtista(nombre);
  }

  function onKeydownMenu(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeArtistsMenu(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(artistsMenuEl?.querySelectorAll('button[role="menuitem"]') ?? []);
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }

  // Dismiss dropdown on click outside — uses a capture listener on the window
  function handleMenuClickOutside(e) {
    if (!showArtistsMenu) return;
    if (!artistsTriggerEl?.contains(e.target) && !artistsMenuEl?.contains(e.target))
      closeArtistsMenu();
  }

  // ─── Navigation ───
  function compartir() {
    const path = `/lanzamiento/${slug}`;
    const base = (() => {
      try {
        const u = new URL(window.location.href);
        u.host = 'biblioteca.discotica.com';
        u.pathname = '/'; u.search = ''; u.hash = '';
        return u.toString().replace(/\/$/, '');
      } catch { return 'https://biblioteca.discotica.com'; }
    })();
    navigator.clipboard?.writeText?.(`${base}${path}`)
      ?.then(() => { copied = true; setTimeout(() => (copied = false), 1500); })
      .catch(() => {});
  }

  function navArtista(a) { goto(`/artista/${slugify(a)}${qs}`); }
  function navSello(l)   { goto(`/sello/${slugify(l)}${qs}`); }

  function navFiltro(key, value) {
    const params = new URLSearchParams(qs.replace(/^\?/, ''));
    params.set(key, value.toString().trim());
    params.delete('p'); params.delete('page');
    goto(`/?${params.toString()}`, { invalidateAll: true });
  }
</script>

<svelte:window on:pointerdown={handleMenuClickOutside} />

<!-- --cover-bg used by .cover-ambient for the blurred ambient background -->
<div class="layout" style="--cover-bg: url('{cover}');">

  <!-- ── Cover: full height, square art centered in blurred column ── -->
  <div class="cover-col">
    <div class="cover-wrap">
      <img class="cover-img" src={cover} alt={`Portada de ${title}`} loading="eager" />

      {#if hasRadar}
        <div class="cover-radar" aria-hidden={true}>
          <div class="radar-zoom"><RadarMini valores={radar} /></div>
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Info ── -->
  <div class="info-col">

    <!-- Artists -->
    <div class="kicker">
      <div class="artistas" style="position: relative;">
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
                >{nombre}</button>
              {/each}
            </div>
          {/if}

        {:else}
          {#each artistas as nombre, i (nombre)}
            <button class="artista-btn" on:click={() => navArtista(nombre)}>{nombre}</button>
            {#if i < artistas.length - 1}<span class="artista-sep">&</span>{/if}
          {/each}
        {/if}
      </div>
    </div>

    <!-- Title -->
    <h2 class="titulo">{title}</h2>

    <!-- Meta -->
    <dl class="meta">
      {#if lanzamiento?.type}
        <div class="meta-row">
          <dt>Tipo</dt>
          <dd>{lanzamiento.type}</dd>
        </div>
      {/if}

      {#if paises.length}
        <div class="meta-row">
          <dt>País</dt>
          <dd>
            {#each paises as c, i (c)}
              <button class="meta-link" on:click={() => navFiltro('pais', c)}>{c}</button>
              {#if i < paises.length - 1}<span class="meta-sep"> / </span>{/if}
            {/each}
          </dd>
        </div>
      {/if}

      {#if label}
        <div class="meta-row">
          <dt>Sello</dt>
          <dd><button class="meta-link" on:click={() => navSello(label)}>{label}</button></dd>
        </div>
      {/if}

      {#if lanzamiento?.release_date}
        <div class="meta-row">
          <dt>Fecha</dt>
          <dd>{lanzamiento.release_date}</dd>
        </div>
      {/if}

      {#if generos.length}
        <div class="meta-row meta-row--genres">
          <dt>Género</dt>
          <dd class="tags">
            {#each generos as g (g)}
              <button class="genre-chip" on:click={() => navFiltro('genero', g)}>{g}</button>
            {/each}
          </dd>
        </div>
      {/if}
    </dl>

    <!-- Review -->
    {#if lanzamiento?.review}
      <blockquote class="review">"{lanzamiento.review}"</blockquote>
    {/if}

    <!-- Player -->
    {#if hasPlayer}
      <div class="player-wrap">
        {#if hasBandcamp}
          {@const bcH = Math.min(380, 100 + ((lanzamiento.track_count || 1) * 55))}
          <iframe
            title="Bandcamp player"
            style:border="0"
            style:width="100%"
            style:height={bcH + 'px'}
            src={`https://bandcamp.com/EmbeddedPlayer/url=${encodeURIComponent(lanzamiento.buy_link)}/size=large/bgcol=111111/linkcol=96f719/artwork=small/transparent=true/`}
            seamless
          ></iframe>
        {:else if hasSoundcloud}
          <iframe
            title="SoundCloud player"
            style:width="100%"
            height="166"
            scrolling="no"
            frameborder="no"
            allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(lanzamiento.buy_link)}&color=%2396f719&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
          ></iframe>
        {:else if hasSpotify}
          <iframe
            title="Spotify player"
            style:border-radius="8px"
            style:width="100%"
            height="200"
            frameBorder="0"
            allow={'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'}
            loading="lazy"
            src={`https://open.spotify.com/embed/album/${extraerIdSpotify(lanzamiento.buy_link)}?utm_source=generator&theme=0`}
          ></iframe>
        {/if}
      </div>
    {/if}

    <!-- Actions -->
    <div class="actions">
      {#if lanzamiento?.buy_link}
        <a class="btn-buy" href={lanzamiento.buy_link} target="_blank" rel="noopener noreferrer">
          Comprar
        </a>
      {/if}

      <button class="btn-share" on:click={compartir} aria-label="Copiar enlace">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden={true}>
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        {#if copied}
          <span class="share-label share-label--ok">Copiado</span>
        {:else}
          <span class="share-label">Compartir</span>
        {/if}
      </button>
    </div>

  </div>
</div>

<style>
  /* ─── Two-column layout ─── */
  .layout {
    display: grid;
    grid-template-columns: 1fr 440px;
    min-height: 100%;
  }

  @media (max-width: 680px) {
    .layout { grid-template-columns: 1fr; padding-top: 1.5rem; }
  }

  /* ─── Cover column ─── */
  .cover-col {
    position: relative;
    background: transparent;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }


  /* Square cover — always 1:1, centered in the column */
  .cover-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    z-index: 1;
    overflow: hidden;
  }

  .cover-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 400ms ease, opacity 300ms ease;
  }

  /* Radar on hover */
  .cover-radar {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.6);
    opacity: 0;
    transition: opacity 250ms ease;
    pointer-events: none;
  }

  .radar-zoom {
    transform: scale(1.7);
    transform-origin: center;
  }

  .cover-wrap:hover .cover-img   { transform: scale(1.04); opacity: 0.12; }
  .cover-wrap:hover .cover-radar { opacity: 1; }

  /* Mobile: constrain cover square to a reasonable size */
  @media (max-width: 680px) {
    .cover-wrap { width: min(82vw, 340px); }
  }

  /* ─── Info column ─── */
  .info-col {
    padding: 2rem 2.25rem 2rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
    min-width: 0;
  }

  @media (max-width: 680px) {
    .info-col { padding: 1.5rem; }
  }

  /* ─── Artists ─── */
  .kicker { padding-right: 2.5rem; } /* space for modal's close button on desktop */

  .artistas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 4px;
  }

  .artista-btn {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-base);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--color-acento);
    opacity: 0.65;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .artista-btn:hover { opacity: 1; }

  .artista-sep { font-size: 0.65rem; color: rgba(248,255,238,.2); }

  .artistas-trigger {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--color-acento);
    opacity: 0.65;
    background: transparent;
    border: 1px solid rgba(150,247,25,.22);
    border-radius: 4px;
    padding: 0.15rem 0.45rem;
    cursor: pointer;
    font-family: var(--font-base);
    transition: opacity .15s, border-color .15s;
  }
  .artistas-trigger:hover,
  .artistas-trigger:focus-visible { opacity: 1; border-color: rgba(150,247,25,.5); outline: none; }

  .artistas-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    background: #1a1a1a;
    border: 1px solid var(--color-borde);
    border-radius: 10px;
    box-shadow: 0 14px 36px rgba(0,0,0,.6);
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
  .artista-item:focus { outline: none; background: rgba(150,247,25,.08); color: var(--color-acento); }

  /* ─── Title ─── */
  .titulo {
    margin: 0;
    font-size: clamp(1.55rem, 3vw, 2.2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--color-texto);
  }

  /* ─── Meta ─── */
  .meta {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 0.65rem;
    align-items: baseline;
  }

  .meta dt {
    font-size: 0.62rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: rgba(248,255,238,.3);
    font-weight: 600;
    white-space: nowrap;
    line-height: 1.6;
  }

  .meta dd {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.55;
    color: rgba(248,255,238,.8);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem;
  }

  .meta-link {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-base);
    font-size: 0.875rem;
    color: rgba(248,255,238,.8);
    cursor: pointer;
    transition: color .15s;
  }
  .meta-link:hover { color: var(--color-acento); }

  .meta-sep { color: rgba(248,255,238,.25); font-size: 0.8rem; }
  .meta-row--genres { align-items: flex-start; }

  .tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }

  .genre-chip {
    appearance: none;
    cursor: pointer;
    font-family: var(--font-base);
    font-size: 0.7rem;
    padding: 0.28rem 0.65rem;
    border-radius: 7px;
    background: rgba(150,247,25,.05);
    color: rgba(150,247,25,.6);
    border: 1px solid rgba(150,247,25,.12);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
    line-height: 1.4;
  }
  .genre-chip:hover {
    background: rgba(150,247,25,.12);
    color: var(--color-acento);
    border-color: rgba(150,247,25,.3);
  }

  /* ─── Review ─── */
  .review {
    margin: 0;
    font-style: italic;
    font-size: 0.9rem;
    line-height: 1.7;
    color: rgba(248,255,238,.45);
    border-left: 2px solid rgba(150,247,25,.22);
    padding-left: 0.9rem;
    quotes: none;
    white-space: pre-wrap;
  }

  /* ─── Player ─── */
  .player-wrap {
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0,0,0,.3);
  }

  .player-wrap iframe { display: block; width: 100%; border: none; }

  /* ─── Actions ─── */
  .actions {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 0.25rem;
  }

  .btn-buy {
    display: inline-flex;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 1.5rem;
    background: var(--color-acento);
    color: #0e0e0e;
    border-radius: 8px;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .btn-buy:hover { background: #baff4e; }

  .btn-share {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-base);
    font-size: 0.82rem;
    font-weight: 500;
    color: rgba(248,255,238,.45);
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    padding: 0.58rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .btn-share:hover {
    background: rgba(150,247,25,.08);
    color: rgba(248,255,238,.8);
    border-color: rgba(150,247,25,.25);
  }

  .share-label--ok { color: var(--color-acento); }
</style>
