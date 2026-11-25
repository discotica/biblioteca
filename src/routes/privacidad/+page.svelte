<script lang="ts">
  import ReadingLayout from '$lib/layouts/ReadingLayout.svelte';
  import Button from '$lib/ui/Button.svelte';
  import { analyticsConsent, analyticsEnabled, setAnalyticsConsent } from '$lib/analytics';

  const fechaActualizacion = '25 de noviembre de 2026';

  // Lectura (U33, tablero M): índice a la izquierda con las mismas secciones.
  const secciones = [
    { id: 'quienes', label: 'Quiénes somos' },
    { id: 'datos', label: 'Qué datos guardamos' },
    { id: 'usos', label: 'Para qué usamos tus datos' },
    { id: 'cookies', label: 'Cookies y analítica' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'derechos', label: 'Tus derechos' },
    { id: 'seguridad', label: 'Seguridad' },
    { id: 'cambios', label: 'Cambios' }
  ];
</script>

<svelte:head>
  <title>Política de privacidad — Biblioteca Discótica</title>
</svelte:head>

<ReadingLayout title="Política de privacidad" eyebrow="Información" meta={`Última actualización: ${fechaActualizacion}`} toc={secciones}>

    <section id="quienes">
      <h2>Quiénes somos</h2>
      <p>
        Discótica es un archivo curado de música electrónica sudamericana. Puedes contactarnos en
        <a href="mailto:hola@discotica.com">hola@discotica.com</a>.
      </p>
    </section>

    <section id="datos">
      <h2>Qué datos guardamos</h2>
      <p>Cuando creas una cuenta, guardamos:</p>
      <ul>
        <li><strong>Email</strong> — para autenticación y comunicaciones que hayas autorizado.</li>
        <li><strong>Nombre de usuario</strong> — para identificar tu perfil.</li>
        <li><strong>Nombre para mostrar</strong> (opcional) — para personalizar cómo apareces.</li>
        <li><strong>Preferencia de newsletter</strong> — si elegiste recibir novedades y ofertas.</li>
      </ul>
      <p>También guardamos las colecciones que creas:</p>
      <ul>
        <li><strong>Colecciones</strong> — las listas de lanzamientos que armes.</li>
        <li><strong>Elementos de colecciones</strong> — los lanzamientos que agregas a cada colección.</li>
      </ul>
      <p>Si usas <strong>Reportar un problema</strong>, guardamos tu descripción, categoría, URL y lanzamiento relacionados, y una captura si eliges adjuntarla. También incluimos contexto técnico mínimo: ruta, fecha, versión, fuente de catálogo, navegador, viewport, idioma y estado de conexión. No incluimos cookies, tokens, contraseñas ni el contenido de otros formularios.</p>
    </section>

    <section id="usos">
      <h2>Para qué usamos tus datos</h2>
      <ul>
        <li>Para que puedas iniciar sesión y usar tu cuenta.</li>
        <li>Para mostrar tu perfil y tus colecciones públicas cuando las marcas como visibles.</li>
        <li>Para enviarte novedades y ofertas, solo si optaste por recibirlas.</li>
        <li>Para investigar y clasificar reportes de errores y responder internamente al equipo.</li>
      </ul>
      <p>No vendemos ni compartimos tus datos con terceros para publicidad.</p>
      <p>Los reportes y sus capturas son privados: sólo la persona autora y administración autorizada pueden acceder a ellos.</p>
    </section>

    <section id="cookies">
      <h2>Cookies y analítica</h2>
      <p>
        Para que inicies sesión guardamos en tu navegador lo necesario para mantener tu sesión
        abierta. Esas cookies y datos locales son imprescindibles y no requieren tu permiso.
      </p>
      <p>
        Solo si lo aceptas, usamos <strong>Google Analytics</strong> para medir de forma agregada
        qué páginas se visitan y cómo se usa la biblioteca. Deja las cookies <code>_ga</code> y
        <code>_ga_*</code>, que duran hasta dos años. Sin tu permiso no se carga. No lo usamos
        para publicidad ni lo cruzamos con tu cuenta.
      </p>
      {#if analyticsEnabled}
        <p data-preferencia-analitica>
          Ahora mismo:
          <strong>{$analyticsConsent === 'granted' ? 'aceptada' : $analyticsConsent === 'denied' ? 'rechazada' : 'sin elegir'}</strong>.
        </p>
        <p class="privacidad__acciones">
          {#if $analyticsConsent !== 'granted'}
            <Button variant="secondary" size="sm" onclick={() => setAnalyticsConsent('granted')}>Aceptar analítica</Button>
          {/if}
          {#if $analyticsConsent !== 'denied'}
            <Button variant="secondary" size="sm" onclick={() => setAnalyticsConsent('denied')}>Rechazar analítica</Button>
          {/if}
        </p>
      {/if}
    </section>

    <section id="proveedores">
      <h2>Proveedores</h2>
      <p>
        Usamos <strong>Supabase</strong> para almacenar los datos. Puedes consultar su
        política de privacidad en <a href="https://supabase.com/privacy" target="_blank" rel="noopener">supabase.com/privacy</a>.
      </p>
      <p>
        Si aceptas la analítica, <strong>Google</strong> procesa los datos de uso. Su política está en
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>.
      </p>
    </section>

    <section id="derechos">
      <h2>Tus derechos</h2>
      <p>Puedes en cualquier momento:</p>
      <ul>
        <li>Acceder a los datos que tenemos sobre ti.</li>
        <li>Corregir datos incorrectos.</li>
        <li>Solicitar la eliminación de tu cuenta y todos tus datos.</li>
        <li>Cambiar tu preferencia de newsletter desde tu perfil.</li>
      </ul>
      <p>Escríbenos a <a href="mailto:hola@discotica.com">hola@discotica.com</a>.</p>
    </section>

    <section id="seguridad">
      <h2>Seguridad</h2>
      <p>
        Las contraseñas se almacenan con hashing seguro y nunca en texto plano.
        La comunicación siempre va por HTTPS.
      </p>
    </section>

    <section id="cambios">
      <h2>Cambios</h2>
      <p>
        Si hacemos cambios importantes, te avisamos por email y actualizamos la fecha al inicio de esta página.
      </p>
    </section>
</ReadingLayout>

<style>
  .privacidad__acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
</style>
