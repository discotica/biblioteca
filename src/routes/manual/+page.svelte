<svelte:head>
  <title>Manual — Discótica</title>
  <meta
    name="description"
    content="Manual de uso para explorar, filtrar y descubrir lanzamientos en Discótica."
  />
</svelte:head>

<script>
  import RadarMini from '$lib/components/RadarMini.svelte';
  import { onMount } from 'svelte';

  const secciones = [
    { id: 'intro',    label: 'Qué es' },
    { id: 'busqueda', label: 'Búsqueda' },
    { id: 'filtros',  label: 'Filtros' },
    { id: 'radar',    label: 'Radar' },
    { id: 'orden',    label: 'Orden' },
    { id: 'url',      label: 'Compartir' },
    { id: 'reset',    label: 'Reiniciar' },
    { id: 'tips',     label: 'Tips' },
    { id: 'faq',      label: 'FAQ' },
    { id: 'sugerir',  label: 'Sugerir' }
  ];

  const ejemploClub    = { experimental: 1, denso: 2, sintetico: 3, bailable: 5, rapido: 4 };
  const ejemploAmbient = { experimental: 5, denso: 4, sintetico: 3, bailable: 1, rapido: 2 };
  const ejemploCard    = { experimental: 3, denso: 2, sintetico: 4, bailable: 3, rapido: 2 };
  const ejemploHeader  = { experimental: 4, denso: 3, sintetico: 5, bailable: 3, rapido: 3 };

  let seccionActiva = 'intro';
  let tocMobileAbierto = false;

  function irA(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    seccionActiva = id;
    tocMobileAbierto = false;
  }

  onMount(() => {
    // Scroll spy
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seccionActiva = entry.target.id;
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    secciones.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    });

    // Fade-in al scroll — solo activado tras mount para evitar el flash SSR
    const sectionEls = document.querySelectorAll('.section');
    sectionEls.forEach(el => el.classList.add('anim-ready'));

    const fader = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fader.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06 }
    );
    sectionEls.forEach(el => fader.observe(el));

    return () => { spy.disconnect(); fader.disconnect(); };
  });
</script>

