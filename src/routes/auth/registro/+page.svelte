<script lang="ts">
  import { tick } from 'svelte';
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import FormSection from '$lib/components/account/FormSection.svelte';
  import SocialFields, { emptySocialForm } from '$lib/components/account/SocialFields.svelte';
  import { confirmationRedirect, writePendingSignup } from '$lib/components/account/pendingSignup';
  import { Button, Checkbox, Field, Notice, PasswordField } from '$lib/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { USERNAME_PATTERN } from '$lib/domain/account';
  import { signupSocialMetadata } from '$lib/services/profiles';
  import type { SocialFieldErrors } from '$lib/domain/profileSocial';

  type FieldErrors = Partial<Record<'email' | 'password' | 'confirm' | 'username' | 'privacy', string>>;

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
  let form = $state<HTMLFormElement>();

  const loginHref = $derived.by(() => {
    const redirect = $page.url.searchParams.get('redirect');
    return redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login';
  });

  const usernameHint = $derived(
    usernameStatus === 'checking'
      ? 'Comprobando…'
      : usernameStatus === 'available'
        ? 'Disponible.'
        : 'Minúsculas, números, - y _ · de 3 a 30 caracteres. No podrás cambiarlo después.'
  );

  // El usuario es público (aparece en /perfil/usuario), así que avisar de que
  // está tomado no revela nada que no se vea ya. El correo nunca se comprueba.
  async function checkUsername() {
    usernameStatus = 'idle';
    if (!USERNAME_PATTERN.test(username)) return;
    const checked = username;
    usernameStatus = 'checking';
    const { data, error } = await supabase.from('profiles').select('id').eq('username', checked).maybeSingle();
    if (checked !== username) return;
    usernameStatus = error ? 'idle' : data ? 'taken' : 'available';
    if (usernameStatus === 'taken') errors = { ...errors, username: 'Ese usuario ya está en uso. Prueba con otro.' };
    else if (errors.username) errors = { ...errors, username: undefined };
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = 'Escribe tu correo.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) next.email = 'Revisa el formato del correo.';
    if (!passwordValid) next.password = 'La contraseña necesita 8 caracteres o más.';
    if (confirmPassword !== password) next.confirm = 'Las contraseñas no coinciden.';
    if (!USERNAME_PATTERN.test(username)) next.username = 'Usa de 3 a 30 minúsculas, números, - o _.';
    else if (usernameStatus === 'taken') next.username = 'Ese usuario ya está en uso. Prueba con otro.';
    if (!privacyAccepted) next.privacy = 'Para crear la cuenta tienes que aceptar la política de privacidad.';
    return next;
  }

  async function focusFirstError() {
    await tick();
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }

  async function register(event: SubmitEvent) {
    event.preventDefault();
    formError = '';
    errors = validate();
    const socialResult = signupSocialMetadata(social);
    socialErrors = socialResult.ok ? {} : socialResult.errors;
    if (Object.values(errors).some(Boolean) || !socialResult.ok) {
      formError = 'Revisa los campos marcados.';
      await focusFirstError();
      return;
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
        errors = { ...errors, password: 'Esa contraseña es demasiado fácil de adivinar. Prueba con otra.' };
        await focusFirstError();
      } else if (error.status === 429 || error.code?.startsWith('over_')) {
        formError = 'Hay muchos registros en este momento. Espera unos minutos y vuelve a intentarlo.';
      } else {
        formError = 'No pudimos crear la cuenta. Revisa los datos y vuelve a intentarlo.';
      }
      return;
    }

    writePendingSignup({ email: trimmedEmail, sentAt: Date.now() });
    goto('/auth/confirmar', { state: { email: trimmedEmail } });
  }
</script>

<svelte:head>
  <title>Crear cuenta — Biblioteca Discótica</title>
</svelte:head>

<AccountLayout title="Crear cuenta" help="Guarda colecciones, compártelas y sugiere lanzamientos.">
  <form class="account-form" bind:this={form} onsubmit={register} novalidate>
    <FormSection legend="Acceso">
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
    </FormSection>

    <FormSection legend="Perfil">
      <Field
        label="Usuario"
        name="username"
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        maxlength={30}
        bind:value={username}
        oninput={() => (username = username.toLowerCase())}
        onblur={checkUsername}
        hint={errors.username ? undefined : usernameHint}
        error={errors.username}
        required
      />
      <Field
        label="Nombre para mostrar"
        name="display_name"
        autocomplete="name"
        maxlength={60}
        optional
        bind:value={displayName}
        hint="Si lo dejas vacío, se muestra tu usuario."
      />
    </FormSection>

    <FormSection
      legend="Redes"
      optional
      description="Son voluntarias. Aparecen en tu perfil y ayudan a que otras personas te encuentren y te sigan."
    >
      <SocialFields bind:values={social} errors={socialErrors} />
    </FormSection>

    <FormSection legend="Privacidad">
      <Checkbox name="newsletter" bind:checked={newsletterOptIn}>Quiero recibir novedades de Discótica por correo.</Checkbox>
      <Checkbox name="privacy" bind:checked={privacyAccepted} error={errors.privacy}>
        Leí y acepto la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a>.
      </Checkbox>
    </FormSection>

    {#if formError}<Notice tone="error">{formError}</Notice>{/if}

    <Button type="submit" block {loading}>Crear cuenta</Button>
  </form>

  {#snippet footer()}
    <span>¿Ya tienes cuenta?</span>
    <a href={loginHref}>Entrar</a>
  {/snippet}
</AccountLayout>

<style>
  .account-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
