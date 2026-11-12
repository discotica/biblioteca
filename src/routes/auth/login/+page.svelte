<script lang="ts">
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import { Button, Field, FormPanel, Icon, Notice, PasswordField } from '$lib/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { parseLoginIdentifier, safeRedirect } from '$lib/domain/account';
  import { ownProfilePath } from '$lib/services/profiles';

  // Mismo mensaje para usuario o correo inexistente, contraseña incorrecta y
  // cuenta sin confirmar: ninguna respuesta dice si la cuenta existe.
  const GENERIC_ERROR = 'No pudimos entrar con esos datos. Revisa tu usuario o correo y la contraseña.';
  const RATE_LIMIT_ERROR = 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
  const NETWORK_ERROR = 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';

  // Tablero E (D3: sin el «más grande del mundo», que no se puede verificar).
  const PUNTOS = [
    { icon: 'agregar', verbo: 'Aporta', resto: 'nuevos y viejos lanzamientos al catálogo' },
    { icon: 'guardar', verbo: 'Guarda', resto: 'lanzamientos en tus colecciones' },
    { icon: 'compartir', verbo: 'Comparte', resto: 'tus colecciones con un enlace' }
  ] as const;

  let identifier = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  const redirectParam = $derived($page.url.searchParams.get('redirect'));
  const registerHref = $derived(redirectParam ? `/auth/registro?redirect=${encodeURIComponent(redirectParam)}` : '/auth/registro');

  async function withUsername(username: string): Promise<string> {
    const { data, error: err } = await supabase.functions.invoke('login-with-username', {
      body: { username, password }
    });
    if (err) {
      if (err.name === 'FunctionsFetchError') return NETWORK_ERROR;
      // La función bloquea igual un usuario inexistente que uno real: decirlo no revela la cuenta.
      if (err.context instanceof Response && err.context.status === 429) return RATE_LIMIT_ERROR;
      return GENERIC_ERROR;
    }
    if (!data?.access_token || !data?.refresh_token) return GENERIC_ERROR;
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token
    });
    return sessionError ? GENERIC_ERROR : '';
  }

  async function withEmail(email: string): Promise<string> {
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (!err) return '';
    // El límite de intentos de Auth es por IP: decirlo no revela nada de la cuenta.
    if (err.status === 429 || err.code === 'over_request_rate_limit') return RATE_LIMIT_ERROR;
    if (err.name === 'AuthRetryableFetchError') return NETWORK_ERROR;
    return GENERIC_ERROR;
  }

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    const parsed = parseLoginIdentifier(identifier);
    if (parsed.kind === 'invalid' || !password) {
      error = GENERIC_ERROR;
      return;
    }
    loading = true;
    error = parsed.kind === 'email' ? await withEmail(parsed.email) : await withUsername(parsed.username);
    if (error) {
      loading = false;
      return;
    }
    // Sin destino propio, la casa de la persona es su perfil.
    const destination = safeRedirect(redirectParam, await ownProfilePath());
    loading = false;
    goto(destination);
  }
</script>

<svelte:head>
  <title>Entrar — Biblioteca Discótica</title>
</svelte:head>

<AccesoPagina contenedor="wide" alinea="centro" nombre="discotica" velo>
  <div class="entrar">
    <div class="entrar__texto">
      <h1 class="entrar__titulo">Haz parte de la biblioteca de electrónica sudaca</h1>
      <ul class="entrar__puntos">
        {#each PUNTOS as punto (punto.verbo)}
          <li>
            <Icon name={punto.icon} size="lg" />
            <span><b>{punto.verbo}</b> {punto.resto}</span>
          </li>
        {/each}
      </ul>
    </div>

    <FormPanel as="form" class="entrar__form" onsubmit={signIn} novalidate>
      <Field
        label="Usuario o correo"
        name="identifier"
        bind:value={identifier}
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        required
      />
      <PasswordField label="Contraseña" name="password" autocomplete="current-password" bind:value={password} required />

      {#if error}<Notice tone="error">{error}</Notice>{/if}

      <div class="entrar__acciones">
        <Button type="submit" size="form" block {loading}>Entrar</Button>
        <Button href={registerHref} variant="accent" size="form" block>Crear cuenta</Button>
        <a class="entrar__olvide" href="/auth/recuperar">Olvidé mi contraseña</a>
      </div>
    </FormPanel>
  </div>
</AccesoPagina>

<style>
  .entrar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-7);
    width: 100%;
  }

  .entrar__texto { width: var(--acceso-punto-w); max-width: 100%; }

  .entrar__titulo {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-acceso);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: var(--text-acceso-lh);
  }

  .entrar__puntos {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: var(--space-5) 0 0;
    padding: 0;
    list-style: none;
    color: var(--color-texto-alto);
    font-size: var(--text-md);
    font-weight: 500;
    line-height: 1.5;
  }
  .entrar__puntos li { display: flex; align-items: flex-start; gap: var(--space-3); }
  .entrar__puntos li :global(.ui-icon) { flex: none; margin-top: 0.125rem; color: var(--color-acento); }
  .entrar__puntos b { color: var(--color-texto); font-weight: 700; }

  :global(.entrar__form) { flex: none; width: var(--form-panel-w); max-width: 100%; }

  .entrar__acciones { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-2); }
  .entrar__olvide {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-alto);
    font-size: var(--text-xs);
    text-decoration: none;
    transition: color var(--motion-fast) ease;
  }
  .entrar__olvide:hover { color: var(--color-acento); }

  @media (min-width: 768px) {
    .entrar__puntos { font-size: var(--text-xl); }
  }

  /* Móvil, tablero E: título y puntos arriba, el formulario debajo. */
  @media (max-width: 767px) {
    .entrar { flex-direction: column; align-items: stretch; gap: var(--space-6); }
    .entrar__texto { width: 100%; }
    :global(.entrar__form) { width: 100%; }
  }
</style>
