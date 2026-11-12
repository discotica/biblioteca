<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import SocialFields, { emptySocialForm } from '$lib/components/account/SocialFields.svelte';
  import { confirmationRedirect, writePendingSignup } from '$lib/components/account/pendingSignup';
  import { Button, Checkbox, Field, FormPanel, Notice, PasswordField } from '$lib/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { USERNAME_PATTERN } from '$lib/domain/account';
  import { signupSocialMetadata } from '$lib/services/profiles';
  import type { SocialFieldErrors, SocialNetwork } from '$lib/domain/profileSocial';

  // Registro en tres pasos (U30, tablero K). Los pasos son solo de interfaz:
  // la llamada de alta y sus metadatos son los de siempre y salen del paso 3.
  type Step = 1 | 2 | 3;
  type FieldErrors = Partial<Record<'email' | 'password' | 'confirm' | 'username' | 'privacy', string>>;

  // Instagram, SoundCloud y Bandcamp abren el paso, como en el tablero.
  const SOCIAL_ORDER: readonly SocialNetwork[] = ['instagram', 'soundcloud', 'bandcamp', 'x', 'facebook'];
  const CHECK_DELAY_MS = 450;

  let step = $state<Step>(1);

  let email = $state('');
  let password = $state('');
  let passwordValid = $state(false);
  let confirmPassword = $state('');
  let username = $state('');
  let displayName = $state('');
  let social = $state(emptySocialForm());
  let newsletterOptIn = $state(false);
  let privacyAccepted = $state(false);

  let errors = $state<FieldErrors>({});
  let socialErrors = $state<SocialFieldErrors>({});
  let formError = $state('');
  let loading = $state(false);
  let usernameStatus = $state<'idle' | 'checking' | 'available' | 'taken'>('idle');

  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let checking: Promise<void> | null = null;

  onDestroy(() => clearTimeout(checkTimer));

  const loginHref = $derived.by(() => {
    const redirect = $page.url.searchParams.get('redirect');
    return redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login';
  });

  // El usuario es público (aparece en /perfil/usuario), así que avisar de que
  // está tomado no revela nada que no se vea ya. El correo nunca se comprueba.
  function checkUsername(): Promise<void> {
    clearTimeout(checkTimer);
    usernameStatus = 'idle';
    if (!USERNAME_PATTERN.test(username)) return Promise.resolve();
    const checked = username;
    usernameStatus = 'checking';
    const run = (async () => {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', checked).maybeSingle();
      if (checked !== username) return;
      usernameStatus = error ? 'idle' : data ? 'taken' : 'available';
      if (usernameStatus === 'taken') errors = { ...errors, username: 'Ese usuario ya está en uso. Prueba con otro.' };
      else if (errors.username) errors = { ...errors, username: undefined };
    })();
    checking = run;
    run.finally(() => {
      if (checking === run) checking = null;
    });
    return run;
  }

  // Mientras se escribe: minúsculas, el aviso anterior se retira y se comprueba
  // cuando la persona hace una pausa.
  function onUsernameInput() {
    username = username.toLowerCase();
    usernameStatus = 'idle';
    if (errors.username) errors = { ...errors, username: undefined };
    clearTimeout(checkTimer);
    if (USERNAME_PATTERN.test(username)) checkTimer = setTimeout(() => void checkUsername(), CHECK_DELAY_MS);
  }

  function validateAccess(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = 'Escribe tu correo.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) next.email = 'Revisa el formato del correo.';
    if (!passwordValid) next.password = 'La contraseña necesita 8 caracteres o más.';
    if (confirmPassword !== password) next.confirm = 'Las contraseñas no coinciden.';
    return next;
  }

  async function validateName(): Promise<FieldErrors> {
    const next: FieldErrors = {};
    if (!USERNAME_PATTERN.test(username)) {
      next.username = 'Usa de 3 a 30 minúsculas, números, - o _.';
      return next;
    }
    // Un usuario que aún no se comprobó (se pulsó Seguir sin pausa) se comprueba ahora.
    if (usernameStatus === 'idle') await checkUsername();
    else if (checking) await checking;
    if (usernameStatus === 'taken') next.username = 'Ese usuario ya está en uso. Prueba con otro.';
    return next;
  }

  function validateExtras(): FieldErrors {
    return privacyAccepted ? {} : { privacy: 'Para crear la cuenta tienes que aceptar la política de privacidad.' };
  }

  async function goToStep(next: Step, focus = true) {
    step = next;
    formError = '';
    if (!focus) return;
    await tick();
    document.querySelector<HTMLElement>('.registro-panel input:not([type="checkbox"])')?.focus();
  }

  async function focusFirstError() {
    await tick();
    document.querySelector<HTMLElement>('.registro-panel [aria-invalid="true"]')?.focus();
  }

  const hasErrors = (e: FieldErrors) => Object.values(e).some(Boolean);

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (loading) return;
    formError = '';

    if (step === 1) {
      errors = validateAccess();
      if (hasErrors(errors)) return void (await focusFirstError());
      return void (await goToStep(2));
    }

    if (step === 2) {
      errors = await validateName();
      if (hasErrors(errors)) return void (await focusFirstError());
      return void (await goToStep(3));
    }

    await register();
  }

  async function register() {
    // Todo se vuelve a comprobar: si algo de un paso anterior falla, se vuelve a él.
    const access = validateAccess();
    if (hasErrors(access)) {
      errors = access;
      await goToStep(1, false);
      return void (await focusFirstError());
    }
    const name = await validateName();
    if (hasErrors(name)) {
      errors = name;
      await goToStep(2, false);
      return void (await focusFirstError());
    }

    errors = validateExtras();
    const socialResult = signupSocialMetadata(social);
    socialErrors = socialResult.ok ? {} : socialResult.errors;
    if (hasErrors(errors) || !socialResult.ok) {
      formError = 'Revisa los campos marcados.';
      return void (await focusFirstError());
    }

    loading = true;
    const trimmedEmail = email.trim();
    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          username,
          display_name: displayName.trim() || username,
          newsletter_opt_in: newsletterOptIn,
          ...socialResult.data
        },
        emailRedirectTo: confirmationRedirect(window.location.origin)
      }
    });
    loading = false;

    // Un correo ya registrado sigue a "Revisa tu correo" como cualquier alta:
    // la pantalla no puede decir si la cuenta existía.
    if (error && !['user_already_exists', 'email_exists'].includes(error.code ?? '')) {
      if (error.code === 'weak_password') {
        errors = { password: 'Esa contraseña es demasiado fácil de adivinar. Prueba con otra.' };
        await goToStep(1, false);
        await focusFirstError();
      } else if (error.status === 429 || error.code?.startsWith('over_')) {
        formError = 'Hay muchos registros en este momento. Espera unos minutos y vuelve a intentarlo.';
      } else {
        formError = 'No pudimos crear la cuenta. Revisa los datos y vuelve a intentarlo.';
      }
      return;
    }

    writePendingSignup({ email: trimmedEmail, sentAt: Date.now(), username });
    goto('/auth/confirmar', { state: { email: trimmedEmail, username } });
  }
