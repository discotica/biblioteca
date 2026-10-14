<script lang="ts">
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import { Button, Field, Notice, PasswordField } from '$lib/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { parseLoginIdentifier, safeRedirect } from '$lib/domain/account';

  // Mismo mensaje para usuario o correo inexistente, contraseña incorrecta y
  // cuenta sin confirmar: ninguna respuesta dice si la cuenta existe.
  const GENERIC_ERROR = 'No pudimos entrar con esos datos. Revisa tu usuario o correo y la contraseña.';
  const RATE_LIMIT_ERROR = 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
  const NETWORK_ERROR = 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';

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
    loading = false;
    if (!error) goto(safeRedirect(redirectParam));
  }
</script>

<svelte:head>
  <title>Entrar — Biblioteca Discótica</title>
</svelte:head>

<AccountLayout title="Entrar" help="Con tu usuario o con tu correo." variant="split">
  {#snippet aside()}
    <section class="benefits" aria-labelledby="benefits-title">
      <h2 id="benefits-title">Con una cuenta en Discótica</h2>
      <ul>
        <li>
          <strong>Colecciones</strong>
          <span>Guarda lanzamientos en listas propias y ordénalas a tu manera.</span>
        </li>
        <li>
          <strong>Compártelas</strong>
          <span>Cada colección pública tiene un enlace para enviarla a quien quieras.</span>
        </li>
        <li>
          <strong>Aporta lanzamientos</strong>
          <span>Sugiere lo que falta en el catálogo y sigue su revisión.</span>
        </li>
      </ul>
    </section>
  {/snippet}

  <form class="account-form" onsubmit={signIn} novalidate>
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

    <Button type="submit" block {loading}>Entrar</Button>
  </form>

  {#snippet footer()}
    <a href="/auth/recuperar">Olvidé mi contraseña</a>
    <span aria-hidden="true">·</span>
    <a href={registerHref}>Crear cuenta</a>
  {/snippet}
</AccountLayout>

<style>
  .account-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .benefits h2 {
    margin: 0 0 var(--space-5);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .benefits ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .benefits li {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-left: var(--space-4);
    border-left: 2px solid var(--color-acento-border);
  }
  .benefits strong {
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 700;
  }
  .benefits span {
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  /* En móvil los beneficios van después del formulario, separados por una línea. */
  @media (max-width: 768px) {
    .benefits {
      padding-top: var(--space-6);
      border-top: 1px solid var(--color-linea-sutil);
    }
  }
</style>