<!-- Backdrop del TOC mobile -->
{#if tocMobileAbierto}
  <div
    class="toc-backdrop"
    role="presentation"
    on:click={() => (tocMobileAbierto = false)}
  ></div>
{/if}

<!-- TOC mobile flotante -->
<div class="toc-mobile" class:open={tocMobileAbierto} aria-hidden={!tocMobileAbierto}>
  <div class="toc-mobile__header">
    <span class="toc-mobile__title">Secciones</span>
    <button
      class="toc-mobile__close"
      type="button"
      aria-label="Cerrar menú"
      on:click={() => (tocMobileAbierto = false)}
    >✕</button>
  </div>
  <nav class="toc-mobile__nav">
    {#each secciones as s}
      <button
        class="toc__link"
        class:active={seccionActiva === s.id}
        type="button"
        on:click={() => irA(s.id)}
      >
        <span class="toc__dot" aria-hidden="true"></span>
        {s.label}
      </button>
    {/each}
  </nav>
</div>

<!-- Botón flotante (solo mobile) -->
<button
  class="toc-fab"
  type="button"
  aria-label="Abrir índice de secciones"
  on:click={() => (tocMobileAbierto = !tocMobileAbierto)}
>
  <span class="toc-fab__dot" aria-hidden="true"></span>
  Secciones
</button>

<!-- ── Página ── -->
<div class="manual container">
  <header class="manual__header" id="top">
    <div class="manual__header-radar" aria-hidden="true">
      <RadarMini valores={ejemploHeader} />
    </div>
    <p class="kicker">Manual de uso</p>
    <h1>Discótica — Biblioteca Musical</h1>
    <p class="lede">
      Un archivo curado de música electrónica sudamericana. Puedes filtrarlo por país, género,
      fecha o tipo. También puedes usar el Radar para explorar por perfil sónico.
    </p>
  </header>

  <div class="manual__grid">

    <!-- TOC desktop (sticky) -->
    <aside class="toc-desktop" aria-label="Tabla de contenidos">
      <div class="toc__panel">
        <p class="toc__heading">Contenido</p>
        <nav class="toc__nav">
          {#each secciones as s}
            <button
              class="toc__link"
              class:active={seccionActiva === s.id}
              type="button"
              on:click={() => irA(s.id)}
            >
              <span class="toc__dot" aria-hidden="true"></span>
              {s.label}
            </button>
          {/each}
        </nav>
      </div>
    </aside>

    <!-- Contenido principal -->
    <main class="content" aria-label="Manual">

      <section class="section" id="intro">
        <h2>Qué es</h2>
        <p>
          Una biblioteca de lanzamientos de música electrónica sudamericana. Puedes filtrar
          y ordenar el catálogo, o usar el Radar para buscar por cómo suena.
        </p>
        <div class="cards">
          <article class="card">
            <h3>Filtros</h3>
            <p>País, género, año, mes y tipo. Selección múltiple en la mayoría.</p>
          </article>
          <article class="card">
            <h3>Orden</h3>
            <p>Por fecha (nuevo a viejo o al revés), o alfabéticamente por artista y título.</p>
          </article>
          <article class="card">
            <h3>Radar</h3>
            <p>Cinco ejes sónicos. Ajustas el perfil que buscas y el catálogo se reorganiza.</p>
          </article>
        </div>
      </section>

      <section class="section" id="busqueda">
        <h2>Búsqueda</h2>
        <p>
          Abre el panel y combina los criterios que quieras. Los cambios se ven en tiempo real:
          mientras ajustas, el catálogo se actualiza. Sin selección activa, estás viendo todo.
        </p>
        <div class="callout">
          <div class="callout__title">Búsqueda por texto</div>
          <div class="callout__body">
            El campo de texto busca en <b>título</b>, <b>sello</b> y <b>artistas</b>. Sirve
            para buscar por nombre, sello o cualquier palabra que recuerdes.
          </div>
        </div>
      </section>

      <section class="section" id="filtros">
        <h2>Filtros</h2>
        <p>
          Los filtros reducen el catálogo a lo que seleccionas. País y género
          aceptan múltiples valores al mismo tiempo.
        </p>
        <div class="steps">
          <div class="step">
            <div class="step__n">1</div>
            <div class="step__txt">
              <b>País</b> y <b>Género</b> aceptan selección múltiple. Si eliges varios,
              aparecen todos los que coincidan con cualquiera de ellos.
            </div>
          </div>
          <div class="step">
            <div class="step__n">2</div>
            <div class="step__txt">
              <b>Año</b> y <b>Mes</b> sirven para buscar por fecha específica.
            </div>
          </div>
          <div class="step">
            <div class="step__n">3</div>
            <div class="step__txt">
              <b>Tipo</b> distingue entre álbum, EP y single cuando está disponible
              en el catálogo.
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="radar">
        <h2>Radar</h2>
        <p>
          El Radar permite explorar el catálogo por perfil sónico. Tiene cinco ejes de 0 a 5.
          Cuando algún eje está por encima de 0, el catálogo se reorganiza para mostrar
          primero los lanzamientos más cercanos a ese perfil.
        </p>

        <div class="callout callout--lime">
          <div class="callout__title">Qué cambia cuando usas el Radar</div>
          <div class="callout__body">
            El listado se reorganiza por proximidad al perfil que configuraste. Los más cercanos
            aparecen primero. Si hay empates, el orden elegido (fecha, artista, título) decide.
          </div>
        </div>

        <div class="radar-demos">
          <div class="radar-demo">
            <RadarMini valores={ejemploClub} />
            <p class="radar-demo__label">Para el dancefloor</p>
            <p class="radar-demo__desc">Bailable ↑ · Rápido ↑ · Experimental ↓</p>
          </div>
          <div class="radar-demo">
            <RadarMini valores={ejemploAmbient} />
            <p class="radar-demo__label">Para la escucha</p>
            <p class="radar-demo__desc">Experimental ↑ · Denso ↑ · Bailable ↓</p>
          </div>
        </div>

        <div class="callout callout--lime callout--radar" style="margin-top: 14px;">
          <div class="callout__radar-visual">
            <RadarMini valores={ejemploCard} />
          </div>
          <div>
            <div class="callout__title">Cómo leer el Radar de una portada</div>
            <div class="callout__body">
              Cada lanzamiento tiene un polígono visible sobre su portada. Ese polígono
              es su perfil sónico. Cuanto más grande el área en un eje, más alta es esa
              cualidad en el lanzamiento.
            </div>
          </div>
        </div>

        <details class="faq">
          <summary>¿Qué pasa si dejo todo en 0? <span class="faq__arrow">›</span></summary>
          <div class="faq__body">El Radar queda inactivo. El catálogo se ordena según el criterio de orden seleccionado.</div>
        </details>
        <details class="faq">
          <summary>¿Por qué aparecen resultados que no parecen exactos? <span class="faq__arrow">›</span></summary>
          <div class="faq__body">
            El sistema amplía el rango cuando hay pocos lanzamientos cercanos al perfil
            configurado. Los más parecidos siguen apareciendo primero.
          </div>
        </details>
      </section>

      <section class="section" id="orden">
        <h2>Orden</h2>
        <p>
          El orden define cómo se presenta el catálogo. Si el Radar está activo,
          el orden actúa como desempate entre lanzamientos con perfil similar.
          Si el Radar está en 0, el orden es el criterio principal.
        </p>
        <div class="cards cards--2">
          <article class="card">
            <h3>Fecha</h3>
            <p>Muestra los lanzamientos de más reciente a más antiguo, o al revés.</p>
          </article>
          <article class="card">
            <h3>Artista / Título</h3>
            <p>Ordena alfabéticamente por artista o por título.</p>
          </article>
        </div>
      </section>

      <section class="section" id="url">
        <h2>Compartir</h2>
        <p>
          Cada configuración de búsqueda genera su propia URL. Si filtras, ajustas el Radar
          y cambias el orden, puedes copiar la URL y compartirla. Quien la abra verá los
          mismos resultados.
        </p>
        <div class="mono">
          <div class="mono__label">Ejemplo</div>
          <pre class="mono__box"><code>?pais=Colombia&genero=Latinclub&texto=tratratrax&orden=fecha-desc&radar_experimental=3</code></pre>
        </div>
        <details class="faq">
          <summary>¿Qué pasa con la paginación? <span class="faq__arrow">›</span></summary>
          <div class="faq__body">
            La URL también guarda la página actual. Al cambiar filtros, el sitio vuelve
            automáticamente a la primera página.
          </div>
        </details>
      </section>

      <section class="section" id="reset">
        <h2>Reiniciar</h2>
        <p>
          El botón <b>Reiniciar filtros</b> limpia todos los filtros, devuelve el Radar
          a 0 y simplifica la URL.
        </p>
        <div class="callout">
          <div class="callout__title">Qué se reinicia</div>
          <div class="callout__body">Filtros, Radar y URL. El catálogo vuelve a mostrarse completo.</div>
        </div>
      </section>

      <section class="section" id="tips">
        <h2>Tips</h2>
        <ul class="bullets">
          <li>Empieza con un solo filtro, país o género, y afina desde ahí.</li>
          <li>Para descubrir: sube 1 o 2 ejes del Radar. Cambios pequeños dan resultados más variados que moverlo todo al máximo.</li>
          <li>Para recorrer el catálogo completo: Radar en 0, orden por fecha descendente.</li>
          <li>Si encontraste algo que te interesa, copia la URL. Tiene toda la búsqueda guardada.</li>
        </ul>
      </section>

      <section class="section" id="faq">
        <h2>FAQ</h2>
        <details class="faq" open>
          <summary>No encuentro nada con ciertos filtros <span class="faq__arrow">›</span></summary>
          <div class="faq__body">
            Quita un filtro a la vez. Combinar texto, fechas y varios países o géneros puede
            dejar el resultado vacío. Conviene empezar con pocos filtros y agregar más
            gradualmente.
          </div>
        </details>
        <details class="faq">
          <summary>¿El Radar filtra o solo ordena? <span class="faq__arrow">›</span></summary>
          <div class="faq__body">
            Solo reordena. Cuando está activo, los lanzamientos más cercanos al perfil
            aparecen primero. Si todos los ejes están en 0, no afecta el resultado.
          </div>
        </details>
      </section>

      <section class="section" id="sugerir">
        <h2>Sugerir un lanzamiento</h2>
        <p>
          El catálogo está abierto. Si hay un lanzamiento de electrónica sudaca que
          debería estar, puedes enviarlo por el formulario de sugerencias.
        </p>
        <div class="callout callout--lime callout--sugerir">
          <div>
            <div class="callout__title">¿Falta algo en el catálogo?</div>
            <div class="callout__body">
              Cualquier artista, sello o escucha puede sugerir un lanzamiento. Completamos
              los datos, asignamos el perfil sónico y lo incorporamos al archivo.
              También puedes escribirnos por Instagram
              <a href="https://www.instagram.com/discotica_/" target="_blank" rel="noopener">@discotica_</a>.
            </div>
          </div>
          <a class="sugerir-btn" href="/sugerir">
            + Sugerir disco
          </a>
        </div>
      </section>

      <footer class="manual__footer">
        <a class="backtop" href="#top">Volver arriba</a>
      </footer>
    </main>
  </div>
</div>

<style>
  @import '$lib/styles/styles.css';

  :global(:root) {
    --manual-fg:     #f8ffee;
    --manual-muted:  rgba(248, 255, 238, .72);
    --manual-border: rgba(248, 255, 238, .12);
    --manual-panel:  rgba(255, 255, 255, .03);
    --manual-lime:   #96f719;
  }

  /* ── Layout ── */

  .manual {
    padding-top:    clamp(18px, 3vw, 34px);
    padding-bottom: clamp(30px, 4vw, 80px);
    max-width: 70%;
    overflow-x: clip;
    box-sizing: border-box;
  }
  @media (max-width: 768px) { .manual { max-width: 100%; } }
  .manual, .manual * { box-sizing: border-box; }

  /* ── Header ── */

  .manual__header {
    position: relative;
    overflow: hidden;
    padding: clamp(20px, 2.5vw, 32px);
    border: 1px solid var(--manual-border);
    border-radius: 18px;
    background: linear-gradient(160deg, rgba(150, 247, 25, .09) 0%, rgba(255, 255, 255, .02) 60%);
    box-shadow: 0 22px 70px rgba(0, 0, 0, .35);
    margin-bottom: clamp(14px, 2.5vw, 22px);
  }

  .manual__header-radar {
    position: absolute;
    top: -28px; right: -20px;
    width: 200px;
    opacity: .13;
    pointer-events: none;
    transform: rotate(15deg);
  }
  @media (max-width: 768px) { .manual__header-radar { display: none; } }

  .kicker {
    margin: 0 0 10px 0;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
    font-size: .78rem;
    color: rgba(150, 247, 25, .95);
  }

  h1 {
    margin: 0 0 10px 0;
    font-size: clamp(1.6rem, 2.3vw, 2.2rem);
    line-height: 1.08;
  }

  .lede {
    margin: 0;
    color: var(--manual-muted);
    max-width: 68ch;
    font-size: 1rem;
    line-height: 1.55;
  }

  /* ── Grid ── */

  .manual__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  @media (min-width: 980px) {
    .manual__grid {
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 20px;
    }
  }

  /* ── TOC Desktop ── */

  .toc-desktop {
    display: none;
  }

  @media (min-width: 980px) {
    .toc-desktop {
      display: block;
      position: sticky;
      top: 72px;
      align-self: start;
      min-width: 0;
    }
  }

  .toc__panel {
    border: 1px solid var(--manual-border);
    border-radius: 16px;
    background: var(--manual-panel);
    overflow: hidden;
    box-shadow: 0 14px 40px rgba(0, 0, 0, .25);
    padding-bottom: 10px;
  }

  .toc__heading {
    margin: 0;
    padding: 14px 16px 10px;
    font-weight: 900;
    font-size: .82rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: rgba(150, 247, 25, .8);
    border-bottom: 1px solid var(--manual-border);
  }

  .toc__nav {
    padding: 8px 8px 0;
    display: grid;
    gap: 3px;
  }

  .toc__link {
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--manual-fg);
    border-radius: 10px;
    padding: 8px 10px;
    cursor: pointer;
    font-family: var(--font-base);
    font-size: .86rem;
    font-weight: 600;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toc__link:hover {
    background: rgba(150, 247, 25, .07);
    border-color: rgba(150, 247, 25, .18);
  }
  .toc__link.active {
    background: rgba(150, 247, 25, .12);
    border-color: rgba(150, 247, 25, .32);
    color: #96f719;
    font-weight: 700;
  }

  .toc__dot {
    width: 6px; height: 6px;
    border-radius: 999px;
    background: rgba(150, 247, 25, .5);
    flex: 0 0 auto;
    transition: background 120ms ease, box-shadow 120ms ease;
  }
  .toc__link.active .toc__dot {
    background: #96f719;
    box-shadow: 0 0 0 3px rgba(150, 247, 25, .2);
  }

  /* ── TOC Mobile (sheet + FAB) ── */

  /* Backdrop */
  :global(.toc-backdrop) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, .55);
    z-index: 90;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  /* Sheet */
  .toc-mobile {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 100;
    background: #181818;
    border-top: 1px solid rgba(150, 247, 25, .2);
    border-radius: 20px 20px 0 0;
    padding: 0 0 env(safe-area-inset-bottom, 16px);
    box-shadow: 0 -16px 48px rgba(0, 0, 0, .55);
    transform: translateY(100%);
    transition: transform 260ms cubic-bezier(0.22, 0.1, 0.25, 1);
    max-height: 75vh;
    overflow-y: auto;
  }
  .toc-mobile.open {
    transform: translateY(0);
  }

  /* Solo visible en mobile */
  @media (min-width: 980px) {
    .toc-mobile { display: none; }
    .toc-fab    { display: none; }
    :global(.toc-backdrop) { display: none !important; }
  }

  .toc-mobile__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 10px;
    border-bottom: 1px solid var(--manual-border);
  }

  .toc-mobile__title {
    font-weight: 900;
    font-size: .82rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: rgba(150, 247, 25, .85);
  }

  .toc-mobile__close {
    background: none;
    border: none;
    color: var(--manual-fg);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 6px;
    opacity: .7;
    font-family: var(--font-base);
  }
  .toc-mobile__close:hover { opacity: 1; }

  .toc-mobile__nav {
    padding: 10px 14px 16px;
    display: grid;
    gap: 4px;
  }

  /* En el sheet mobile los links son más grandes */
  .toc-mobile .toc__link {
    font-size: .92rem;
    padding: 11px 12px;
    border-radius: 12px;
  }

  /* FAB */
  .toc-fab {
    position: fixed;
    bottom: 24px; right: 16px;
    z-index: 80;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #181818;
    border: 1px solid rgba(150, 247, 25, .35);
    border-radius: 999px;
    color: var(--manual-fg);
    font-family: var(--font-base);
    font-size: .82rem;
    font-weight: 800;
    padding: 10px 16px 10px 12px;
    cursor: pointer;
    box-shadow: 0 6px 24px rgba(0, 0, 0, .45), 0 0 0 1px rgba(150, 247, 25, .08);
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease;
    letter-spacing: .03em;
  }
  .toc-fab:hover {
    border-color: rgba(150, 247, 25, .6);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, .5), 0 0 0 1px rgba(150, 247, 25, .15);
  }
  .toc-fab:active { transform: translateY(0); }

  .toc-fab__dot {
    width: 8px; height: 8px;
    border-radius: 999px;
    background: #96f719;
    box-shadow: 0 0 6px rgba(150, 247, 25, .5);
    flex-shrink: 0;
  }

  /* ── Content ── */

  .content {
    border: 1px solid var(--manual-border);
    border-radius: 18px;
    background: rgba(255, 255, 255, .02);
    padding: clamp(16px, 2.2vw, 28px);
    box-shadow: 0 22px 70px rgba(0, 0, 0, .28);
    min-width: 0;
  }

  /* ── Sections ── */

  /* Secciones visibles por defecto (SSR-safe).
     La clase .anim-ready se añade desde JS tras mount,
     activando la animación solo client-side. */
  .section {
    padding: 16px 0 30px 0;
    border-bottom: 1px solid rgba(248, 255, 238, .08);
    min-width: 0;
  }
  .section:last-of-type {
    border-bottom: none;
    padding-bottom: 8px;
  }

  :global(.section.anim-ready) {
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 320ms ease-out, transform 320ms ease-out;
  }
  :global(.section.anim-ready.visible) {
    opacity: 1;
    transform: translateY(0);
  }

  /* h2 con acento lima */
  h2 {
    margin: 0 0 10px 0;
    font-size: 1.18rem;
    letter-spacing: .2px;
  }
  h2::before {
    content: '';
    display: block;
    width: 26px; height: 2px;
    background: #96f719;
    margin-bottom: 9px;
    border-radius: 999px;
  }

  p {
    margin: 0 0 12px 0;
    color: var(--manual-muted);
    line-height: 1.6;
    max-width: 78ch;
  }

  /* ── Cards ── */

  .cards {
    margin-top: 18px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 720px) {
    .cards    { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .cards--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  .card {
    border: 1px solid rgba(248, 255, 238, .10);
    border-radius: 14px;
    background: rgba(255, 255, 255, .025);
    padding: 14px 16px;
    min-width: 0; overflow: hidden;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .card:hover {
    border-color: rgba(150, 247, 25, .2);
    background: rgba(150, 247, 25, .03);
  }
  .card h3 { margin: 0 0 5px 0; font-size: .94rem; font-weight: 800; }
  .card p  { margin: 0; font-size: .88rem; }

  /* ── Callouts ── */

  .callout {
    border: 1px solid rgba(248, 255, 238, .12);
    border-radius: 14px;
    background: rgba(255, 255, 255, .025);
    padding: 14px 16px;
    min-width: 0;
    margin-top: 12px;
  }
  .callout--lime {
    border-color: rgba(150, 247, 25, .28);
    background: rgba(150, 247, 25, .05);
  }
  .callout__title  { font-weight: 800; font-size: .94rem; margin-bottom: 5px; }
  .callout__body   { color: var(--manual-muted); line-height: 1.55; font-size: .9rem; }

  .callout--radar {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .callout__radar-visual { flex: 0 0 88px; width: 88px; }

  @media (max-width: 600px) {
    .callout--radar { flex-direction: column; }
    .callout__radar-visual { width: 76px; }
  }

  /* ── Steps ── */

  .steps { margin-top: 14px; display: grid; gap: 9px; }

  .step {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    border: 1px solid rgba(248, 255, 238, .10);
    border-radius: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, .02);
    min-width: 0;
  }

  .step__n {
    width: 32px; height: 32px;
    border-radius: 999px;
    display: grid; place-items: center;
    background: rgba(150, 247, 25, .10);
    border: 1px solid rgba(150, 247, 25, .28);
    font-weight: 900; font-size: .88rem;
    flex-shrink: 0;
  }

  .step__txt {
    color: var(--manual-muted);
    line-height: 1.55; font-size: .9rem;
    min-width: 0; padding-top: 5px;
  }

  /* ── Radar demos ── */

  .radar-demos {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .radar-demo {
    border: 1px solid rgba(150, 247, 25, .15);
    border-radius: 14px;
    background: rgba(150, 247, 25, .03);
    padding: 16px 12px 12px;
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
    min-width: 0;
  }

  .radar-demo :global(.radar-mini) { max-width: 110px; }

  .radar-demo__label {
    margin: 0; font-size: .82rem; font-weight: 800;
    color: var(--manual-fg); text-align: center; max-width: none;
  }
  .radar-demo__desc {
    margin: 0; font-size: .72rem;
    color: rgba(150, 247, 25, .7); text-align: center; max-width: none;
  }

  /* ── Mono / URL ── */

  .mono { margin-top: 12px; min-width: 0; }

  .mono__label {
    font-size: .78rem; color: rgba(150, 247, 25, .95);
    font-weight: 800; letter-spacing: .05em;
    text-transform: uppercase; margin-bottom: 8px;
  }

  .mono__box {
    margin: 0;
    border: 1px solid rgba(248, 255, 238, .12);
    background: rgba(0, 0, 0, .35);
    border-radius: 12px; padding: 12px 14px;
    overflow: auto; color: rgba(248, 255, 238, .88);
    white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
    font-size: .88em; color: rgba(248, 255, 238, .92);
  }

  /* ── Bullets ── */

  .bullets {
    margin: 0; padding-left: 0; list-style: none;
    color: var(--manual-muted); line-height: 1.6;
    display: grid; gap: 8px; max-width: 78ch;
  }
  .bullets li { display: flex; gap: 10px; align-items: baseline; font-size: .9rem; }
  .bullets li::before { content: '·'; color: #96f719; font-weight: 900; flex-shrink: 0; }

  /* ── FAQ ── */

  .faq {
    margin-top: 9px;
    border: 1px solid rgba(248, 255, 238, .10);
    border-radius: 13px;
    background: rgba(255, 255, 255, .02);
    overflow: hidden; min-width: 0;
    transition: border-color 160ms ease;
  }
  .faq[open] { border-color: rgba(150, 247, 25, .22); }

  .faq summary {
    cursor: pointer; padding: 12px 14px;
    font-weight: 700; font-size: .9rem;
    list-style: none; display: flex;
    justify-content: space-between; align-items: center;
    gap: 10px; user-select: none;
  }
  .faq summary::-webkit-details-marker { display: none; }

  .faq__arrow {
    color: rgba(150, 247, 25, .75); font-size: 1.1rem;
    font-weight: 400; flex-shrink: 0;
    transition: transform 200ms ease; display: inline-block;
  }
  .faq[open] .faq__arrow { transform: rotate(90deg); }

  .faq__body {
    padding: 0 14px 12px; color: var(--manual-muted);
    line-height: 1.55; font-size: .9rem; min-width: 0;
  }
  .faq__body a { color: #96f719; text-underline-offset: 2px; }

  /* ── Sugerir ── */

  .callout--sugerir {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sugerir-btn {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    padding: 10px 20px;
    border-radius: 999px;
    background: rgba(150, 247, 25, .12);
    border: 1px solid rgba(150, 247, 25, .4);
    color: #96f719;
    font-weight: 800;
    font-size: .88rem;
    letter-spacing: .04em;
    text-decoration: none;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .sugerir-btn:hover {
    background: rgba(150, 247, 25, .2);
    border-color: rgba(150, 247, 25, .7);
  }

  /* ── Footer ── */

  .manual__footer { margin-top: 20px; display: flex; justify-content: flex-end; }

  .backtop {
    color: rgba(150, 247, 25, .95); text-decoration: none;
    font-weight: 800; font-size: .88rem;
    border-bottom: 1px solid rgba(150, 247, 25, .35);
    padding-bottom: 2px;
    transition: border-color 120ms ease;
  }
  .backtop:hover { border-bottom-color: rgba(150, 247, 25, .75); }
</style>
