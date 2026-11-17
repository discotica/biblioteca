<script lang="ts">
  // Ajustes (U33, tablero M): lo privado de la cuenta. Correo, contraseña y
  // novedades por correo. La lógica de correo y contraseña es la de siempre
  // (U12): mismas llamadas a Auth, mismos avisos.
  import { onMount } from 'svelte';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import AccesoTitulo from '$lib/components/account/AccesoTitulo.svelte';
  import { Button, Checkbox, Field, FormPanel, Notice, PasswordField } from '$lib/ui';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { authLinkRedirect } from '$lib/domain/account';
  import { loadOwnAccountProfile, updateOwnNewsletterOptIn } from '$lib/services/profiles';

  let { data }: { data: { userId: string; email: string; newEmail: string } } = $props();

  type Message = { tone: 'success' | 'error'; text: string } | null;

  // ---------- Novedades por correo ----------
  let newsletterReady = $state(false);
  let newsletterOptIn = $state(false);
  let newsletterMessage = $state<Message>(null);
  let savingNewsletter = $state(false);

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

  // replaceState necesita el router iniciado: en una carga directa onMount corre antes.
  afterNavigate(({ to }) => {
    if (to?.url.searchParams.get('aviso') !== 'correo') return;
    arrivalNotice = 'Confirmamos el enlace. Si también te llegó un correo a la otra dirección, ábrelo para terminar el cambio.';
    const url = new URL(to.url);
    url.searchParams.delete('aviso');
    replaceState(url, {});
  });

  onMount(async () => {
    try {
      const { profile } = await loadOwnAccountProfile(data.userId);
      newsletterOptIn = profile.newsletter_opt_in;
      newsletterReady = true;
    } catch {
      // Sin el perfil, el resto de Ajustes sigue funcionando; solo falta la casilla.
      newsletterMessage = { tone: 'error', text: 'No pudimos cargar tus preferencias de correo.' };
    }
  });

  // La preferencia se guarda al marcarla: no tiene botón propio.
  async function saveNewsletter(event: Event) {
    const next = (event.currentTarget as HTMLInputElement).checked;
    newsletterMessage = null;
    savingNewsletter = true;
    try {
      await updateOwnNewsletterOptIn(data.userId, next);
      newsletterOptIn = next;
      newsletterMessage = { tone: 'success', text: 'Guardamos tu preferencia.' };
    } catch {
      newsletterOptIn = !next;
      newsletterMessage = { tone: 'error', text: 'No pudimos guardar tu preferencia. Vuelve a intentarlo.' };
    } finally {
      savingNewsletter = false;
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
      { emailRedirectTo: authLinkRedirect(window.location.origin) }
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
  <title>Ajustes — Biblioteca Discótica</title>
</svelte:head>

<AccesoPagina contenedor="narrow" alinea="arriba">
  <FormPanel size="wide">
    <AccesoTitulo titulo="Ajustes" />
    {#if arrivalNotice}<Notice tone="success">{arrivalNotice}</Notice>{/if}

    <form class="ajustes__bloque" onsubmit={changeEmail} novalidate aria-labelledby="ajustes-correo">
      <h2 class="ajustes__titulo" id="ajustes-correo">Correo</h2>
      <Field label="Correo actual" name="current-email" value={data.email} readonly />
      {#if pendingEmail}
        <p class="ajustes__pendiente">Cambio pendiente a <strong>{pendingEmail}</strong>. Confírmalo desde el enlace que te enviamos.</p>
      {/if}
      <Field label="Correo nuevo" type="email" name="new-email" autocomplete="email" bind:value={newEmail} error={emailError} />
      {#if emailMessage}<Notice tone={emailMessage.tone}>{emailMessage.text}</Notice>{/if}
      <div class="ajustes__accion">
        <Button type="submit" variant="secondary" loading={savingEmail}>Cambiar correo</Button>
      </div>
    </form>

    <hr class="ajustes__sep" />

    <form class="ajustes__bloque" onsubmit={changePassword} novalidate aria-labelledby="ajustes-contrasena">
      <h2 class="ajustes__titulo" id="ajustes-contrasena">Contraseña</h2>
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
      {#if passwordMessage}<Notice tone={passwordMessage.tone}>{passwordMessage.text}</Notice>{/if}
      <div class="ajustes__accion">
        <Button type="submit" variant="secondary" loading={savingPassword}>Cambiar contraseña</Button>
      </div>
    </form>

    <hr class="ajustes__sep" />

    <div class="ajustes__bloque">
      <Checkbox
        name="newsletter"
        bind:checked={newsletterOptIn}
        disabled={!newsletterReady || savingNewsletter}
        onchange={saveNewsletter}
      >Quiero recibir novedades de Discótica por correo.</Checkbox>
      {#if newsletterMessage}<Notice tone={newsletterMessage.tone}>{newsletterMessage.text}</Notice>{/if}
    </div>
  </FormPanel>
</AccesoPagina>

<style>
  .ajustes__bloque {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .ajustes__titulo {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: 1.35;
  }
  .ajustes__accion { display: flex; margin-top: var(--space-1); }
  .ajustes__sep {
    width: 100%;
    height: 1px;
    margin: var(--space-2) 0;
    border: 0;
    background: var(--color-linea-sutil);
  }
  .ajustes__pendiente {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .ajustes__pendiente strong { color: var(--color-texto); }
</style>
