<script lang="ts">
  import { onMount, tick } from 'svelte';
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import FormSection from '$lib/components/account/FormSection.svelte';
  import SocialFields, { emptySocialForm, socialFormFromProfile } from '$lib/components/account/SocialFields.svelte';
  import { Button, Checkbox, Field, Notice, PasswordField, Textarea } from '$lib/ui';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { loadOwnAccountProfile, updateOwnAccountProfile, type OwnAccountProfile } from '$lib/services/profiles';
  import type { SocialFieldErrors } from '$lib/domain/profileSocial';

  let { data }: { data: { userId: string; email: string; newEmail: string } } = $props();

  type Message = { tone: 'success' | 'error'; text: string } | null;

  // ---------- Perfil, redes y preferencias ----------
  let profile = $state<OwnAccountProfile | null>(null);
  let socialAvailable = $state(false);
  let loadError = $state('');
  let displayName = $state('');
  let bio = $state('');
  let newsletterOptIn = $state(false);
  let social = $state(emptySocialForm());
  let socialErrors = $state<SocialFieldErrors>({});
  let profileMessage = $state<Message>(null);
  let savingProfile = $state(false);
  let profileForm = $state<HTMLFormElement>();

  // ---------- Correo ----------
  let pendingEmail = $state(data.newEmail);
  let newEmail = $state('');
  let emailError = $state('');
  let emailMessage = $state<Message>(null);
  let savingEmail = $state(false);

  // ---------- Contraseña ----------
  let password = $state('');
  let passwordValid = $state(false);
  let confirmPassword = $state('');
  let passwordErrors = $state<{ password?: string; confirm?: string }>({});
  let passwordMessage = $state<Message>(null);
  let savingPassword = $state(false);

  let arrivalNotice = $state('');

  function fillForm(next: OwnAccountProfile) {
    profile = next;
    displayName = next.display_name ?? '';
    bio = next.bio ?? '';
    newsletterOptIn = next.newsletter_opt_in;
    if (socialAvailable) social = socialFormFromProfile(next);
  }

  async function load() {
    loadError = '';
    try {
      const result = await loadOwnAccountProfile(data.userId);
      socialAvailable = result.socialAvailable;
      fillForm(result.profile);
    } catch {
      loadError = 'No pudimos cargar tu cuenta.';
    }
  }

  // replaceState necesita el router iniciado: en una carga directa onMount corre antes.
  afterNavigate(({ to }) => {
    if (to?.url.searchParams.get('aviso') !== 'correo') return;
    arrivalNotice = 'Confirmamos el enlace. Si también te llegó un correo a la otra dirección, ábrelo para terminar el cambio.';
    const url = new URL(to.url);
    url.searchParams.delete('aviso');
    replaceState(url, {});
  });

  onMount(() => {
    void load();
  });

  async function saveProfile(event: SubmitEvent) {
    event.preventDefault();
    if (!profile) return;
    profileMessage = null;
    socialErrors = {};
    savingProfile = true;
    try {
      const result = await updateOwnAccountProfile(profile.id, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        newsletter_opt_in: newsletterOptIn,
        social: socialAvailable ? social : undefined
      });
      if (result.ok) {
        fillForm(result.profile);
        profileMessage = { tone: 'success', text: 'Guardamos los cambios.' };
      } else {
        socialErrors = result.errors;
        profileMessage = { tone: 'error', text: 'Revisa las redes marcadas.' };
        await tick();
        profileForm?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }
    } catch {
      profileMessage = { tone: 'error', text: 'No pudimos guardar los cambios. Vuelve a intentarlo.' };
    } finally {
      savingProfile = false;
    }
  }

  async function changeEmail(event: SubmitEvent) {
    event.preventDefault();
    emailError = '';
    emailMessage = null;
    const target = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      emailError = 'Revisa el formato del correo.';
      return;
    }
    if (target === data.email.toLowerCase()) {
      emailError = 'Ese ya es tu correo.';
      return;
    }
    savingEmail = true;
    const { error } = await supabase.auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/auth/reset?flow=email_change` }
    );
    savingEmail = false;
    // Un correo que ya usa otra cuenta recibe la misma respuesta que uno libre:
    // la pantalla no puede revelar qué correos están registrados.
    if (error && !['email_exists', 'user_already_exists'].includes(error.code ?? '')) {
      emailMessage = {
        tone: 'error',
        text:
          error.status === 429 || error.code?.startsWith('over_')
            ? 'Espera unos minutos antes de pedir otro cambio.'
            : 'No pudimos pedir el cambio. Vuelve a intentarlo.'
      };
      return;
    }
    pendingEmail = target;
    newEmail = '';
    emailMessage = {
      tone: 'success',
      text: 'Te enviamos un enlace para confirmar el cambio. Puede llegar a tu correo actual y al nuevo: ábrelo en los dos.'
    };
  }

  async function changePassword(event: SubmitEvent) {
    event.preventDefault();
    passwordMessage = null;
    passwordErrors = {
      password: passwordValid ? undefined : 'La contraseña necesita 8 caracteres o más.',
      confirm: confirmPassword === password ? undefined : 'Las contraseñas no coinciden.'
    };
    if (passwordErrors.password || passwordErrors.confirm) return;
    savingPassword = true;
    const { error } = await supabase.auth.updateUser({ password });
    savingPassword = false;
    if (error) {
      passwordMessage = {
        tone: 'error',
        text:
          error.code === 'same_password'
            ? 'La contraseña nueva tiene que ser distinta de la actual.'
            : error.code === 'weak_password'
              ? 'Esa contraseña es demasiado fácil de adivinar. Prueba con otra.'
              : error.code === 'reauthentication_needed'
                ? 'Por seguridad, cámbiala con "Olvidé mi contraseña": te enviamos un enlace a tu correo.'
                : 'No pudimos cambiar la contraseña. Vuelve a intentarlo.'
      };
      return;
    }
    password = '';
    confirmPassword = '';
    passwordMessage = { tone: 'success', text: 'Tu contraseña cambió.' };
  }
</script>

<svelte:head>
  <title>Editar cuenta — Biblioteca Discótica</title>
</svelte:head>

<AccountLayout title="Editar cuenta" help={profile ? `@${profile.username}` : undefined}>
  {#if arrivalNotice}<Notice tone="success" class="account-notice">{arrivalNotice}</Notice>{/if}

  {#if loadError}
    <Notice tone="error">
      {loadError}
      {#snippet actions()}<Button variant="secondary" size="sm" onclick={load}>Reintentar</Button>{/snippet}
    </Notice>
  {:else if !profile}
    <p class="account-loading" role="status">Cargando tu cuenta…</p>
  {:else}
    <div class="account-sections">
      <form class="account-form" bind:this={profileForm} onsubmit={saveProfile} novalidate aria-label="Perfil">
        <FormSection legend="Perfil">
          <Field label="Usuario" name="username" value={profile.username} readonly hint="El usuario no se puede cambiar." />
          <Field
            label="Nombre para mostrar"
            name="display_name"
            autocomplete="name"
            maxlength={60}
            optional
            bind:value={displayName}
            hint="Si lo dejas vacío, se muestra tu usuario."
          />
          <Textarea label="Sobre ti" name="bio" optional maxlength={280} rows={3} bind:value={bio} />
        </FormSection>

        {#if socialAvailable}
          <FormSection
            id="redes"
            legend="Redes"
            optional
            description="Son voluntarias. Aparecen en tu perfil y ayudan a que otras personas te encuentren y te sigan. Deja un campo vacío para quitar esa red."
          >
            <SocialFields bind:values={social} errors={socialErrors} />
          </FormSection>
        {/if}

        <FormSection legend="Correos de Discótica">
          <Checkbox name="newsletter" bind:checked={newsletterOptIn}>Quiero recibir novedades de Discótica por correo.</Checkbox>
        </FormSection>

        {#if profileMessage}<Notice tone={profileMessage.tone}>{profileMessage.text}</Notice>{/if}
        <Button type="submit" block loading={savingProfile}>Guardar cambios</Button>
      </form>

      <form class="account-form" onsubmit={changeEmail} novalidate aria-label="Correo">
        <FormSection legend="Correo">
          <Field label="Correo actual" name="current-email" value={data.email} readonly />
          {#if pendingEmail}
            <p class="account-pending">Cambio pendiente a <strong>{pendingEmail}</strong>. Confírmalo desde el enlace que te enviamos.</p>
          {/if}
          <Field label="Correo nuevo" type="email" name="new-email" autocomplete="email" bind:value={newEmail} error={emailError} />
        </FormSection>
        {#if emailMessage}<Notice tone={emailMessage.tone}>{emailMessage.text}</Notice>{/if}
        <Button type="submit" variant="secondary" block loading={savingEmail}>Cambiar correo</Button>
      </form>

      <form class="account-form" onsubmit={changePassword} novalidate aria-label="Contraseña">
        <FormSection legend="Contraseña">
          <PasswordField
            label="Contraseña nueva"
            name="new-password"
            bind:value={password}
            bind:valid={passwordValid}
            error={passwordErrors.password}
          />
          <PasswordField
            label="Repite la contraseña"
            name="new-password-confirm"
            autocomplete="new-password"
            showRules={false}
            bind:value={confirmPassword}
            error={passwordErrors.confirm}
          />
        </FormSection>
        {#if passwordMessage}<Notice tone={passwordMessage.tone}>{passwordMessage.text}</Notice>{/if}
        <Button type="submit" variant="secondary" block loading={savingPassword}>Cambiar contraseña</Button>
      </form>
    </div>
  {/if}

  {#snippet footer()}
    {#if profile}<a href="/perfil/{profile.username}">Ver mi perfil</a>{/if}
  {/snippet}
</AccountLayout>

<style>
  .account-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  .account-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .account-loading {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
  }
  .account-pending {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  :global(.account-notice) { margin-bottom: var(--space-6); }
</style>