</script>

<svelte:head>
  <title>Crear cuenta — Biblioteca Discótica</title>
</svelte:head>

<!-- La huella va gris y quieta en el paso 1, se reorganiza con cada tecla del usuario en el 2 y revela su color en el 3. -->
<AccesoPagina contenedor="wide" alinea="inicio" nombre={username} color={step === 3} latido={step === 1 ? 8 : 0}>
  <h1 class="sr-only">Crear cuenta</h1>

  <FormPanel as="form" size="wide" class="registro-panel" onsubmit={onSubmit} novalidate>
    <div class="registro-progreso" aria-hidden="true">
      <i class:on={step >= 1}></i><i class:on={step >= 2}></i><i class:on={step >= 3}></i>
    </div>
    <p class="sr-only" role="status">Paso {step} de 3</p>

    {#if step === 1}
      <p class="registro-linea">Crea tu cuenta con tu correo y una contraseña.</p>
      <Field label="Correo" type="email" name="email" autocomplete="email" bind:value={email} error={errors.email} required />
      <PasswordField label="Contraseña" name="password" bind:value={password} bind:valid={passwordValid} error={errors.password} required />
      <PasswordField
        label="Repite la contraseña"
        name="password-confirm"
        autocomplete="new-password"
        showRules={false}
        bind:value={confirmPassword}
        error={errors.confirm}
        required
      />
    {:else if step === 2}
      <p class="registro-linea">Elige tu usuario y el nombre que se verá en tu perfil.</p>
      <Field
        label="Usuario"
        name="username"
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        maxlength={30}
        bind:value={username}
        oninput={onUsernameInput}
        onblur={() => {
          if (usernameStatus === 'idle') void checkUsername();
        }}
        hint={errors.username ? undefined : 'No se podrá cambiar después.'}
        error={errors.username}
        required
      >
        {#snippet end()}
          <span class="registro-estado" aria-live="polite">
            {#if usernameStatus === 'checking'}Comprobando…{:else if usernameStatus === 'available'}Disponible{/if}
          </span>
        {/snippet}
      </Field>
      <Field
        label="Nombre para mostrar"
        name="display_name"
        autocomplete="name"
        maxlength={60}
        optional
        bind:value={displayName}
        hint="Si lo dejas vacío, se muestra tu usuario."
      />
    {:else}
      <fieldset class="registro-redes">
        <legend>Redes <span class="registro-opcional">(opcional)</span></legend>
        <SocialFields bind:values={social} errors={socialErrors} order={SOCIAL_ORDER} />
      </fieldset>
      <div class="registro-casillas">
        <Checkbox name="newsletter" bind:checked={newsletterOptIn}>Quiero recibir novedades de Discótica por correo.</Checkbox>
        <Checkbox name="privacy" bind:checked={privacyAccepted} error={errors.privacy}>
          Acepto la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a>.
        </Checkbox>
      </div>
      {#if formError}<Notice tone="error">{formError}</Notice>{/if}
    {/if}

    {#snippet actions()}
      {#if step === 1}
        <a class="registro-enlace" href={loginHref}>¿Ya tienes cuenta?</a>
        <Button type="submit" size="form" iconEnd="flecha-derecha" {loading}>Seguir</Button>
      {:else if step === 2}
        <Button variant="ghost" size="form" icon="chevron-izquierda" onclick={() => goToStep(1)}>Atrás</Button>
        <Button type="submit" size="form" iconEnd="flecha-derecha">Seguir</Button>
      {:else}
        <Button variant="ghost" size="form" icon="chevron-izquierda" onclick={() => goToStep(2)}>Atrás</Button>
        <Button type="submit" size="form" {loading}>Crear cuenta</Button>
      {/if}
    {/snippet}
  </FormPanel>
</AccesoPagina>

<style>
  :global(.registro-panel) { position: relative; }

  /* Progreso: solo tres barritas, sin titulares ni «1 de 3». El paso se anuncia en el status oculto. */
  .registro-progreso { display: flex; gap: var(--space-2); }
  .registro-progreso i {
    width: var(--space-6);
    height: var(--space-1);
    border-radius: var(--radius-xs);
    background: var(--color-linea-fuerte);
    transition: background var(--motion-base) ease;
  }
  .registro-progreso i.on { background: var(--color-acento); }

  .registro-linea {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 500;
    line-height: 1.45;
  }

  .registro-estado { color: var(--color-acento); font-size: var(--text-xs); font-weight: 600; white-space: nowrap; }

  .registro-redes { min-width: 0; margin: 0; padding: 0; border: 0; }
  .registro-redes legend {
    float: left;
    width: 100%;
    margin-bottom: var(--space-4);
    padding: 0;
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .registro-redes :global(.social-fields) { clear: both; }
  .registro-opcional { margin-left: 0.3em; color: var(--color-texto-tenue); font-weight: 400; }

  .registro-casillas { display: flex; flex-direction: column; gap: var(--space-3); }

  .registro-enlace {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition: color var(--motion-fast) ease;
  }
  .registro-enlace:hover { color: var(--color-acento); }
</style>
