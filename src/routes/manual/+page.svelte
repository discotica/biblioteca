<script>
  import RadarMini from '$lib/components/RadarMini.svelte';
  import ReadingLayout from '$lib/layouts/ReadingLayout.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Icon from '$lib/ui/Icon.svelte';

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
</script>

<svelte:head>
  <title>Manual — Discótica</title>
  <meta
    name="description"
    content="Manual de uso para explorar, filtrar y descubrir lanzamientos en Discótica."
  />
</svelte:head>

<ReadingLayout
  eyebrow="Manual de uso"
  title="Discótica — Biblioteca Musical"
  lead="Un archivo curado de música electrónica sudamericana. Puedes filtrarlo por país, género, fecha o tipo. También puedes usar el Radar para explorar por perfil sónico."
  toc={secciones}
>
  {#snippet aside()}
    <div class="manual__radar"><RadarMini valores={ejemploHeader} /></div>
  {/snippet}

  <section id="intro">
    <h2>Qué es</h2>
    <p>
      Una biblioteca de lanzamientos de música electrónica sudamericana. Puedes filtrar
      y ordenar el catálogo, o usar el Radar para buscar por cómo suena.
    </p>
    <div class="cards">
      <article class="manual-card">
        <h3>Filtros</h3>
        <p>País, género, año y tipo. Selección múltiple en la mayoría.</p>
      </article>
      <article class="manual-card">
        <h3>Orden</h3>
        <p>Por mejor coincidencia, proximidad Radar o fecha.</p>
      </article>
      <article class="manual-card">
        <h3>Radar</h3>
        <p>Cinco ejes sónicos. Ajustas el perfil que buscas y el catálogo se reorganiza.</p>
      </article>
    </div>
  </section>

  <section id="busqueda">
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

  <section id="filtros">
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
          <b>Año</b> sirve para buscar por fecha específica.
        </div>
      </div>
      <div class="step">
        <div class="step__n">3</div>
        <div class="step__txt">
          <b>Tipo</b> distingue entre Álbum, EP, Single, Compilado y Sample Pack.
        </div>
      </div>
    </div>
  </section>

  <section id="radar">
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

    <div class="callout callout--lime callout--radar">
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
      <summary>¿Qué pasa si dejo todo en 0? <span class="faq__arrow" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span></summary>
      <div class="faq__body">El Radar queda inactivo. El catálogo se ordena según el criterio de orden seleccionado.</div>
    </details>
    <details class="faq">
      <summary>¿Por qué aparecen resultados que no parecen exactos? <span class="faq__arrow" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span></summary>
      <div class="faq__body">
        Cada eje activo admite como máximo una unidad de diferencia. El sistema no amplía
        ese margen para rellenar resultados.
      </div>
    </details>
  </section>

  <section id="orden">
    <h2>Orden</h2>
    <p>
      El orden define cómo se presenta el catálogo. Si el Radar está activo,
      se ofrece el orden Radar. Con texto o filtros, la opción predeterminada es
      Mejor coincidencia; sin criterios, es Más reciente.
    </p>
    <div class="cards cards--2">
      <article class="manual-card">
        <h3>Fecha</h3>
        <p>Muestra los lanzamientos de más reciente a más antiguo, o al revés.</p>
      </article>
      <article class="manual-card">
        <h3>Coincidencia / Radar</h3>
        <p>Los resultados exactos siempre aparecen antes de los aproximados.</p>
      </article>
    </div>
  </section>

  <section id="url">
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
      <summary>¿Qué pasa con la paginación? <span class="faq__arrow" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span></summary>
      <div class="faq__body">
        La URL también guarda la página actual. Al cambiar filtros, el sitio vuelve
        automáticamente a la primera página.
      </div>
    </details>
  </section>

  <section id="reset">
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

  <section id="tips">
    <h2>Tips</h2>
    <ul>
      <li>Empieza con un solo filtro, país o género, y afina desde ahí.</li>
      <li>Para descubrir: sube 1 o 2 ejes del Radar. Cambios pequeños dan resultados más variados que moverlo todo al máximo.</li>
      <li>Para recorrer el catálogo completo: Radar en 0, orden por fecha descendente.</li>
      <li>Si encontraste algo que te interesa, copia la URL. Tiene toda la búsqueda guardada.</li>
    </ul>
  </section>

  <section id="faq">
    <h2>FAQ</h2>
    <details class="faq" open>
      <summary>No encuentro nada con ciertos filtros <span class="faq__arrow" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span></summary>
      <div class="faq__body">
        Quita un filtro a la vez. Combinar texto, fechas y varios países o géneros puede
        dejar el resultado vacío. Conviene empezar con pocos filtros y agregar más
        gradualmente.
      </div>
    </details>
    <details class="faq">
      <summary>¿El Radar filtra o solo ordena? <span class="faq__arrow" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span></summary>
      <div class="faq__body">
        Filtra con una tolerancia máxima de una unidad por eje activo y ordena por cercanía.
        Si todos los ejes están en 0, no afecta el resultado.
      </div>
    </details>
  </section>

  <section id="sugerir">
    <h2>Sugerir un lanzamiento</h2>
    <p>
      El catálogo está abierto. Si hay un lanzamiento de electrónica sudaca que
      debería estar, puedes enviarlo por el formulario de sugerencias.
    </p>
    <div class="callout callout--lime callout--sugerir">
      <div>
        <div class="callout__title">¿Falta algo en el catálogo?</div>
        <div class="callout__body">
          Inicia sesión, pega un enlace de Bandcamp, Spotify o SoundCloud y confirma los
          datos requeridos. Puedes guardar un borrador y consultar el estado en tu Perfil;
          toda publicación requiere aprobación final administrativa.
          También puedes escribirnos por Instagram
          <a href="https://www.instagram.com/discotica_/" target="_blank" rel="noopener">@discotica_</a>.
        </div>
      </div>
      <Button href="/sugerir" icon="agregar">Sugerir un lanzamiento</Button>
    </div>
  </section>
</ReadingLayout>

<style>
  /* Piezas propias del manual sobre la tipografía de ReadingLayout. */
  .manual__radar { width: 8rem; opacity: .5; }

  .cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-5);
  }
  .cards--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .manual-card {
    padding: var(--space-4);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    background: var(--color-superficie-1);
  }
  .manual-card h3 { margin: 0 0 var(--space-1); font-size: var(--text-md); }
  .manual-card p { margin: 0; color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.55; }

  .callout {
    margin-top: var(--space-5);
    padding: var(--space-4) var(--space-5);
    border-left: 2px solid var(--color-linea-fuerte);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--color-superficie-1);
  }
  .callout--lime { border-left-color: var(--color-acento); background: var(--color-acento-tinte); }
  .callout__title { margin-bottom: var(--space-1); color: var(--color-texto); font-size: var(--text-sm); font-weight: 700; }
  .callout__body { color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.6; }
  .callout--radar,
  .callout--sugerir { display: flex; align-items: center; gap: var(--space-5); }
  .callout--sugerir { justify-content: space-between; }
  .callout__radar-visual { flex: none; width: 6rem; }

  .steps { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-5); }
  .step { display: flex; align-items: baseline; gap: var(--space-3); }
  .step__n {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--chip-h-md);
    height: var(--chip-h-md);
    border: 1px solid var(--color-acento-border);
    border-radius: 50%;
    color: var(--color-acento);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .radar-demos {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-5);
  }
  .radar-demo {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    padding: var(--space-4);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    text-align: center;
  }
  .radar-demo :global(.radar-mini) { max-width: 7rem; }
  .radar-demo__label { margin: var(--space-2) 0 0; color: var(--color-texto); font-size: var(--text-sm); font-weight: 700; }
  .radar-demo__desc { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-xs); }

  .mono { margin-top: var(--space-5); }
  .mono__label { margin-bottom: var(--space-1); color: var(--color-texto-tenue); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--nav-letter-spacing); text-transform: uppercase; }
  .mono__box {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    overflow-x: auto;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    color: var(--color-acento-texto);
    font-size: var(--text-xs);
    line-height: 1.6;
  }
  .mono__box code { padding: 0; background: none; font-size: inherit; }

  /* Preguntas: filas separadas por líneas, sin caja. */
  .faq { border-bottom: 1px solid var(--color-linea); }
  :not(.faq) + .faq { margin-top: var(--space-5); border-top: 1px solid var(--color-linea); }
  .faq summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--target-touch);
    color: var(--color-texto);
    font-size: var(--text-md);
    font-weight: 600;
    list-style: none;
    cursor: pointer;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary:hover { color: var(--color-acento); }
  .faq__arrow { display: inline-flex; color: var(--color-texto-tenue); transition: transform var(--motion-fast) ease; }
  .faq[open] .faq__arrow { transform: rotate(90deg); }
  .faq__body { padding-bottom: var(--space-4); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.6; }

  @media (max-width: 679px) {
    .cards,
    .cards--2,
    .radar-demos { grid-template-columns: minmax(0, 1fr); }
    .callout--radar,
    .callout--sugerir { flex-direction: column; align-items: flex-start; }
  }
</style>
